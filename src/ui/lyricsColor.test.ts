import {
  applyColorAt,
  getSpanAt,
  parseLyricsColors,
  splitIntoLines,
} from "./lyricsColor";

describe("parseLyricsColors", () => {
  it("returns the whole string as one plain segment when there is no marker", () => {
    expect(parseLyricsColors("Hello world")).toEqual([{ text: "Hello world" }]);
  });

  it("splits out a span with both background and font color", () => {
    expect(
      parseLyricsColors("Lead {{FBBF24,1C1400}}Ooh ooh{{/}} lead"),
    ).toEqual([
      { text: "Lead " },
      { text: "Ooh ooh", span: { background: "FBBF24", color: "1C1400" } },
      { text: " lead" },
    ]);
  });

  it("supports background-only and font-color-only spans", () => {
    expect(parseLyricsColors("{{FBBF24,}}a{{/}} {{,1C1400}}b{{/}}")).toEqual([
      { text: "a", span: { background: "FBBF24", color: undefined } },
      { text: " " },
      { text: "b", span: { background: undefined, color: "1C1400" } },
    ]);
  });

  it("handles back-to-back spans", () => {
    expect(parseLyricsColors("{{FF0000,}}a{{/}}{{00FF00,}}b{{/}}")).toEqual([
      { text: "a", span: { background: "FF0000", color: undefined } },
      { text: "b", span: { background: "00FF00", color: undefined } },
    ]);
  });

  it("treats an unmatched opening tag as plain text, restoring its own markup", () => {
    expect(parseLyricsColors("Lead {{FBBF24,}}Ooh lead")).toEqual([
      { text: "Lead " },
      { text: "{{FBBF24,}}Ooh lead" },
    ]);
  });

  it("treats a stray close tag with nothing open as plain text", () => {
    expect(parseLyricsColors("Lead {{/}} lead")).toEqual([
      { text: "Lead {{/}} lead" },
    ]);
  });

  it("returns nothing for an empty string", () => {
    expect(parseLyricsColors("")).toEqual([]);
  });

  it("strips markers from the rendered text (this is for display, not round-tripping)", () => {
    const source = "Lead {{FBBF24,1C1400}}Ooh ooh{{/}} lead";
    const rendered = parseLyricsColors(source)
      .map((segment) => segment.text)
      .join("");
    expect(rendered).toBe("Lead Ooh ooh lead");
  });
});

describe("splitIntoLines", () => {
  it("puts each line in its own array", () => {
    const segments = parseLyricsColors("Verse one\nVerse two");
    expect(splitIntoLines(segments)).toEqual([
      [{ text: "Verse one", span: undefined }],
      [{ text: "Verse two", span: undefined }],
    ]);
  });

  it("splits a colored span that crosses a line break, carrying its span onto both lines", () => {
    const segments = parseLyricsColors("{{FBBF24,}}Ooh\nahh{{/}}");
    expect(splitIntoLines(segments)).toEqual([
      [{ text: "Ooh", span: { background: "FBBF24", color: undefined } }],
      [{ text: "ahh", span: { background: "FBBF24", color: undefined } }],
    ]);
  });

  it("keeps a blank line as an empty run array", () => {
    const segments = parseLyricsColors("Verse one\n\nVerse two");
    expect(splitIntoLines(segments)).toEqual([
      [{ text: "Verse one", span: undefined }],
      [],
      [{ text: "Verse two", span: undefined }],
    ]);
  });
});

describe("getSpanAt", () => {
  const text = "Lead {{FBBF24,1C1400}}Ooh ooh{{/}} lead";
  // Indices: "Lead " = 0..5, open tag "{{FBBF24,1C1400}}" = 5..22 (17 chars),
  // "Ooh ooh" = 22..29, close "{{/}}" = 29..34.

  it("returns the span when the selection exactly matches the inner content, markers excluded", () => {
    expect(getSpanAt(text, 22, 29)).toEqual({
      background: "FBBF24",
      color: "1C1400",
    });
  });

  it("returns the span when the selection exactly matches the tag, markers included", () => {
    expect(getSpanAt(text, 5, 34)).toEqual({
      background: "FBBF24",
      color: "1C1400",
    });
  });

  it("returns null for a selection that doesn't align with any span boundary", () => {
    expect(getSpanAt(text, 23, 28)).toBeNull();
    expect(getSpanAt(text, 0, 4)).toBeNull();
  });

  it("returns null for an empty (cursor-only) selection", () => {
    expect(getSpanAt(text, 22, 22)).toBeNull();
  });
});

describe("applyColorAt", () => {
  it("wraps a plain selection in a new tag", () => {
    const text = "Lead Ooh ooh lead";
    expect(applyColorAt(text, 5, 12, { background: "FBBF24" })).toBe(
      "Lead {{FBBF24,}}Ooh ooh{{/}} lead",
    );
  });

  it("does nothing for an empty (cursor-only) selection", () => {
    expect(
      applyColorAt("Lead Ooh ooh lead", 5, 5, { background: "FF0000" }),
    ).toBe("Lead Ooh ooh lead");
  });

  it("does nothing when clearing a plain selection that has no color", () => {
    const text = "Lead Ooh ooh lead";
    expect(applyColorAt(text, 5, 12, null)).toBe(text);
  });

  it("clears a span when the selection exactly bounds its inner content, markers excluded", () => {
    const text = "Lead {{FBBF24,1C1400}}Ooh ooh{{/}} lead";
    expect(applyColorAt(text, 22, 29, null)).toBe("Lead Ooh ooh lead");
  });

  it("clears a span when the selection exactly bounds the tag, markers included", () => {
    const text = "Lead {{FBBF24,1C1400}}Ooh ooh{{/}} lead";
    expect(applyColorAt(text, 5, 34, null)).toBe("Lead Ooh ooh lead");
  });

  it("recolors an existing span in place (markers excluded) without touching the rest", () => {
    const text = "Lead {{FBBF24,1C1400}}Ooh ooh{{/}} lead";
    expect(applyColorAt(text, 22, 29, { background: "00FF00" })).toBe(
      "Lead {{00FF00,}}Ooh ooh{{/}} lead",
    );
  });

  it("round-trips: wrapping then clearing the same selection removes it again", () => {
    const original = "Lead Ooh ooh lead";
    const wrapped = applyColorAt(original, 5, 12, { color: "1C1400" });
    const innerStart = wrapped.indexOf("Ooh");
    const innerEnd = innerStart + "Ooh ooh".length;
    expect(applyColorAt(wrapped, innerStart, innerEnd, null)).toBe(original);
  });
});
