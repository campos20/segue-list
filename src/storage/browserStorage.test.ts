/**
 * @jest-environment jsdom
 */
import type { SongManifest } from "@/types/song";

// jest-expo resolves modules as iOS, so the `.web` files are imported by
// their explicit names here - the same files Metro picks for the web build.
import * as settings from "./appSettings.web";
import * as browserStorage from "./browserStorage";
import * as setlists from "./setlistLibrary.web";
import * as songs from "./songLibrary.web";

beforeEach(() => {
  window.localStorage.clear();
});

// A fresh id per song: browserStorage remembers what it last saw at each key
// for the module's lifetime (one page load), so reusing an id after
// localStorage.clear() would look exactly like another tab deleting it.
let nextId = 0;
function makeSong(overrides: Partial<SongManifest> = {}): SongManifest {
  nextId += 1;
  return {
    id: `song-${nextId}`,
    name: "Test song",
    lyrics: "line one",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("songLibrary.web", () => {
  it("round-trips songs through localStorage under a prefixed key", async () => {
    const song = makeSong();
    songs.writeSong(song);
    const created = songs.createSong("Another", "la la");

    expect(
      window.localStorage.getItem(`segue-list:v1:song:${song.id}`),
    ).not.toBe(null);
    const listed = await songs.listSongs();
    expect(listed.map((listedSong) => listedSong.id).sort()).toEqual(
      [created.id, song.id].sort(),
    );
    expect(listed.find((song) => song.id === created.id)).toEqual(created);
  });

  it("deletes a song", async () => {
    const song = makeSong();
    songs.writeSong(song);
    songs.deleteSong(song.id);
    expect(await songs.listSongs()).toEqual([]);
  });

  it("saves the same song again and again from this tab", () => {
    const song = makeSong();
    songs.writeSong(song);
    songs.writeSong({ ...song, lyrics: "second save" });
    songs.writeSong({ ...song, lyrics: "third save" });
    expect(
      JSON.parse(
        window.localStorage.getItem(`segue-list:v1:song:${song.id}`) ?? "",
      ).lyrics,
    ).toBe("third save");
  });

  it("saves a song it loaded at startup (stored before this page load)", async () => {
    const song = makeSong();
    window.localStorage.setItem(
      `segue-list:v1:song:${song.id}`,
      JSON.stringify(song),
    );
    await songs.listSongs();

    expect(() =>
      songs.writeSong({ ...song, lyrics: "edited after load" }),
    ).not.toThrow();
  });

  it("skips unreadable entries and ignores other apps' keys on the same origin", async () => {
    const song = makeSong();
    songs.writeSong(song);
    window.localStorage.setItem("segue-list:v1:song:broken", "{not json");
    window.localStorage.setItem("segue-list:v1:song:no-name", '{"id":"x"}');
    window.localStorage.setItem("some-other-app:song:1", '{"id":"y"}');

    expect((await songs.listSongs()).map((listed) => listed.id)).toEqual([
      song.id,
    ]);
  });

  it("throws when the browser refuses the write, so nothing looks saved", () => {
    const setItem = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });
    try {
      expect(() => songs.writeSong(makeSong())).toThrow("full");
    } finally {
      setItem.mockRestore();
    }
  });
});

describe("setlistLibrary.web", () => {
  it("round-trips and deletes setlists", async () => {
    const created = setlists.createSetlist("Friday");
    expect(await setlists.listSetlists()).toEqual([created]);
    setlists.deleteSetlist(created.id);
    expect(await setlists.listSetlists()).toEqual([]);
  });
});

describe("appSettings.web", () => {
  it("merges changes into what's stored", () => {
    settings.writeAppSettings({ libraryOrder: ["song:a"] });
    settings.writeAppSettings({ presentationAllCaps: true });
    expect(settings.readAppSettings()).toEqual({
      libraryOrder: ["song:a"],
      presentationAllCaps: true,
    });
  });

  it("reads as empty when nothing (or garbage) is stored", () => {
    expect(settings.readAppSettings()).toEqual({});
    window.localStorage.setItem("segue-list:v1:settings", "nope");
    expect(settings.readAppSettings()).toEqual({});
  });
});

// Last on purpose: marking the library as changed elsewhere is permanent
// for the module's lifetime (exactly as for a real page until it reloads),
// so every write after the first test here is refused.
describe("changed in another tab", () => {
  it("refuses to overwrite another tab's save that this tab hasn't heard about yet", () => {
    // PR review: the `storage` event arrives asynchronously, so it can't be
    // what stops this - the write itself has to notice.
    const listener = jest.fn();
    browserStorage.onChangedElsewhere(listener);
    const song = makeSong({ lyrics: "loaded in both tabs" });
    songs.writeSong(song);
    const key = `segue-list:v1:song:${song.id}`;

    // The other tab saves its edit; no `storage` event has reached this tab.
    window.localStorage.setItem(
      key,
      JSON.stringify({ ...song, lyrics: "other tab's edit" }),
    );

    expect(() =>
      songs.writeSong({ ...song, lyrics: "this tab's stale copy" }),
    ).toThrow(browserStorage.LibraryChangedElsewhereError);
    expect(JSON.parse(window.localStorage.getItem(key) ?? "").lyrics).toBe(
      "other tab's edit",
    );
    // ...and the reload banner shows right away.
    expect(browserStorage.isChangedElsewhere()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("refuses every write once marked, and notifies listeners only once", () => {
    const listener = jest.fn();
    browserStorage.onChangedElsewhere(listener);
    browserStorage.markChangedElsewhere();

    expect(listener).not.toHaveBeenCalled();
    const song = makeSong();
    expect(() => songs.writeSong(song)).toThrow(
      browserStorage.LibraryChangedElsewhereError,
    );
    expect(() => setlists.deleteSetlist("x")).toThrow(
      browserStorage.LibraryChangedElsewhereError,
    );
    expect(window.localStorage.getItem(`segue-list:v1:song:${song.id}`)).toBe(
      null,
    );
  });

  it("only treats this app's keys as library keys", () => {
    expect(browserStorage.isLibraryKey("segue-list:v1:song:a")).toBe(true);
    expect(browserStorage.isLibraryKey("other-app:thing")).toBe(false);
    expect(browserStorage.isLibraryKey(null)).toBe(false);
  });
});
