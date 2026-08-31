import {
  buildLyricsHtml,
  parseLyricsColors,
  plainTextToLyricsHtml,
  sanitizeLyricsHtml,
  splitIntoLines,
} from "./lyricsColor";

describe("parseLyricsColors", () => {
  it("returns the whole string as one plain segment when there is no marker", () => {
    expect(parseLyricsColors("Hello world")).toEqual([{ text: "Hello world" }]);
  });

  it("splits out a span with both font color and background color", () => {
    const source =
      'Lead <span style="color:#1C1400;background-color:#FBBF24;">Ooh ooh</span> lead';
    expect(parseLyricsColors(source)).toEqual([
      { text: "Lead " },
      { text: "Ooh ooh", span: { color: "1C1400", background: "FBBF24" } },
      { text: " lead" },
    ]);
  });

  it("supports background-only and font-color-only spans", () => {
    const source =
      '<span style="background-color:#FBBF24;">a</span> <span style="color:#1C1400;">b</span>';
    expect(parseLyricsColors(source)).toEqual([
      { text: "a", span: { color: undefined, background: "FBBF24" } },
      { text: " " },
      { text: "b", span: { color: "1C1400", background: undefined } },
    ]);
  });

  it("handles back-to-back spans", () => {
    const source =
      '<span style="color:#FF0000;">a</span><span style="color:#00FF00;">b</span>';
    expect(parseLyricsColors(source)).toEqual([
      { text: "a", span: { color: "FF0000", background: undefined } },
      { text: "b", span: { color: "00FF00", background: undefined } },
    ]);
  });

  it("decodes escaped text within and around spans", () => {
    const source =
      'Rock &amp; roll <span style="color:#FF0000;">&lt;solo&gt;</span>';
    expect(parseLyricsColors(source)).toEqual([
      { text: "Rock & roll " },
      { text: "<solo>", span: { color: "FF0000", background: undefined } },
    ]);
  });

  it("treats an unmatched opening tag as plain text, restoring its own markup", () => {
    const source = 'Lead <span style="color:#FF0000;">Ooh lead';
    expect(parseLyricsColors(source)).toEqual([
      { text: "Lead " },
      { text: '<span style="color:#FF0000;">Ooh lead' },
    ]);
  });

  it("treats a stray close tag with nothing open as plain text", () => {
    expect(parseLyricsColors("Lead </span> lead")).toEqual([
      { text: "Lead </span> lead" },
    ]);
  });

  it("does not trust an arbitrary foreign tag as a span - it's left as literal text", () => {
    // A hostile .seguelist file trying to sneak in something other than
    // our own <span style="color:...;background-color:...;"> shape.
    const source = '<img src=x onerror="alert(1)">Ooh ooh';
    expect(parseLyricsColors(source)).toEqual([
      { text: '<img src=x onerror="alert(1)">Ooh ooh' },
    ]);
  });

  it("returns nothing for an empty string", () => {
    expect(parseLyricsColors("")).toEqual([]);
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
    const segments = parseLyricsColors(
      '<span style="background-color:#FBBF24;">Ooh\nahh</span>',
    );
    expect(splitIntoLines(segments)).toEqual([
      [{ text: "Ooh", span: { color: undefined, background: "FBBF24" } }],
      [{ text: "ahh", span: { color: undefined, background: "FBBF24" } }],
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

describe("buildLyricsHtml", () => {
  it("renders a plain segment as escaped text with no tag", () => {
    expect(buildLyricsHtml([{ text: "Rock & roll" }])).toBe("Rock &amp; roll");
  });

  it("renders a colored segment wrapped in a span, color before background", () => {
    expect(
      buildLyricsHtml([
        { text: "Ooh ooh", span: { color: "1C1400", background: "FBBF24" } },
      ]),
    ).toBe(
      '<span style="color:#1C1400;background-color:#FBBF24;">Ooh ooh</span>',
    );
  });

  it("omits the span entirely when the span object has neither color set", () => {
    expect(buildLyricsHtml([{ text: "plain", span: {} }])).toBe("plain");
  });
});

describe("sanitizeLyricsHtml", () => {
  it("round-trips well-formed markup unchanged in meaning", () => {
    const source = 'Lead <span style="color:#FF0000;">Ooh</span> lead';
    expect(sanitizeLyricsHtml(source)).toBe(source);
  });

  it("escapes anything that isn't our own span shape into inert text, defusing a hostile .seguelist import", () => {
    const source = '<img src=x onerror="alert(1)">Ooh ooh';
    const sanitized = sanitizeLyricsHtml(source);
    // The dangerous "<" that would make this a live tag if re-injected as
    // innerHTML is gone - what's left is the literal word "onerror" as
    // harmless text, same as any other word would be.
    expect(sanitized).not.toMatch(/<img/i);
    expect(sanitized).toContain("&lt;img");
    expect(sanitized).toContain("Ooh ooh");
  });
});

describe("plainTextToLyricsHtml", () => {
  it("escapes HTML-special characters so imported text can't be read back as markup", () => {
    expect(plainTextToLyricsHtml("Rock & Roll <encore>")).toBe(
      "Rock &amp; Roll &lt;encore&gt;",
    );
  });

  it("leaves newlines untouched", () => {
    expect(plainTextToLyricsHtml("line one\nline two")).toBe(
      "line one\nline two",
    );
  });

  it("round-trips back to the original text through parseLyricsColors", () => {
    const original = "Rock & Roll <encore>\nnext line";
    const stored = plainTextToLyricsHtml(original);
    const segments = parseLyricsColors(stored);
    expect(segments.map((s) => s.text).join("")).toBe(original);
  });
});
