import {
  alignChordsToLyricsLineCount,
  findInvalidChordTokens,
  isValidChordToken,
  pairChordsWithLyrics,
} from "./chords";

describe("isValidChordToken", () => {
  it("accepts plain major/minor triads", () => {
    for (const token of ["C", "G", "Am", "F#m", "Bbm", "Ddim", "Eaug"]) {
      expect(isValidChordToken(token)).toBe(true);
    }
  });

  it("accepts common sevenths, extensions and alterations", () => {
    for (const token of [
      "G7",
      "Am7",
      "Cmaj7",
      "Dsus4",
      "Cadd9",
      "F#m7b5",
      "Bb7sus4",
      "C6/9",
      "E7#9",
    ]) {
      expect(isValidChordToken(token)).toBe(true);
    }
  });

  it("accepts a slash chord with a bass note", () => {
    expect(isValidChordToken("G/B")).toBe(true);
    expect(isValidChordToken("D/F#")).toBe(true);
  });

  it("rejects a root letter outside A-G", () => {
    expect(isValidChordToken("H7")).toBe(false);
  });

  it("rejects a nonsense suffix", () => {
    expect(isValidChordToken("Cxyz")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidChordToken("")).toBe(false);
  });
});

describe("findInvalidChordTokens", () => {
  it("returns nothing for all-valid lines", () => {
    expect(findInvalidChordTokens("C G\nAm F")).toEqual([]);
  });

  it("ignores blank lines and extra whitespace", () => {
    expect(findInvalidChordTokens("C\n\n  G  \n")).toEqual([]);
  });

  it("reports each invalid token with its 1-indexed line number", () => {
    expect(findInvalidChordTokens("C H7\nAm\nCxyz F")).toEqual([
      { line: 1, token: "H7" },
      { line: 3, token: "Cxyz" },
    ]);
  });
});

describe("alignChordsToLyricsLineCount", () => {
  it("pads with blank lines when chords has fewer lines than lyrics", () => {
    expect(alignChordsToLyricsLineCount("C", 3)).toBe("C\n\n");
  });

  it("trims trailing lines when chords has more lines than lyrics", () => {
    expect(alignChordsToLyricsLineCount("C\nG\nAm\nF", 2)).toBe("C\nG");
  });

  it("returns an all-blank string of the right line count for empty chords", () => {
    expect(alignChordsToLyricsLineCount("", 2)).toBe("\n");
  });

  it("returns an empty string for zero lyrics lines", () => {
    expect(alignChordsToLyricsLineCount("C\nG", 0)).toBe("");
  });

  it("leaves already-aligned chords unchanged", () => {
    expect(alignChordsToLyricsLineCount("C\nG", 2)).toBe("C\nG");
  });
});

describe("pairChordsWithLyrics", () => {
  it("zips chords and lyrics line by line", () => {
    expect(pairChordsWithLyrics("C\nG", "Verse one\nVerse two")).toEqual([
      { chords: "C", lyrics: "Verse one" },
      { chords: "G", lyrics: "Verse two" },
    ]);
  });

  it("fills a missing chord line with an empty string", () => {
    expect(pairChordsWithLyrics("C", "Verse one\nVerse two")).toEqual([
      { chords: "C", lyrics: "Verse one" },
      { chords: "", lyrics: "Verse two" },
    ]);
  });

  it("fills a missing lyric line with an empty string", () => {
    expect(pairChordsWithLyrics("C\nG", "Verse one")).toEqual([
      { chords: "C", lyrics: "Verse one" },
      { chords: "G", lyrics: "" },
    ]);
  });

  it("returns an empty array for two empty strings", () => {
    expect(pairChordsWithLyrics("", "")).toEqual([]);
  });
});
