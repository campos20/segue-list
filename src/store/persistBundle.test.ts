import { serializeBundle } from "@/storage/bundle";
import type { SetlistManifest } from "@/types/setlist";
import type { SongManifest } from "@/types/song";
import { createAppStore } from "./index";
import { applyNewerFromBundle, importBundleIntoLibrary } from "./persistBundle";
import { setlistsHydrated, setlistsSelectors } from "./setlistsSlice";
import { songsHydrated, songsSelectors } from "./songsSlice";

jest.mock("@/storage/songLibrary");
jest.mock("@/storage/setlistLibrary");
jest.mock("@/storage/appSettings", () => ({
  readAppSettings: jest.fn(() => ({})),
  writeAppSettings: jest.fn(),
}));

const songLibrary = jest.requireMock("@/storage/songLibrary") as {
  writeSong: jest.Mock;
};
const setlistLibrary = jest.requireMock("@/storage/setlistLibrary") as {
  writeSetlist: jest.Mock;
};

const OLDER = "2026-01-01T00:00:00.000Z";
const NEWER = "2026-02-01T00:00:00.000Z";

function makeSong(overrides: Partial<SongManifest> = {}): SongManifest {
  return {
    id: "song-1",
    name: "Test song",
    lyrics: "local lyrics",
    chords: "C G",
    createdAt: OLDER,
    updatedAt: OLDER,
    ...overrides,
  };
}

function makeSetlist(
  overrides: Partial<SetlistManifest> = {},
): SetlistManifest {
  return {
    id: "list-1",
    name: "Test setlist",
    songs: ["song-1"],
    createdAt: OLDER,
    updatedAt: OLDER,
    ...overrides,
  };
}

function storeWith(songs: SongManifest[], setlists: SetlistManifest[] = []) {
  const store = createAppStore();
  store.dispatch(songsHydrated(songs));
  store.dispatch(setlistsHydrated(setlists));
  return store;
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe("importBundleIntoLibrary", () => {
  it("adds new songs but doesn't touch an existing song the bundle has a newer copy of", () => {
    const store = storeWith([makeSong()]);
    const text = serializeBundle({
      songs: [
        makeSong({ lyrics: "edited on the web", updatedAt: NEWER }),
        makeSong({ id: "song-2" }),
      ],
      setlists: [],
    });

    const result = store.dispatch(importBundleIntoLibrary(text));

    expect(result.songs.map((song) => song.id)).toEqual(["song-2"]);
    expect(result.newerSongs.map((song) => song.id)).toEqual(["song-1"]);
    expect(
      songsSelectors.selectById(store.getState().songs, "song-1")?.lyrics,
    ).toBe("local lyrics");
    expect(songLibrary.writeSong).toHaveBeenCalledTimes(1);
    expect(songLibrary.writeSong).toHaveBeenCalledWith(
      expect.objectContaining({ id: "song-2" }),
    );
  });

  it("skips a bundle copy that is the same age or older than the local one", () => {
    const store = storeWith([makeSong({ updatedAt: NEWER })], [makeSetlist()]);
    const text = serializeBundle({
      songs: [makeSong({ lyrics: "stale", updatedAt: OLDER })],
      setlists: [makeSetlist({ name: "Same age" })],
    });

    const result = store.dispatch(importBundleIntoLibrary(text));

    expect(result.newerSongs).toEqual([]);
    expect(result.newerSetlists).toEqual([]);
    expect(result.skippedSongIds).toEqual(["song-1"]);
    expect(result.skippedSetlistIds).toEqual(["list-1"]);
  });
});

describe("applyNewerFromBundle", () => {
  it("replaces the whole local song, including fields the newer copy no longer has", () => {
    const store = storeWith([makeSong()]);
    const incoming = makeSong({ lyrics: "edited", updatedAt: NEWER });
    delete incoming.chords;

    const applied = store.dispatch(
      applyNewerFromBundle({ songs: [incoming], setlists: [] }),
    );

    expect(applied.updatedSongIds).toEqual(["song-1"]);
    expect(songLibrary.writeSong).toHaveBeenCalledWith(incoming);
    expect(songsSelectors.selectById(store.getState().songs, "song-1")).toEqual(
      incoming,
    );
  });

  it("replaces a newer setlist", () => {
    const store = storeWith([makeSong()], [makeSetlist()]);
    const incoming = makeSetlist({ songs: [], updatedAt: NEWER });

    const applied = store.dispatch(
      applyNewerFromBundle({ songs: [], setlists: [incoming] }),
    );

    expect(applied.updatedSetlistIds).toEqual(["list-1"]);
    expect(setlistLibrary.writeSetlist).toHaveBeenCalledWith(incoming);
    expect(
      setlistsSelectors.selectById(store.getState().setlists, "list-1"),
    ).toEqual(incoming);
  });

  it("leaves the store untouched when the file write throws", () => {
    songLibrary.writeSong.mockImplementation(() => {
      throw new Error("disk full");
    });
    const store = storeWith([makeSong()]);

    const applied = store.dispatch(
      applyNewerFromBundle({
        songs: [makeSong({ lyrics: "edited", updatedAt: NEWER })],
        setlists: [],
      }),
    );

    expect(applied.failedCount).toBe(1);
    expect(applied.updatedSongIds).toEqual([]);
    expect(
      songsSelectors.selectById(store.getState().songs, "song-1")?.lyrics,
    ).toBe("local lyrics");
  });

  it("re-checks freshness: a local copy edited since the import was read is kept", () => {
    const store = storeWith([
      makeSong({ lyrics: "edited again", updatedAt: "2026-03-01T00:00:00Z" }),
    ]);

    const applied = store.dispatch(
      applyNewerFromBundle({
        songs: [makeSong({ lyrics: "from backup", updatedAt: NEWER })],
        setlists: [],
      }),
    );

    expect(applied.updatedSongIds).toEqual([]);
    expect(songLibrary.writeSong).not.toHaveBeenCalled();
    expect(
      songsSelectors.selectById(store.getState().songs, "song-1")?.lyrics,
    ).toBe("edited again");
  });

  it("skips a song deleted locally since the import was read", () => {
    const store = storeWith([]);

    const applied = store.dispatch(
      applyNewerFromBundle({
        songs: [makeSong({ updatedAt: NEWER })],
        setlists: [],
      }),
    );

    expect(applied.updatedSongIds).toEqual([]);
    expect(songLibrary.writeSong).not.toHaveBeenCalled();
  });
});
