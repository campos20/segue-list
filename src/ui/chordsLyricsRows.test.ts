import {
  fromRows,
  mergeRowIntoPrevious,
  splitRowAt,
  toRows,
  type ChordsLyricsRow,
} from "./chordsLyricsRows";

describe("toRows", () => {
  it("pairs each lyric line with the chord line at the same index", () => {
    expect(toRows("Here comes the sun\nLittle darling", "Am\nC   G")).toEqual([
      { lyric: "Here comes the sun", chords: "Am" },
      { lyric: "Little darling", chords: "C   G" },
    ]);
  });

  it("pads a shorter chords string with blank lines", () => {
    expect(toRows("Line one\nLine two\nLine three", "Am")).toEqual([
      { lyric: "Line one", chords: "Am" },
      { lyric: "Line two", chords: "" },
      { lyric: "Line three", chords: "" },
    ]);
  });

  it("pads a shorter lyrics string with blank lines", () => {
    expect(toRows("Line one", "Am\nC\nG")).toEqual([
      { lyric: "Line one", chords: "Am" },
      { lyric: "", chords: "C" },
      { lyric: "", chords: "G" },
    ]);
  });

  it("returns a single blank row for two empty strings", () => {
    expect(toRows("", "")).toEqual([{ lyric: "", chords: "" }]);
  });
});

describe("fromRows", () => {
  it("is the inverse of toRows", () => {
    const lyrics = "Here comes the sun\nLittle darling";
    const chords = "Am\nC   G";
    expect(fromRows(toRows(lyrics, chords))).toEqual({ lyrics, chords });
  });
});

describe("splitRowAt", () => {
  it("splits the lyric at the cursor, keeping the chord line on the first half", () => {
    const rows: ChordsLyricsRow[] = [{ lyric: "Hello world", chords: "Am" }];
    expect(splitRowAt(rows, 0, 5)).toEqual([
      { lyric: "Hello", chords: "Am" },
      { lyric: " world", chords: "" },
    ]);
  });

  it("splitting at the end of the line produces a trailing blank row", () => {
    const rows: ChordsLyricsRow[] = [{ lyric: "Hello", chords: "Am" }];
    expect(splitRowAt(rows, 0, 5)).toEqual([
      { lyric: "Hello", chords: "Am" },
      { lyric: "", chords: "" },
    ]);
  });

  it("splitting at the start of the line produces a leading blank row", () => {
    const rows: ChordsLyricsRow[] = [{ lyric: "Hello", chords: "Am" }];
    expect(splitRowAt(rows, 0, 0)).toEqual([
      { lyric: "", chords: "Am" },
      { lyric: "Hello", chords: "" },
    ]);
  });

  it("only affects the targeted row, leaving other rows untouched", () => {
    const rows: ChordsLyricsRow[] = [
      { lyric: "First", chords: "G" },
      { lyric: "Second", chords: "D" },
    ];
    expect(splitRowAt(rows, 1, 3)).toEqual([
      { lyric: "First", chords: "G" },
      { lyric: "Sec", chords: "D" },
      { lyric: "ond", chords: "" },
    ]);
  });
});

describe("mergeRowIntoPrevious", () => {
  it("appends the lyric onto the previous row and reports the join point", () => {
    const rows: ChordsLyricsRow[] = [
      { lyric: "Hello", chords: "Am" },
      { lyric: " world", chords: "" },
    ];
    expect(mergeRowIntoPrevious(rows, 1)).toEqual({
      rows: [{ lyric: "Hello world", chords: "Am" }],
      joinPoint: 5,
    });
  });

  it("keeps the previous row's chords when the merged row's chords are blank", () => {
    const rows: ChordsLyricsRow[] = [
      { lyric: "Hello", chords: "Am" },
      { lyric: " world", chords: "" },
    ];
    expect(mergeRowIntoPrevious(rows, 1).rows[0].chords).toBe("Am");
  });

  it("takes the merged row's chords when the previous row's are blank", () => {
    const rows: ChordsLyricsRow[] = [
      { lyric: "Hello", chords: "" },
      { lyric: " world", chords: "C" },
    ];
    expect(mergeRowIntoPrevious(rows, 1).rows[0].chords).toBe("C");
  });

  it("joins both chord lines with a space when both are non-blank", () => {
    const rows: ChordsLyricsRow[] = [
      { lyric: "Hello", chords: "Am" },
      { lyric: " world", chords: "C" },
    ];
    expect(mergeRowIntoPrevious(rows, 1).rows[0].chords).toBe("Am C");
  });

  it("is a no-op when merging the first row (index 0)", () => {
    const rows: ChordsLyricsRow[] = [{ lyric: "Hello", chords: "Am" }];
    expect(mergeRowIntoPrevious(rows, 0)).toEqual({
      rows,
      joinPoint: 5,
    });
  });

  it("only affects the two merged rows, leaving others untouched", () => {
    const rows: ChordsLyricsRow[] = [
      { lyric: "First", chords: "G" },
      { lyric: "Second", chords: "D" },
      { lyric: "Third", chords: "E" },
    ];
    expect(mergeRowIntoPrevious(rows, 1)).toEqual({
      rows: [
        { lyric: "FirstSecond", chords: "G D" },
        { lyric: "Third", chords: "E" },
      ],
      joinPoint: 5,
    });
  });
});
