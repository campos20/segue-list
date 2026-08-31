import type { SongManifest } from "@/types/song";
import {
  collectTags,
  sortAlphabetically,
  sortByTagPriority,
} from "./setlistSort";

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

describe("collectTags", () => {
  it("returns every distinct tag used across the songs, alphabetically", () => {
    const songs = [
      song("s1", { tags: ["rock", "live"] }),
      song("s2", { tags: ["acoustic"] }),
      song("s3", { tags: ["rock"] }),
    ];

    expect(collectTags(songs)).toEqual(["acoustic", "live", "rock"]);
  });

  it("ignores songs with no tags", () => {
    expect(collectTags([song("s1"), song("s2", { tags: [] })])).toEqual([]);
  });
});

describe("sortAlphabetically", () => {
  it("orders song ids by name", () => {
    const songs = [
      song("s1", { name: "Zebra" }),
      song("s2", { name: "Apple" }),
    ];

    expect(sortAlphabetically(songs)).toEqual(["s2", "s1"]);
  });

  it("keeps same-named songs in their current relative order", () => {
    const songs = [song("s1", { name: "Same" }), song("s2", { name: "Same" })];

    expect(sortAlphabetically(songs)).toEqual(["s1", "s2"]);
  });
});

describe("sortByTagPriority", () => {
  it("brings songs matching the first tag to the front, in their current order", () => {
    const songs = [
      song("s1", { tags: ["rock"] }),
      song("s2", { tags: ["acoustic"] }),
      song("s3"),
      song("s4", { tags: ["acoustic"] }),
    ];

    expect(sortByTagPriority(songs, ["acoustic"])).toEqual([
      "s2",
      "s4",
      "s1",
      "s3",
    ]);
  });

  it("groups by every tag in priority order, then the untagged remainder", () => {
    const songs = [
      song("s1", { tags: ["rock"] }),
      song("s2", { tags: ["acoustic"] }),
      song("s3"),
      song("s4", { tags: ["ballad"] }),
    ];

    expect(sortByTagPriority(songs, ["ballad", "acoustic", "rock"])).toEqual([
      "s4",
      "s2",
      "s1",
      "s3",
    ]);
  });

  it("places a song matching two listed tags by the earliest one, not twice", () => {
    const songs = [song("s1", { tags: ["rock", "ballad"] }), song("s2")];

    expect(sortByTagPriority(songs, ["ballad", "rock"])).toEqual(["s1", "s2"]);
  });

  it("keeps the untagged/non-matching remainder in its current relative order", () => {
    const songs = [song("s1"), song("s2", { tags: ["rock"] }), song("s3")];

    expect(sortByTagPriority(songs, ["rock"])).toEqual(["s2", "s1", "s3"]);
  });

  it("returns the original order untouched when tagPriority is empty", () => {
    const songs = [song("s1", { tags: ["rock"] }), song("s2")];

    expect(sortByTagPriority(songs, [])).toEqual(["s1", "s2"]);
  });
});
