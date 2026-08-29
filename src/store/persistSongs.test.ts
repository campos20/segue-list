import type { SongManifest } from "@/types/song";
import { createAppStore } from "./index";
import { createSong, deleteSong, updateSong } from "./persistSongs";
import { songsSelectors } from "./songsSlice";

jest.mock("@/storage/songLibrary");
// settingsSlice reads persisted settings at module load time (see its
// comment) - readAppSettings must return an object, not the automock
// default of undefined, or destructuring it crashes before any test runs.
jest.mock("@/storage/appSettings", () => ({
  readAppSettings: jest.fn(() => ({})),
  writeAppSettings: jest.fn(),
}));

const songLibrary = jest.requireMock("@/storage/songLibrary") as {
  createSong: jest.Mock;
  writeSong: jest.Mock;
  deleteSong: jest.Mock;
};

function makeSong(overrides: Partial<SongManifest> = {}): SongManifest {
  return {
    id: "song-1",
    name: "Test song",
    lyrics: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  // resetAllMocks, not clearAllMocks: a test that sets a throwing
  // mockImplementation (to test the write-failure path) must not leak that
  // implementation into later tests - clearAllMocks only wipes call history,
  // not the implementation itself.
  jest.resetAllMocks();
});

// Every write here follows the same contract documented in AGENTS.md: the
// file write happens first, and the store only reflects the change if that
// write succeeded - the manifest on disk is the source of truth, never the
// other way around.
describe("createSong", () => {
  it("adds the song to the store when the file write succeeds", () => {
    const song = makeSong();
    songLibrary.createSong.mockReturnValue(song);
    const store = createAppStore();

    const result = store.dispatch(createSong("Test song"));

    expect(result).toEqual(song);
    expect(songsSelectors.selectById(store.getState().songs, song.id)).toEqual(
      song,
    );
  });

  it("puts the new song at the top of the library order", () => {
    const song = makeSong();
    songLibrary.createSong.mockReturnValue(song);
    const store = createAppStore();

    store.dispatch(createSong());

    expect(store.getState().settings.libraryOrder[0]).toBe(`song:${song.id}`);
  });

  it("leaves the store untouched and returns null when the file write throws", () => {
    songLibrary.createSong.mockImplementation(() => {
      throw new Error("disk full");
    });
    const store = createAppStore();

    const result = store.dispatch(createSong());

    expect(result).toBeNull();
    expect(songsSelectors.selectAll(store.getState().songs)).toEqual([]);
  });
});

describe("updateSong", () => {
  it("applies the change to the store when the write succeeds", () => {
    const song = makeSong();
    songLibrary.createSong.mockReturnValue(song);
    const store = createAppStore();
    store.dispatch(createSong());

    store.dispatch(updateSong(song.id, { name: "New name" }));

    expect(
      songsSelectors.selectById(store.getState().songs, song.id)?.name,
    ).toBe("New name");
  });

  it("leaves the store's copy unchanged when the write throws", () => {
    const song = makeSong();
    songLibrary.createSong.mockReturnValue(song);
    const store = createAppStore();
    store.dispatch(createSong());
    songLibrary.writeSong.mockImplementation(() => {
      throw new Error("disk full");
    });

    store.dispatch(updateSong(song.id, { name: "New name" }));

    expect(
      songsSelectors.selectById(store.getState().songs, song.id)?.name,
    ).toBe(song.name);
  });

  it("does nothing for a song id that isn't in the store", () => {
    const store = createAppStore();

    store.dispatch(updateSong("missing", { name: "New name" }));

    expect(songLibrary.writeSong).not.toHaveBeenCalled();
  });
});

describe("deleteSong", () => {
  it("removes the song from the store and its library order entry when the delete succeeds", () => {
    const song = makeSong();
    songLibrary.createSong.mockReturnValue(song);
    const store = createAppStore();
    store.dispatch(createSong());

    store.dispatch(deleteSong(song.id));

    expect(
      songsSelectors.selectById(store.getState().songs, song.id),
    ).toBeUndefined();
    expect(store.getState().settings.libraryOrder).not.toContain(
      `song:${song.id}`,
    );
  });

  it("leaves the song in the store when the file delete throws", () => {
    const song = makeSong();
    songLibrary.createSong.mockReturnValue(song);
    const store = createAppStore();
    store.dispatch(createSong());
    songLibrary.deleteSong.mockImplementation(() => {
      throw new Error("permission denied");
    });

    store.dispatch(deleteSong(song.id));

    expect(songsSelectors.selectById(store.getState().songs, song.id)).toEqual(
      song,
    );
  });
});
