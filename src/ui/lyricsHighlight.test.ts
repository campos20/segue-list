import {
  parseLyricsHighlights,
  splitIntoLines,
  toggleHighlightAt,
} from "./lyricsHighlight";

describe("parseLyricsHighlights", () => {
  it("returns the whole string as one plain segment when there is no marker", () => {
    expect(parseLyricsHighlights("Hello world")).toEqual([
      { text: "Hello world", highlighted: false },
    ]);
  });

  it("splits out a highlighted span in the middle", () => {
    expect(parseLyricsHighlights("Lead {{Ooh ooh}} lead")).toEqual([
      { text: "Lead ", highlighted: false },
      { text: "Ooh ooh", highlighted: true },
      { text: " lead", highlighted: false },
    ]);
  });

  it("handles a highlight at the very start or end", () => {
    expect(parseLyricsHighlights("{{Ooh}} lead {{ahh}}")).toEqual([
      { text: "Ooh", highlighted: true },
      { text: " lead ", highlighted: false },
      { text: "ahh", highlighted: true },
    ]);
  });

  it("handles back-to-back highlighted spans", () => {
    expect(parseLyricsHighlights("{{a}}{{b}}")).toEqual([
      { text: "a", highlighted: true },
      { text: "b", highlighted: true },
    ]);
  });

  it("treats an unmatched opening marker as plain text", () => {
    expect(parseLyricsHighlights("Lead {{Ooh lead")).toEqual([
      { text: "Lead ", highlighted: false },
      { text: "{{Ooh lead", highlighted: false },
    ]);
  });

  it("returns nothing for an empty string", () => {
    expect(parseLyricsHighlights("")).toEqual([]);
  });
});

describe("splitIntoLines", () => {
  it("puts each line in its own array", () => {
    const segments = parseLyricsHighlights("Verse one\nVerse two");
    expect(splitIntoLines(segments)).toEqual([
      [{ text: "Verse one", highlighted: false }],
      [{ text: "Verse two", highlighted: false }],
    ]);
  });

  it("splits a highlighted span that crosses a line break", () => {
    const segments = parseLyricsHighlights("{{Ooh\nahh}}");
    expect(splitIntoLines(segments)).toEqual([
      [{ text: "Ooh", highlighted: true }],
      [{ text: "ahh", highlighted: true }],
    ]);
  });

  it("keeps a blank line as an empty run array", () => {
    const segments = parseLyricsHighlights("Verse one\n\nVerse two");
    expect(splitIntoLines(segments)).toEqual([
      [{ text: "Verse one", highlighted: false }],
      [],
      [{ text: "Verse two", highlighted: false }],
    ]);
  });
});

describe("toggleHighlightAt", () => {
  it("wraps the selection in markers", () => {
    const text = "Lead Ooh ooh lead";
    expect(toggleHighlightAt(text, 5, 12)).toBe("Lead {{Ooh ooh}} lead");
  });

  it("does nothing for a cursor-only (empty) selection", () => {
    expect(toggleHighlightAt("Lead Ooh ooh lead", 5, 5)).toBe(
      "Lead Ooh ooh lead",
    );
  });

  it("strips markers when the selection exactly bounds them, markers included", () => {
    const text = "Lead {{Ooh ooh}} lead";
    // Selects "{{Ooh ooh}}" including the braces.
    expect(toggleHighlightAt(text, 5, 16)).toBe("Lead Ooh ooh lead");
  });

  it("strips markers when the selection exactly bounds the inner text, markers excluded", () => {
    const text = "Lead {{Ooh ooh}} lead";
    // Selects just "Ooh ooh", cursor sitting right against both markers.
    expect(toggleHighlightAt(text, 7, 14)).toBe("Lead Ooh ooh lead");
  });

  it("re-wraps a selection that partially overlaps an existing highlight rather than corrupting it", () => {
    const text = "Lead {{Ooh ooh}} lead";
    // Selects "Ooh" only, not the whole highlighted span - wraps just that.
    expect(toggleHighlightAt(text, 7, 10)).toBe("Lead {{{{Ooh}} ooh}} lead");
  });

  it("round-trips: wrapping then toggling the same selection removes it again", () => {
    const original = "Lead Ooh ooh lead";
    const wrapped = toggleHighlightAt(original, 5, 12);
    expect(toggleHighlightAt(wrapped, 5, 16)).toBe(original);
  });
});
