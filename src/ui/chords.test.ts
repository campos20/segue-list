import {
  alignChordsToLyricsLineCount,
  findInvalidChordTokens,
  isValidChordToken,
  pairChordsWithLyrics,
  transposeChordToken,
  transposeChordsText,
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

describe("transposeChordToken", () => {
  it("returns the token unchanged for 0 steps", () => {
    expect(transposeChordToken("C", 0)).toBe("C");
  });

  it("shifts a plain root up and down, respelling on the sharps scale", () => {
    expect(transposeChordToken("C", 1)).toBe("C#");
    expect(transposeChordToken("C", -1)).toBe("B");
    expect(transposeChordToken("Db", 1)).toBe("D");
  });

  it("wraps around the octave in both directions", () => {
    expect(transposeChordToken("B", 1)).toBe("C");
    expect(transposeChordToken("C", -1)).toBe("B");
    expect(transposeChordToken("C", 12)).toBe("C");
    expect(transposeChordToken("C", -12)).toBe("C");
    expect(transposeChordToken("C", 13)).toBe("C#");
  });

  it("carries the quality through unchanged", () => {
    expect(transposeChordToken("Am7", 2)).toBe("Bm7");
    expect(transposeChordToken("F#m7b5", 1)).toBe("Gm7b5");
    expect(transposeChordToken("Bb7sus4", 2)).toBe("C7sus4");
  });

  it("transposes a slash bass note along with the root", () => {
    expect(transposeChordToken("G/B", 2)).toBe("A/C#");
    expect(transposeChordToken("D/F#", -2)).toBe("C/E");
  });

  it("returns an unrecognized or blank token unchanged", () => {
    expect(transposeChordToken("Cxyz", 2)).toBe("Cxyz");
    expect(transposeChordToken("", 2)).toBe("");
  });
});

describe("transposeChordsText", () => {
  it("returns the text unchanged for 0 steps", () => {
    expect(transposeChordsText("C G\nAm F", 0)).toBe("C G\nAm F");
  });

  it("transposes every token on every line, preserving line breaks", () => {
    expect(transposeChordsText("C G\nAm F", 2)).toBe("D A\nBm G");
  });

  it("preserves exact inter-token spacing", () => {
    expect(transposeChordsText("C    G", 2)).toBe("D    A");
  });

  it("leaves blank lines blank", () => {
    expect(transposeChordsText("C\n\nG", 1)).toBe("C#\n\nG#");
  });

  it("is the exact inverse of the opposite step count, round-tripping back to the original", () => {
    const original = "C G\nAm F#m7b5";
    expect(transposeChordsText(transposeChordsText(original, 5), -5)).toBe(original);
  });
});
