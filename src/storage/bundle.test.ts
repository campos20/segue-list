import type { SetlistManifest } from "@/types/setlist";
import type { SongManifest } from "@/types/song";
import {
  BUNDLE_FORMAT,
  BUNDLE_VERSION,
  BundleFormatError,
  importBundle,
  isNewerThan,
  parseBundle,
  serializeBundle,
} from "./bundle";

jest.mock("./songLibrary");
jest.mock("./setlistLibrary");

const songLibrary = jest.requireMock("./songLibrary") as {
  writeSong: jest.Mock;
};
const setlistLibrary = jest.requireMock("./setlistLibrary") as {
  writeSetlist: jest.Mock;
};

function makeSong(overrides: Partial<SongManifest> = {}): SongManifest {
  return {
    id: "song-1",
    name: "Test song",
    lyrics: "line one\nline two",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
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
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("serializeBundle / parseBundle", () => {
  it("round-trips songs and setlists", () => {
    const songs = [makeSong(), makeSong({ id: "song-2", chords: "C G" })];
    const setlists = [makeSetlist()];

    const parsed = parseBundle(serializeBundle({ songs, setlists }, "1.7.2"));

    expect(parsed.format).toBe(BUNDLE_FORMAT);
    expect(parsed.version).toBe(BUNDLE_VERSION);
    expect(parsed.app).toBe("1.7.2");
    expect(parsed.songs).toEqual(songs);
    expect(parsed.setlists).toEqual(setlists);
  });

  it("rejects text that isn't JSON", () => {
    expect(() => parseBundle("not json")).toThrow(BundleFormatError);
  });

  it("rejects JSON that isn't a bundle", () => {
    expect(() => parseBundle(JSON.stringify({ songs: [] }))).toThrow(
      BundleFormatError,
    );
  });

  it("rejects a bundle from a newer format version", () => {
    const text = JSON.stringify({
      format: BUNDLE_FORMAT,
      version: BUNDLE_VERSION + 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      songs: [],
      setlists: [],
    });
    expect(() => parseBundle(text)).toThrow(/newer version/);
  });
});

describe("importBundle", () => {
  it("writes only songs and setlists whose ids aren't already local", () => {
    const text = serializeBundle({
      songs: [makeSong(), makeSong({ id: "song-2" })],
      setlists: [makeSetlist(), makeSetlist({ id: "list-2" })],
    });

    const result = importBundle(text, {
      songs: [makeSong({ name: "Local copy" })],
      setlists: [makeSetlist({ name: "Local copy" })],
    });

    expect(result.songs.map((song) => song.id)).toEqual(["song-2"]);
    expect(result.setlists.map((setlist) => setlist.id)).toEqual(["list-2"]);
    expect(result.skippedSongIds).toEqual(["song-1"]);
    expect(result.skippedSetlistIds).toEqual(["list-1"]);
    expect(songLibrary.writeSong).toHaveBeenCalledTimes(1);
    expect(songLibrary.writeSong).toHaveBeenCalledWith(
      expect.objectContaining({ id: "song-2" }),
    );
    expect(setlistLibrary.writeSetlist).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when the text isn't a valid bundle", () => {
    expect(() => importBundle("{}", { songs: [], setlists: [] })).toThrow(
      BundleFormatError,
    );
    expect(songLibrary.writeSong).not.toHaveBeenCalled();
    expect(setlistLibrary.writeSetlist).not.toHaveBeenCalled();
  });
});

describe("isNewerThan", () => {
  it("is true only when the incoming copy was saved strictly later", () => {
    const early = { updatedAt: "2026-01-01T00:00:00.000Z" };
    const late = { updatedAt: "2026-01-01T00:00:01.000Z" };
    expect(isNewerThan(late, early)).toBe(true);
    expect(isNewerThan(early, late)).toBe(false);
    expect(isNewerThan(early, early)).toBe(false);
  });

  it("is false when either timestamp is unparseable", () => {
    const valid = { updatedAt: "2026-01-01T00:00:00.000Z" };
    expect(isNewerThan({ updatedAt: "garbage" }, valid)).toBe(false);
    expect(isNewerThan(valid, { updatedAt: "" })).toBe(false);
  });
});
