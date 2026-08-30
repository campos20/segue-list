import { strToU8, zlibSync } from "fflate";
import { LyricsImportError } from "./lyricsImportError";
import { extractPdfText, __testing } from "./pdfTextExtract";

const { parseToUnicodeCMap } = __testing;

function u8ToLatin1(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

function latin1ToU8(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
  return bytes;
}

interface FakeObject {
  num: number;
  dict: string;
  /** Raw (already-encoded, e.g. Flate-compressed) stream payload, given as a latin1 "byte string". */
  stream?: string;
}

/**
 * Assembles a minimal PDF byte buffer out of `N G obj << dict >> [stream ...
 * endstream] endobj` blocks. No xref table or trailer - the extractor never
 * reads either (see pdfTextExtract.ts's brute-force object scan), so a real
 * one would only make these fixtures harder to read for no test value.
 */
function buildPdf(objects: FakeObject[]): Uint8Array {
  let text = "%PDF-1.4\n";
  for (const { num, dict, stream } of objects) {
    text += `${num} 0 obj\n<< ${dict} >>\n`;
    if (stream !== undefined) text += `stream\n${stream}\nendstream\n`;
    text += `endobj\n`;
  }
  return latin1ToU8(text);
}

/** A one-page PDF with a single simple (WinAnsi) font, showing `content` verbatim as its content stream. */
function simplePagePdf(content: string): Uint8Array {
  return buildPdf([
    {
      num: 1,
      dict: "/Type /Page /Resources << /Font << /F1 2 0 R >> >> /Contents 3 0 R",
    },
    {
      num: 2,
      dict: "/Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding",
    },
    { num: 3, dict: "/Length 0", stream: content },
  ]);
}

describe("extractPdfText", () => {
  it("extracts text shown via Tj, starting a new line on Td", () => {
    const pdf = simplePagePdf(
      "BT\n/F1 12 Tf\n100 700 Td\n(Hello World) Tj\n0 -20 Td\n(Line two) Tj\nET",
    );
    expect(extractPdfText(pdf, "song.pdf")).toBe("Hello World\nLine two");
  });

  it("inserts a space for a large TJ gap but not for ordinary kerning", () => {
    const pdf = simplePagePdf(
      "BT\n/F1 12 Tf\n100 700 Td\n[(Hel) -20 (lo) -250 (World)] TJ\nET",
    );
    expect(extractPdfText(pdf, "song.pdf")).toBe("Hello World");
  });

  it("decodes escaped literal-string characters", () => {
    const pdf = simplePagePdf(
      "BT\n/F1 12 Tf\n100 700 Td\n(Don\\'t stop \\(the music\\)) Tj\nET",
    );
    expect(extractPdfText(pdf, "song.pdf")).toBe("Don't stop (the music)");
  });

  it("decodes WinAnsi bytes above 0x7F as Latin-1, covering Portuguese diacritics", () => {
    const pdf = simplePagePdf(
      "BT\n/F1 12 Tf\n100 700 Td\n(N\xe3o vou negar) Tj\nET",
    );
    expect(extractPdfText(pdf, "song.pdf")).toBe("Não vou negar");
  });

  it("reads a hex string the same as a literal string", () => {
    // "Hi" in hex.
    const pdf = simplePagePdf("BT\n/F1 12 Tf\n100 700 Td\n<4869> Tj\nET");
    expect(extractPdfText(pdf, "song.pdf")).toBe("Hi");
  });

  it("joins multiple pages with a blank line, in object-number order", () => {
    const pdf = buildPdf([
      {
        num: 1,
        dict: "/Type /Page /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R",
      },
      {
        num: 2,
        dict: "/Type /Page /Resources << /Font << /F1 3 0 R >> >> /Contents 6 0 R",
      },
      {
        num: 3,
        dict: "/Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding",
      },
      {
        num: 5,
        dict: "/Length 0",
        stream: "BT\n/F1 12 Tf\n100 700 Td\n(Page one) Tj\nET",
      },
      {
        num: 6,
        dict: "/Length 0",
        stream: "BT\n/F1 12 Tf\n100 700 Td\n(Page two) Tj\nET",
      },
    ]);
    expect(extractPdfText(pdf, "song.pdf")).toBe("Page one\n\nPage two");
  });

  it("decompresses a Flate-encoded content stream", () => {
    const compressed = u8ToLatin1(
      zlibSync(
        strToU8("BT\n/F1 12 Tf\n100 700 Td\n(Compressed lyrics) Tj\nET"),
      ),
    );
    const pdf = buildPdf([
      {
        num: 1,
        dict: "/Type /Page /Resources << /Font << /F1 2 0 R >> >> /Contents 3 0 R",
      },
      {
        num: 2,
        dict: "/Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding",
      },
      { num: 3, dict: "/Length 0 /Filter /FlateDecode", stream: compressed },
    ]);
    expect(extractPdfText(pdf, "song.pdf")).toBe("Compressed lyrics");
  });

  it("decodes a Type0 font's text through its ToUnicode CMap", () => {
    const cmap = [
      "/CIDInit /ProcSet findresource begin",
      "12 dict begin",
      "begincmap",
      "2 beginbfchar",
      "<0003> <0048>",
      "<0004> <0065>",
      "endbfchar",
      "1 beginbfrange",
      "<0005> <0007> <006C>",
      "endbfrange",
      "endcmap",
      "end end",
    ].join("\n");
    // Codes 0003 0004 0005 0005 0007 -> H e l l n
    const pdf = buildPdf([
      {
        num: 1,
        dict: "/Type /Page /Resources << /Font << /F1 2 0 R >> >> /Contents 4 0 R",
      },
      {
        num: 2,
        dict: "/Type /Font /Subtype /Type0 /BaseFont /Foo /Encoding /Identity-H /ToUnicode 3 0 R",
      },
      { num: 3, dict: "/Length 0", stream: cmap },
      {
        num: 4,
        dict: "/Length 0",
        stream: "BT\n/F1 12 Tf\n100 700 Td\n<0003000400050005> Tj\nET",
      },
    ]);
    expect(extractPdfText(pdf, "song.pdf")).toBe("Hell");
  });

  it("throws a clear error for a file with no PDF objects at all", () => {
    expect(() => extractPdfText(latin1ToU8("not a pdf"), "song.pdf")).toThrow(
      LyricsImportError,
    );
  });

  it("throws a clear error for a PDF with pages but no extractable text (e.g. a scan)", () => {
    const pdf = buildPdf([{ num: 1, dict: "/Type /Page" }]);
    expect(() => extractPdfText(pdf, "song.pdf")).toThrow(LyricsImportError);
  });

  it("does not mistake a /Type /Pages node for a page", () => {
    const pdf = buildPdf([{ num: 1, dict: "/Type /Pages /Kids []" }]);
    expect(() => extractPdfText(pdf, "song.pdf")).toThrow(LyricsImportError);
  });
});

describe("parseToUnicodeCMap", () => {
  it("parses a bfrange array form (per-code destination list)", () => {
    const cmap = parseToUnicodeCMap(
      "1 beginbfrange\n<0001> <0002> [<0041> <0042>]\nendbfrange",
    );
    expect(cmap.get(0x0001)).toBe("A");
    expect(cmap.get(0x0002)).toBe("B");
  });

  it("parses a bfchar destination spanning multiple UTF-16 code units (a ligature)", () => {
    const cmap = parseToUnicodeCMap(
      "1 beginbfchar\n<0001> <00660069>\nendbfchar",
    );
    expect(cmap.get(0x0001)).toBe("fi");
  });
});
