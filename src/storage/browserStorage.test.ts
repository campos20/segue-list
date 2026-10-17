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

function makeSong(overrides: Partial<SongManifest> = {}): SongManifest {
  return {
    id: "song-1",
    name: "Test song",
    lyrics: "line one",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("songLibrary.web", () => {
  it("round-trips songs through localStorage under a prefixed key", async () => {
    songs.writeSong(makeSong());
    const created = songs.createSong("Another", "la la");

    expect(window.localStorage.getItem("segue-list:v1:song:song-1")).not.toBe(
      null,
    );
    const listed = await songs.listSongs();
    expect(listed.map((song) => song.id).sort()).toEqual(
      [created.id, "song-1"].sort(),
    );
    expect(listed.find((song) => song.id === created.id)).toEqual(created);
  });

  it("deletes a song", async () => {
    songs.writeSong(makeSong());
    songs.deleteSong("song-1");
    expect(await songs.listSongs()).toEqual([]);
  });

  it("skips unreadable entries and ignores other apps' keys on the same origin", async () => {
    songs.writeSong(makeSong());
    window.localStorage.setItem("segue-list:v1:song:broken", "{not json");
    window.localStorage.setItem("segue-list:v1:song:no-name", '{"id":"x"}');
    window.localStorage.setItem("some-other-app:song:1", '{"id":"y"}');

    expect((await songs.listSongs()).map((song) => song.id)).toEqual([
      "song-1",
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
// so every write after this would be refused.
describe("changed in another tab", () => {
  it("refuses every write once marked, and notifies listeners once", () => {
    const listener = jest.fn();
    browserStorage.onChangedElsewhere(listener);

    browserStorage.markChangedElsewhere();
    browserStorage.markChangedElsewhere();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(browserStorage.isChangedElsewhere()).toBe(true);
    expect(() => songs.writeSong(makeSong())).toThrow(
      browserStorage.LibraryChangedElsewhereError,
    );
    expect(() => setlists.deleteSetlist("x")).toThrow(
      browserStorage.LibraryChangedElsewhereError,
    );
    expect(window.localStorage.getItem("segue-list:v1:song:song-1")).toBe(null);
  });

  it("only treats this app's keys as library keys", () => {
    expect(browserStorage.isLibraryKey("segue-list:v1:song:a")).toBe(true);
    expect(browserStorage.isLibraryKey("other-app:thing")).toBe(false);
    expect(browserStorage.isLibraryKey(null)).toBe(false);
  });
});
