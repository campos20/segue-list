import type { SetlistManifest } from "@/types/setlist";
import type { SongManifest } from "@/types/song";
import { buildLibraryTree, songKey, setlistKey } from "./libraryTree";

function song(id: string, overrides: Partial<SongManifest> = {}): SongManifest {
  return {
    id,
    name: id,
    lyrics: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function setlist(
  id: string,
  songs: string[],
  overrides: Partial<SetlistManifest> = {},
): SetlistManifest {
  return {
    id,
    name: id,
    songs,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildLibraryTree", () => {
  it("puts a song that belongs to no setlist at the top level", () => {
    const tree = buildLibraryTree([song("s1")], []);
    expect(tree).toEqual([
      { kind: "song", key: songKey("s1"), song: song("s1") },
    ]);
  });

  it("nests a setlist's songs inside it, not at the top level", () => {
    const s1 = song("s1");
    const list = setlist("l1", ["s1"]);
    const tree = buildLibraryTree([s1], [list]);

    expect(tree).toEqual([
      { kind: "setlist", key: setlistKey("l1"), setlist: list, songs: [s1] },
    ]);
  });

  it("shows a song in every setlist that lists it", () => {
    const s1 = song("s1");
    const listA = setlist("a", ["s1"]);
    const listB = setlist("b", ["s1"]);
    const tree = buildLibraryTree([s1], [listA, listB]);

    expect(tree).toEqual([
      { kind: "setlist", key: setlistKey("a"), setlist: listA, songs: [s1] },
      { kind: "setlist", key: setlistKey("b"), setlist: listB, songs: [s1] },
    ]);
  });

  it("drops setlist song ids that no longer resolve to a song", () => {
    const list = setlist("l1", ["missing"]);
    const tree = buildLibraryTree([], [list]);

    expect(tree).toEqual([
      { kind: "setlist", key: setlistKey("l1"), setlist: list, songs: [] },
    ]);
  });

  it("resolves a setlist's songs in the setlist's own order, not song-array order", () => {
    const s1 = song("s1");
    const s2 = song("s2");
    const list = setlist("l1", ["s2", "s1"]);
    const tree = buildLibraryTree([s1, s2], [list]);

    expect(tree).toEqual([
      {
        kind: "setlist",
        key: setlistKey("l1"),
        setlist: list,
        songs: [s2, s1],
      },
    ]);
  });

  it("places setlists before loose songs when there is no saved order", () => {
    const s1 = song("s1");
    const list = setlist("l1", []);
    const tree = buildLibraryTree([s1], [list]);

    expect(tree.map((item) => item.kind)).toEqual(["setlist", "song"]);
  });

  it("applies a saved order over both kinds", () => {
    const s1 = song("s1");
    const list = setlist("l1", []);
    const tree = buildLibraryTree(
      [s1],
      [list],
      [songKey("s1"), setlistKey("l1")],
    );

    expect(tree.map((item) => item.key)).toEqual([
      songKey("s1"),
      setlistKey("l1"),
    ]);
  });

  it("appends an item the saved order doesn't mention, in its original relative position", () => {
    const s1 = song("s1");
    const s2 = song("s2");
    // Order only knows about s2 - s1 is "new" and must not be lost.
    const tree = buildLibraryTree([s1, s2], [], [songKey("s2")]);

    expect(tree.map((item) => item.key)).toEqual([
      songKey("s2"),
      songKey("s1"),
    ]);
  });

  it("ignores a saved order entry for an item that no longer exists", () => {
    const s1 = song("s1");
    const tree = buildLibraryTree([s1], [], [songKey("gone"), songKey("s1")]);

    expect(tree.map((item) => item.key)).toEqual([songKey("s1")]);
  });
});
