import { deflateSync, strToU8 } from "fflate";
import type { SongManifest } from "@/types/song";
import {
  decodeSongLink,
  encodeSongLink,
  MAX_QR_PAYLOAD_LENGTH,
  SongLinkError,
  songImportAppUrl,
  songImportWebUrl,
} from "./songLink";

function makeSong(overrides: Partial<SongManifest> = {}): SongManifest {
  return {
    id: "amazing-grace-mvd0abcd-x1y2",
    name: "Amazing Grace",
    lyrics: 'Amazing <span style="color:#FBBF24;">grace</span>\nhow sweet',
    chords: " G      G7\n    C",
    transposeSteps: -2,
    durationSeconds: 225,
    tags: ["hymn", "slow"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Builds a payload from arbitrary JSON, the way a hand-crafted (or hostile) link would. */
function payloadOf(json: unknown): string {
  return Buffer.from(
    deflateSync(
      strToU8(typeof json === "string" ? json : JSON.stringify(json)),
    ),
  ).toString("base64url");
}

function validWire(overrides: Record<string, unknown> = {}) {
  return {
    v: 1,
    i: "song-abc",
    n: "Name",
    l: "la",
    a: "2026-01-01T00:00:00.000Z",
    u: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function reasonOf(payload: string): string {
  try {
    decodeSongLink(payload);
    return "decoded";
  } catch (error) {
    return error instanceof SongLinkError ? error.reason : "other error";
  }
}

describe("encodeSongLink / decodeSongLink", () => {
  it("round-trips every field a song carries", () => {
    const song = makeSong();
    expect(decodeSongLink(encodeSongLink(song))).toEqual(song);
  });

  it("round-trips a bare song (no chords, duration, tags or transposition)", () => {
    const song = makeSong({
      lyrics: null,
      chords: null,
      transposeSteps: 0,
      tags: [],
      durationSeconds: undefined,
    });
    expect(decodeSongLink(encodeSongLink(song))).toEqual({
      ...song,
      durationSeconds: undefined,
    });
  });

  it("keeps accents and other non-ASCII text intact", () => {
    const song = makeSong({
      name: "Coração de Estudante",
      lyrics: "Já podaram seus momentos ♪",
    });
    const decoded = decodeSongLink(encodeSongLink(song));
    expect(decoded.name).toBe("Coração de Estudante");
    expect(decoded.lyrics).toBe("Já podaram seus momentos ♪");
  });

  it("produces only URL-safe characters", () => {
    expect(encodeSongLink(makeSong())).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("fits a full song with chords in a scannable QR code", () => {
    // Amazing Grace (public domain), all six verses, chords on every line.
    const verses = [
      "Amazing grace, how sweet the sound\nThat saved a wretch like me\nI once was lost, but now am found\nWas blind, but now I see",
      "'Twas grace that taught my heart to fear\nAnd grace my fears relieved\nHow precious did that grace appear\nThe hour I first believed",
      "Through many dangers, toils and snares\nI have already come\n'Tis grace hath brought me safe thus far\nAnd grace will lead me home",
      "The Lord has promised good to me\nHis word my hope secures\nHe will my shield and portion be\nAs long as life endures",
      "Yea, when this flesh and heart shall fail\nAnd mortal life shall cease\nI shall possess within the veil\nA life of joy and peace",
      "When we've been there ten thousand years\nBright shining as the sun\nWe've no less days to sing God's praise\nThan when we'd first begun",
    ];
    const lyrics = verses.join("\n\n");
    const chords = lyrics
      .split("\n")
      .map((line) => (line ? " G      G7         C         G" : ""))
      .join("\n");
    const payload = encodeSongLink(makeSong({ lyrics, chords }));
    expect(payload.length).toBeLessThan(MAX_QR_PAYLOAD_LENGTH);
  });
});

describe("decodeSongLink with untrusted input", () => {
  it.each([
    ["empty", ""],
    ["not base64url", "not a payload!"],
    ["base64url but not deflate", "AAAA"],
    ["deflate but not JSON", payloadOf("hello")],
    ["JSON but not an object", payloadOf("[1,2]")],
    ["no version", payloadOf({ ...validWire(), v: undefined })],
    ["no name", payloadOf(validWire({ n: "  " }))],
    ["lyrics of the wrong type", payloadOf(validWire({ l: 42 }))],
    ["chords of the wrong type", payloadOf(validWire({ c: ["G"] }))],
    ["bad dates", payloadOf(validWire({ u: "yesterday" }))],
    ["too long", "A".repeat(20_000)],
  ])("rejects %s", (_label, payload) => {
    expect(reasonOf(payload)).toBe("invalid");
  });

  it("says when a link comes from a newer version of the app", () => {
    expect(reasonOf(payloadOf(validWire({ v: 2 })))).toBe("newerVersion");
  });

  it("refuses a payload that inflates to something huge (a 'zip bomb')", () => {
    const bomb = payloadOf(validWire({ l: "a".repeat(1_000_000) }));
    expect(bomb.length).toBeLessThan(16_000);
    expect(reasonOf(bomb)).toBe("invalid");
  });

  it("never keeps an id that isn't the app's own id shape - it would become a file name", () => {
    for (const id of ["../settings", "a/b", "UPPER", "", 42]) {
      const song = decodeSongLink(payloadOf(validWire({ i: id })));
      expect(song.id).not.toBe(id);
      expect(song.id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    }
    expect(decodeSongLink(payloadOf(validWire({ i: "song-abc" }))).id).toBe(
      "song-abc",
    );
  });

  it("sanitizes lyrics like everything else that reaches the editor", () => {
    const song = decodeSongLink(
      payloadOf(validWire({ l: '<img src=x onerror="alert(1)">hi' })),
    );
    expect(song.lyrics).not.toContain("<img");
    expect(song.lyrics).toContain("hi");
  });

  it("drops out-of-range numbers and non-string tags instead of failing", () => {
    const song = decodeSongLink(
      payloadOf(
        validWire({ d: -5, t: 99, g: ["ok", 3, " ", "x".repeat(500)] }),
      ),
    );
    expect(song.durationSeconds).toBeUndefined();
    expect(song.transposeSteps).toBe(0);
    expect(song.tags).toEqual(["ok", "x".repeat(100)]);
  });
});

describe("link builders", () => {
  it("puts the payload in the web URL's fragment, so it never reaches the server", () => {
    expect(songImportWebUrl("https://example.com/segue-list/", "abc")).toBe(
      "https://example.com/segue-list/import#abc",
    );
    expect(songImportWebUrl("http://localhost:8081", "abc")).toBe(
      "http://localhost:8081/import#abc",
    );
  });

  it("hands the payload to the app through its own scheme", () => {
    expect(songImportAppUrl("abc")).toBe("seguelist://import?d=abc");
  });
});
