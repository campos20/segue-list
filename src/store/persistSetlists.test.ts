import type { SetlistManifest } from "@/types/setlist";
import { createAppStore } from "./index";
import {
  addSongToSetlist,
  createSetlist,
  deleteSetlist,
  duplicateSetlist,
  moveSongInSetlist,
  removeSongFromAllSetlists,
  removeSongFromSetlist,
  renameSetlist,
} from "./persistSetlists";
import { setlistsSelectors } from "./setlistsSlice";

jest.mock("@/storage/setlistLibrary");
// settingsSlice reads persisted settings at module load time (see its
// comment) - readAppSettings must return an object, not the automock
// default of undefined, or destructuring it crashes before any test runs.
jest.mock("@/storage/appSettings", () => ({
  readAppSettings: jest.fn(() => ({})),
  writeAppSettings: jest.fn(),
}));

const setlistLibrary = jest.requireMock("@/storage/setlistLibrary") as {
  createSetlist: jest.Mock;
  writeSetlist: jest.Mock;
  deleteSetlist: jest.Mock;
};

function makeSetlist(
  overrides: Partial<SetlistManifest> = {},
): SetlistManifest {
  return {
    id: "list-1",
    name: "Test setlist",
    songs: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Creates a setlist in `store` and returns its manifest as returned by the store. */
function seedSetlist(
  store: ReturnType<typeof createAppStore>,
  songs: string[] = [],
) {
  const setlist = makeSetlist({ songs });
  setlistLibrary.createSetlist.mockReturnValue(setlist);
  store.dispatch(createSetlist());
  return setlist;
}

beforeEach(() => {
  // resetAllMocks, not clearAllMocks: a test that sets a throwing
  // mockImplementation (to test the write-failure path) must not leak that
  // implementation into later tests - clearAllMocks only wipes call history,
  // not the implementation itself.
  jest.resetAllMocks();
});

describe("createSetlist", () => {
  it("adds the setlist to the store and library order when the write succeeds", () => {
    const setlist = makeSetlist();
    setlistLibrary.createSetlist.mockReturnValue(setlist);
    const store = createAppStore();

    const result = store.dispatch(createSetlist("Test setlist"));

    expect(result).toEqual(setlist);
    expect(
      setlistsSelectors.selectById(store.getState().setlists, setlist.id),
    ).toEqual(setlist);
    expect(store.getState().settings.libraryOrder[0]).toBe(
      `setlist:${setlist.id}`,
    );
  });

  it("leaves the store untouched and returns null when the file write throws", () => {
    setlistLibrary.createSetlist.mockImplementation(() => {
      throw new Error("disk full");
    });
    const store = createAppStore();

    const result = store.dispatch(createSetlist());

    expect(result).toBeNull();
    expect(setlistsSelectors.selectAll(store.getState().setlists)).toEqual([]);
  });
});

describe("renameSetlist", () => {
  it("updates the name in the store when the write succeeds", () => {
    const store = createAppStore();
    const setlist = seedSetlist(store);

    store.dispatch(renameSetlist(setlist.id, "New name"));

    expect(
      setlistsSelectors.selectById(store.getState().setlists, setlist.id)?.name,
    ).toBe("New name");
  });

  it("leaves the name unchanged when the write throws", () => {
    const store = createAppStore();
    const setlist = seedSetlist(store);
    setlistLibrary.writeSetlist.mockImplementation(() => {
      throw new Error("disk full");
    });

    store.dispatch(renameSetlist(setlist.id, "New name"));

    expect(
      setlistsSelectors.selectById(store.getState().setlists, setlist.id)?.name,
    ).toBe(setlist.name);
  });
});

describe("duplicateSetlist", () => {
  it("copies the source setlist's songs under the new name", () => {
    const store = createAppStore();
    const source = seedSetlist(store, ["song-a", "song-b"]);
    const copy = makeSetlist({ id: "list-2", name: "Copy", songs: [] });
    setlistLibrary.createSetlist.mockReturnValue(copy);

    const result = store.dispatch(duplicateSetlist(source.id, "Copy"));

    expect(result?.songs).toEqual(["song-a", "song-b"]);
    expect(
      setlistsSelectors.selectById(store.getState().setlists, "list-2")?.songs,
    ).toEqual(["song-a", "song-b"]);
  });

  it("returns null for a source id that isn't in the store", () => {
    const store = createAppStore();

    const result = store.dispatch(duplicateSetlist("missing", "Copy"));

    expect(result).toBeNull();
    expect(setlistLibrary.createSetlist).not.toHaveBeenCalled();
  });
});

describe("deleteSetlist", () => {
  it("removes the setlist from the store and its library order entry when the delete succeeds", () => {
    const store = createAppStore();
    const setlist = seedSetlist(store);

    store.dispatch(deleteSetlist(setlist.id));

    expect(
      setlistsSelectors.selectById(store.getState().setlists, setlist.id),
    ).toBeUndefined();
    expect(store.getState().settings.libraryOrder).not.toContain(
      `setlist:${setlist.id}`,
    );
  });

  it("leaves the setlist in the store when the file delete throws", () => {
    const store = createAppStore();
    const setlist = seedSetlist(store);
    setlistLibrary.deleteSetlist.mockImplementation(() => {
      throw new Error("permission denied");
    });

    store.dispatch(deleteSetlist(setlist.id));

    expect(
      setlistsSelectors.selectById(store.getState().setlists, setlist.id),
    ).toEqual(setlist);
  });
});

describe("addSongToSetlist", () => {
  it("appends the song id", () => {
    const store = createAppStore();
    const setlist = seedSetlist(store, ["song-a"]);

    store.dispatch(addSongToSetlist(setlist.id, "song-b"));

    expect(
      setlistsSelectors.selectById(store.getState().setlists, setlist.id)
        ?.songs,
    ).toEqual(["song-a", "song-b"]);
  });

  it("is a no-op when the song is already in the setlist", () => {
    const store = createAppStore();
    const setlist = seedSetlist(store, ["song-a"]);

    store.dispatch(addSongToSetlist(setlist.id, "song-a"));

    expect(setlistLibrary.writeSetlist).not.toHaveBeenCalled();
    expect(
      setlistsSelectors.selectById(store.getState().setlists, setlist.id)
        ?.songs,
    ).toEqual(["song-a"]);
  });
});

describe("removeSongFromSetlist", () => {
  it("drops the song id", () => {
    const store = createAppStore();
    const setlist = seedSetlist(store, ["song-a", "song-b"]);

    store.dispatch(removeSongFromSetlist(setlist.id, "song-a"));

    expect(
      setlistsSelectors.selectById(store.getState().setlists, setlist.id)
        ?.songs,
    ).toEqual(["song-b"]);
  });
});

describe("moveSongInSetlist", () => {
  it("reorders the setlist's songs", () => {
    const store = createAppStore();
    const setlist = seedSetlist(store, ["song-a", "song-b"]);

    store.dispatch(moveSongInSetlist(setlist.id, 1, "up"));

    expect(
      setlistsSelectors.selectById(store.getState().setlists, setlist.id)
        ?.songs,
    ).toEqual(["song-b", "song-a"]);
  });

  it("does not write when the move has no effect (already at the edge)", () => {
    const store = createAppStore();
    const setlist = seedSetlist(store, ["song-a", "song-b"]);

    store.dispatch(moveSongInSetlist(setlist.id, 0, "up"));

    expect(setlistLibrary.writeSetlist).not.toHaveBeenCalled();
  });
});

describe("removeSongFromAllSetlists", () => {
  it("drops the song from every setlist that lists it, and only those", () => {
    const store = createAppStore();
    setlistLibrary.createSetlist.mockReturnValueOnce(
      makeSetlist({ id: "a", songs: ["song-x"] }),
    );
    store.dispatch(createSetlist());
    setlistLibrary.createSetlist.mockReturnValueOnce(
      makeSetlist({ id: "b", songs: ["song-y"] }),
    );
    store.dispatch(createSetlist());

    store.dispatch(removeSongFromAllSetlists("song-x"));

    expect(
      setlistsSelectors.selectById(store.getState().setlists, "a")?.songs,
    ).toEqual([]);
    expect(
      setlistsSelectors.selectById(store.getState().setlists, "b")?.songs,
    ).toEqual(["song-y"]);
  });
});
