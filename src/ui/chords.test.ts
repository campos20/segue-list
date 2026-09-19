import {
  alignChordsAndLyricsRows,
  findInvalidChordTokens,
  isValidChordToken,
  pairChordsWithLyrics,
  parseChordsAndLyrics,
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

  it('accepts Brazilian "cifra" shorthand: º/° for diminished, + for augmented', () => {
    for (const token of ["Cº", "C°", "C+", "E5+"]) {
      expect(isValidChordToken(token)).toBe(true);
    }
  });

  it("accepts a parenthesized extension", () => {
    for (const token of ["E7(9)", "D(add9)", "A7(#9)", "G(b13)"]) {
      expect(isValidChordToken(token)).toBe(true);
    }
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

describe("alignChordsAndLyricsRows", () => {
  it("pads the shorter side with blank lines so both have the same row count", () => {
    expect(alignChordsAndLyricsRows("C", "one\ntwo\nthree")).toEqual({
      chords: "C\n\n",
      lyrics: "one\ntwo\nthree",
    });
  });

  it("keeps chord rows that sit past the last lyric line, padding the lyrics instead", () => {
    expect(alignChordsAndLyricsRows("C\nG\nAm\nF", "one\ntwo")).toEqual({
      chords: "C\nG\nAm\nF",
      lyrics: "one\ntwo\n\n",
    });
  });

  it("keeps the chords when the lyrics are entirely empty", () => {
    expect(alignChordsAndLyricsRows("C\nG", "")).toEqual({
      chords: "C\nG",
      lyrics: "\n",
    });
  });

  it("keeps a chord-only intro row instead of shifting the lyrics up against the wrong chords", () => {
    // Row 1 is chords over a blank lyric line; row 2 is "G" over "hello".
    // A plain lyrics.trim() would turn the lyrics into just "hello" and
    // pair it with "C".
    expect(alignChordsAndLyricsRows("C\nG", "\nhello")).toEqual({
      chords: "C\nG",
      lyrics: "\nhello",
    });
  });

  it("drops leading and trailing rows that are blank on both sides", () => {
    expect(alignChordsAndLyricsRows("\n\nC\n\n", "\n\nhello\n\n")).toEqual({
      chords: "C",
      lyrics: "hello",
    });
  });

  it("keeps a blank row in the middle", () => {
    expect(alignChordsAndLyricsRows("C\n\nG", "one\n\ntwo")).toEqual({
      chords: "C\n\nG",
      lyrics: "one\n\ntwo",
    });
  });

  it("returns empty strings when there's nothing but blank rows", () => {
    expect(alignChordsAndLyricsRows("\n  \n", "\n\n")).toEqual({
      chords: "",
      lyrics: "",
    });
    expect(alignChordsAndLyricsRows("", "")).toEqual({
      chords: "",
      lyrics: "",
    });
  });

  it("leaves already-aligned content unchanged", () => {
    expect(alignChordsAndLyricsRows("C\nG", "one\ntwo")).toEqual({
      chords: "C\nG",
      lyrics: "one\ntwo",
    });
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
    expect(transposeChordsText(transposeChordsText(original, 5), -5)).toBe(
      original,
    );
  });
});

describe("parseChordsAndLyrics", () => {
  it("pairs a chord line with the lyric line right after it", () => {
    expect(parseChordsAndLyrics("C G\nHello world")).toEqual({
      chords: "C G",
      lyrics: "Hello world",
    });
  });

  it("preserves a chord line's column spacing exactly", () => {
    expect(parseChordsAndLyrics("   C        G\nHello world")).toEqual({
      chords: "   C        G",
      lyrics: "Hello world",
    });
  });

  it("gives a plain lyric line (no chords above it) a blank paired chord line", () => {
    expect(parseChordsAndLyrics("Just lyrics, no chord line")).toEqual({
      chords: "",
      lyrics: "Just lyrics, no chord line",
    });
  });

  it("treats a section marker as lyrics, not chords", () => {
    expect(parseChordsAndLyrics("[Chorus]\nC G\nSing along")).toEqual({
      chords: "\nC G",
      lyrics: "[Chorus]\nSing along",
    });
  });

  it("keeps blank separator lines as their own blank chord/lyric pair", () => {
    expect(parseChordsAndLyrics("C\nLine one\n\nG\nLine two")).toEqual({
      chords: "C\n\nG",
      lyrics: "Line one\n\nLine two",
    });
  });

  it("pairs a trailing chord line with a blank lyric line if nothing follows it", () => {
    expect(parseChordsAndLyrics("Line one\nC G")).toEqual({
      chords: "\nC G",
      lyrics: "Line one\n",
    });
  });

  it("normalizes CRLF line endings", () => {
    expect(parseChordsAndLyrics("C G\r\nHello world")).toEqual({
      chords: "C G",
      lyrics: "Hello world",
    });
  });

  it("always returns chords and lyrics with the same number of lines", () => {
    const { chords, lyrics } = parseChordsAndLyrics(
      "[Verse]\n\nC G\nLine one\nAm F\nLine two\n\n[Chorus]\nG\nLine three",
    );
    expect(chords.split("\n").length).toBe(lyrics.split("\n").length);
  });

  it("parses a full multi-section chart with no invalid chords left over", () => {
    const source = [
      "[Primeira Parte]",
      "",
      "           E                  B/D#",
      "Quando eu digo que deixei de te amar",
      "         C#m7    E7(9)  E6  E7",
      "É porque eu te amo",
      " Cº",
      "Coração",
      "",
      "[Refrão]",
      "",
      "              E5+",
      "Diz que é verdade que tem",
    ].join("\n");
    const { chords, lyrics } = parseChordsAndLyrics(source);
    expect(findInvalidChordTokens(chords)).toEqual([]);
    expect(lyrics.split("\n")).toEqual([
      "[Primeira Parte]",
      "",
      "Quando eu digo que deixei de te amar",
      "É porque eu te amo",
      "Coração",
      "",
      "[Refrão]",
      "",
      "Diz que é verdade que tem",
    ]);
  });
});
