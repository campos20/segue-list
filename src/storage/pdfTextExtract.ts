import { inflateSync, unzlibSync } from "fflate";
import { LyricsImportError } from "./lyricsImportError";

/**
 * A from-scratch, minimal PDF text extractor - no pdfjs-dist or any other
 * PDF library. pdfjs-dist (and everything built on it, e.g. pdf-parse,
 * unpdf) assumes a DOM (`DOMMatrix`/`Path2D`/`ImageData` at import time) and
 * a Web Worker, neither of which Hermes provides; the only PDF-capable
 * alternative that runs on React Native without those is a native module
 * requiring a dev-client build, which this project doesn't use (see
 * AGENTS.md). So: this file reads just enough of the PDF format to pull
 * plain text out of the common case - a single/simple font per run,
 * FlateDecode-compressed content streams, WinAnsiEncoding or a Type0/CID
 * font with an embedded ToUnicode CMap. That covers the vast majority of
 * "export to PDF" output from word processors, which is what a lyric sheet
 * actually is. It is not a general PDF renderer: encrypted PDFs, scanned
 * (image-only) pages, and fonts with neither a standard encoding nor a
 * ToUnicode CMap all fail with a clear error rather than producing garbled
 * text - same philosophy as the .docx/.odt extraction next to this file.
 */

const LATIN1_CHUNK = 0x8000;

/** Bytes and text share indices 1:1 - PDF structural syntax is pure ASCII, so a byte offset is always a string index and vice versa. */
function bytesToLatin1(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += LATIN1_CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + LATIN1_CHUNK));
  }
  return out;
}

function latin1ToBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
  return bytes;
}

interface PdfObject {
  start: number; // byte/char offset right after "obj" - where the dict/stream begins
  end: number; // offset of the matching "endobj"
}

/**
 * Finds every `N G obj ... endobj` in the file, keyed by object number. A
 * proper PDF reader walks the xref table/stream; this instead brute-force
 * scans for objects in file order; the later object with a given number
 * wins, which coincidentally matches how an incrementally-updated PDF's
 * later revision of an object is the correct one to use anyway. This is a
 * standard resilience trick for lightweight PDF readers - it tolerates a
 * missing/stale xref table, which a strict PDF library would refuse to open.
 */
function scanObjects(text: string): Map<number, PdfObject> {
  const objects = new Map<number, PdfObject>();
  const re = /(\d+)\s+\d+\s+obj\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const num = Number(match[1]);
    const start = re.lastIndex;
    const end = text.indexOf("endobj", start);
    if (end === -1) continue;
    objects.set(num, { start, end });
    re.lastIndex = end;
  }
  return objects;
}

function bodyOf(text: string, obj: PdfObject): string {
  return text.slice(obj.start, obj.end);
}

/** Finds the `<< ... >>` dictionary that starts at or after `keyword` within `body`, honoring nesting depth. */
function findNestedDict(body: string, keyword: string): string | null {
  const keyIdx = body.indexOf(keyword);
  if (keyIdx === -1) return null;
  const openIdx = body.indexOf("<<", keyIdx);
  if (openIdx === -1) return null;
  let depth = 0;
  for (let i = openIdx; i < body.length - 1;) {
    if (body[i] === "<" && body[i + 1] === "<") {
      depth++;
      i += 2;
      continue;
    }
    if (body[i] === ">" && body[i + 1] === ">") {
      depth--;
      i += 2;
      if (depth === 0) return body.slice(openIdx + 2, i - 2);
      continue;
    }
    i++;
  }
  return null;
}

/** A single `N G R` indirect reference, or `null` for a direct/absent value. */
function indirectRef(body: string, key: string): number | null {
  const match = body.match(new RegExp(`${key}\\s+(\\d+)\\s+\\d+\\s+R`));
  return match ? Number(match[1]) : null;
}

/** `/Contents` is either one indirect reference or an array of them. */
function contentsRefs(body: string): number[] {
  const single = indirectRef(body, "/Contents");
  if (single !== null) return [single];
  const arrayMatch = body.match(/\/Contents\s*\[([^\]]*)\]/);
  if (!arrayMatch) return [];
  return [...arrayMatch[1].matchAll(/(\d+)\s+\d+\s+R/g)].map((m) =>
    Number(m[1]),
  );
}

function isFlateEncoded(body: string): boolean {
  return /\/Filter\s*(\/FlateDecode\b|\[[^\]]*\/FlateDecode\b)/.test(body);
}

function hasAnyFilter(body: string): boolean {
  return /\/Filter\b/.test(body);
}

/** Extracts an object's raw `stream ... endstream` payload as bytes, decompressing if it's Flate-encoded. Returns `null` for a filter this extractor doesn't understand (e.g. an embedded image), rather than garbage. */
function streamBytes(
  bytes: Uint8Array,
  text: string,
  obj: PdfObject,
): Uint8Array | null {
  const body = bodyOf(text, obj);
  const streamRel = body.indexOf("stream");
  if (streamRel === -1) return null;
  const endstreamRel = body.indexOf("endstream", streamRel);
  if (endstreamRel === -1) return null;

  let dataStart = obj.start + streamRel + "stream".length;
  // Per spec the keyword is followed by CRLF or a bare LF, never a bare CR.
  if (bytes[dataStart] === 0x0d) dataStart++;
  if (bytes[dataStart] === 0x0a) dataStart++;
  let dataEnd = obj.start + endstreamRel;
  while (
    dataEnd > dataStart &&
    (bytes[dataEnd - 1] === 0x0a || bytes[dataEnd - 1] === 0x0d)
  )
    dataEnd--;

  const raw = bytes.subarray(dataStart, dataEnd);
  if (!isFlateEncoded(body)) return hasAnyFilter(body) ? null : raw;
  try {
    return unzlibSync(raw);
  } catch {
    try {
      return inflateSync(raw);
    } catch {
      return null;
    }
  }
}

// WinAnsiEncoding (PDF spec Annex D) matches Windows-1252, which differs
// from plain Latin-1 only in 0x80-0x9F - everywhere else a byte's value is
// already its Unicode code point. Slots with no WinAnsi character stay
// unmapped (rendered as a space).
const WIN_ANSI_HIGH: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e,
  0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6,
  0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152,
  0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c,
  0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a,
  0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
}; // prettier-ignore

function decodeWinAnsiByte(byte: number): string {
  if (byte >= 0x80 && byte <= 0x9f) {
    const code = WIN_ANSI_HIGH[byte];
    return code === undefined ? " " : String.fromCodePoint(code);
  }
  return String.fromCharCode(byte);
}

type FontDecoder = (raw: string) => string;

/** Simple (1-byte) fonts: WinAnsiEncoding covers this app's Latin-script content (English and Portuguese, incl. all its diacritics) without needing the font's actual glyph names. */
function simpleFontDecoder(): FontDecoder {
  return (raw) => {
    let out = "";
    for (let i = 0; i < raw.length; i++)
      out += decodeWinAnsiByte(raw.charCodeAt(i));
    return out;
  };
}

/** Decodes a ToUnicode CMap's hex value: consecutive UTF-16BE code units, concatenated as-is (this also reconstructs surrogate pairs correctly, since JS strings are UTF-16 already). */
function utf16beHexToString(hex: string): string {
  let out = "";
  for (let i = 0; i + 4 <= hex.length; i += 4)
    out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  return out;
}

/** Parses a `/ToUnicode` CMap stream's `bfchar`/`bfrange` blocks into a code -> Unicode string map. */
function parseToUnicodeCMap(cmapText: string): Map<number, string> {
  const map = new Map<number, string>();

  for (const block of cmapText.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(
      /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g,
    )) {
      map.set(parseInt(pair[1], 16), utf16beHexToString(pair[2]));
    }
  }

  for (const block of cmapText.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    // Array form: <lo> <hi> [ <dst0> <dst1> ... ]
    for (const range of block[1].matchAll(
      /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([^\]]*)\]/g,
    )) {
      const lo = parseInt(range[1], 16);
      const dsts = [...range[3].matchAll(/<([0-9a-fA-F]+)>/g)];
      dsts.forEach((dst, i) => map.set(lo + i, utf16beHexToString(dst[1])));
    }
    // Single-value form: <lo> <hi> <dst> - dst's last code unit increments per code.
    for (const range of block[1].matchAll(
      /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g,
    )) {
      const lo = parseInt(range[1], 16);
      const hi = parseInt(range[2], 16);
      const dstHex = range[3];
      const prefix = dstHex.slice(0, -4);
      const base = parseInt(dstHex.slice(-4), 16);
      for (let code = lo; code <= hi; code++) {
        map.set(
          code,
          utf16beHexToString(
            prefix + (base + (code - lo)).toString(16).padStart(4, "0"),
          ),
        );
      }
    }
  }

  return map;
}

/** Type0 (composite) fonts: 2-byte codes, decoded through the font's own ToUnicode CMap - there's no standard encoding to fall back on for an arbitrary embedded/subset font. */
function type0FontDecoder(cmap: Map<number, string>): FontDecoder {
  return (raw) => {
    let out = "";
    for (let i = 0; i + 1 < raw.length; i += 2) {
      const code = (raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1);
      out += cmap.get(code) ?? "�";
    }
    return out;
  };
}

/** Resolves every font a page's `/Resources /Font` dict names to a decoder, keyed by the resource name used in content-stream `Tf` operators (e.g. `F1`). */
function resolveFontDecoders(
  bytes: Uint8Array,
  text: string,
  objects: Map<number, PdfObject>,
  pageBody: string,
): Map<string, FontDecoder> {
  const decoders = new Map<string, FontDecoder>();
  const resourcesDict = findNestedDict(pageBody, "/Resources");
  if (!resourcesDict) return decoders;
  const fontDict = findNestedDict(resourcesDict, "/Font");
  if (!fontDict) return decoders;

  for (const entry of fontDict.matchAll(/\/(\S+)\s+(\d+)\s+\d+\s+R/g)) {
    const [, resourceName, fontObjNumStr] = entry;
    const fontObj = objects.get(Number(fontObjNumStr));
    if (!fontObj) continue;
    const fontBody = bodyOf(text, fontObj);

    if (/\/Subtype\s*\/Type0\b/.test(fontBody)) {
      const toUnicodeRef = indirectRef(fontBody, "/ToUnicode");
      const toUnicodeObj = toUnicodeRef ? objects.get(toUnicodeRef) : undefined;
      const cmapBytes = toUnicodeObj
        ? streamBytes(bytes, text, toUnicodeObj)
        : null;
      if (cmapBytes) {
        const cmap = parseToUnicodeCMap(bytesToLatin1(cmapBytes));
        decoders.set(resourceName, type0FontDecoder(cmap));
      }
      // No ToUnicode: this font's codes can't be decoded reliably - leave
      // it unmapped so its text is skipped rather than turned into noise.
    } else {
      decoders.set(resourceName, simpleFontDecoder());
    }
  }

  return decoders;
}

function readLiteralString(
  text: string,
  start: number,
): { value: string; end: number } {
  let i = start + 1;
  let depth = 1;
  let out = "";
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (ch === "\\") {
      const next = text[i + 1];
      if (next === "n") { out += "\n"; i += 2; }
      else if (next === "r") { out += "\r"; i += 2; }
      else if (next === "t") { out += "\t"; i += 2; }
      else if (next === "b") { out += "\b"; i += 2; }
      else if (next === "f") { out += "\f"; i += 2; }
      else if (next === "(") { out += "("; i += 2; }
      else if (next === ")") { out += ")"; i += 2; }
      else if (next === "\\") { out += "\\"; i += 2; }
      else if (next === "\n") { i += 2; } // line-continuation, drop
      else if (next === "\r") { i += text[i + 2] === "\n" ? 3 : 2; }
      else if (next >= "0" && next <= "7") {
        let oct = "";
        let j = i + 1;
        while (j < text.length && oct.length < 3 && text[j] >= "0" && text[j] <= "7") {
          oct += text[j];
          j++;
        }
        out += String.fromCharCode(parseInt(oct, 8) & 0xff);
        i = j;
      } else { out += next ?? ""; i += 2; }
      continue;
    }
    if (ch === "(") { depth++; out += ch; i++; continue; }
    if (ch === ")") {
      depth--;
      i++;
      if (depth === 0) break;
      out += ch;
      continue;
    }
    out += ch;
    i++;
  } // prettier-ignore
  return { value: out, end: i };
}

function readHexString(
  text: string,
  start: number,
): { value: string; end: number } {
  const closeIdx = text.indexOf(">", start);
  const end = closeIdx === -1 ? text.length : closeIdx;
  const hex = text.slice(start + 1, end).replace(/\s+/g, "");
  const padded = hex.length % 2 === 1 ? hex + "0" : hex;
  let out = "";
  for (let i = 0; i < padded.length; i += 2)
    out += String.fromCharCode(parseInt(padded.slice(i, i + 2), 16) || 0);
  return { value: out, end: end + 1 };
}

/** A word-gap threshold in the ~1000-units-per-em text space `TJ` numbers are expressed in - tuned to catch a real space between words without splitting normally-kerned letters within one. */
const TJ_WORD_GAP_THRESHOLD = -100;

/**
 * Walks a decompressed content stream's operators, extracting the text
 * shown by `Tj`/`'`/`"`/`TJ`, decoded through whichever font was last
 * selected by `Tf`. `Td`/`TD`/`T*`/`Tm` (anything that repositions the text
 * cursor) is treated as a line break - accurate enough for a lyric sheet's
 * simple, single-column layout, not a general-purpose reflow.
 */
function extractPageText(
  content: string,
  fontDecoders: Map<string, FontDecoder>,
): string {
  let out = "";
  let currentFont: FontDecoder | null = null;
  let atLineStart = true;
  let pendingStrings: string[] = [];
  let pendingNames: string[] = [];

  function newline() {
    if (!atLineStart) {
      out += "\n";
      atLineStart = true;
    }
  }

  function show(raw: string) {
    if (!currentFont) return;
    const decoded = currentFont(raw);
    if (decoded.trim().length === 0 && atLineStart) return;
    out += decoded;
    atLineStart = false;
  }

  let i = 0;
  while (i < content.length) {
    const ch = content[i];

    if (ch === "(") {
      const { value, end } = readLiteralString(content, i);
      pendingStrings.push(value);
      i = end;
      continue;
    }
    if (ch === "<" && content[i + 1] !== "<") {
      const { value, end } = readHexString(content, i);
      pendingStrings.push(value);
      i = end;
      continue;
    }
    if (ch === "/") {
      const match = /\/[^\s/()<>[\]]+/.exec(content.slice(i));
      const name = match ? match[0].slice(1) : "";
      pendingNames.push(name);
      i += match ? match[0].length : 1;
      continue;
    }
    if (ch === "[") {
      // TJ's operand array - handled inline below via a dedicated scan, so
      // just record where it starts and let the "TJ" operator branch consume it.
      const arrEnd = content.indexOf("]", i);
      const arrText = content.slice(i, arrEnd === -1 ? content.length : arrEnd);
      pendingStrings.push(arrText); // stashed raw, only meaningful to TJ below
      i = arrEnd === -1 ? content.length : arrEnd + 1;
      continue;
    }

    const opMatch = /^[A-Za-z'"*]+/.exec(content.slice(i));
    if (opMatch) {
      const op = opMatch[0];
      i += op.length;

      if (op === "BT") {
        atLineStart = true;
      } else if (op === "Tf") {
        const name = pendingNames[pendingNames.length - 1];
        currentFont = (name && fontDecoders.get(name)) || null;
      } else if (op === "Td" || op === "TD" || op === "Tm" || op === "T*") {
        newline();
      } else if (op === "Tj") {
        show(pendingStrings[pendingStrings.length - 1] ?? "");
      } else if (op === "'") {
        newline();
        show(pendingStrings[pendingStrings.length - 1] ?? "");
      } else if (op === '"') {
        newline();
        show(pendingStrings[pendingStrings.length - 1] ?? "");
      } else if (op === "TJ") {
        const arrText = pendingStrings[pendingStrings.length - 1] ?? "";
        let j = 0;
        while (j < arrText.length) {
          if (arrText[j] === "(") {
            const { value, end } = readLiteralString(arrText, j);
            show(value);
            j = end;
          } else if (arrText[j] === "<") {
            const { value, end } = readHexString(arrText, j);
            show(value);
            j = end;
          } else {
            const numMatch = /^-?\d+(\.\d+)?/.exec(arrText.slice(j));
            if (numMatch) {
              if (Number(numMatch[0]) <= TJ_WORD_GAP_THRESHOLD && !atLineStart)
                out += " ";
              j += numMatch[0].length;
            } else {
              j++;
            }
          }
        }
      } else if (op === "ET") {
        newline();
      }

      pendingStrings = [];
      pendingNames = [];
      continue;
    }

    i++;
  }

  return out;
}

/** Reads a picked .pdf file's plain text, page by page, in file order. */
export function extractPdfText(bytes: Uint8Array, fileName: string): string {
  const text = bytesToLatin1(bytes);
  const objects = scanObjects(text);
  if (objects.size === 0)
    throw new LyricsImportError(
      `"${fileName}" doesn't look like a valid PDF file.`,
    );

  const pageNums = [...objects.keys()]
    .filter((num) =>
      /\/Type\s*\/Page(?!s)\b/.test(bodyOf(text, objects.get(num)!)),
    )
    .sort((a, b) => a - b);

  if (pageNums.length === 0)
    throw new LyricsImportError(
      `"${fileName}" doesn't have any pages this app can read.`,
    );

  const pageTexts: string[] = [];
  for (const pageNum of pageNums) {
    const pageObj = objects.get(pageNum)!;
    const pageBody = bodyOf(text, pageObj);
    const fontDecoders = resolveFontDecoders(bytes, text, objects, pageBody);

    let pageContent = "";
    for (const contentNum of contentsRefs(pageBody)) {
      const contentObj = objects.get(contentNum);
      if (!contentObj) continue;
      const decompressed = streamBytes(bytes, text, contentObj);
      if (!decompressed) continue;
      pageContent += bytesToLatin1(decompressed) + "\n";
    }

    const pageText = extractPageText(pageContent, fontDecoders).trim();
    if (pageText) pageTexts.push(pageText);
  }

  const combined = pageTexts.join("\n\n").trim();
  if (!combined)
    throw new LyricsImportError(
      `"${fileName}" doesn't have any extractable text - it may be a scanned image rather than real text.`,
    );
  return combined;
}

// Re-exported for tests only.
export const __testing = {
  bytesToLatin1,
  latin1ToBytes,
  scanObjects,
  parseToUnicodeCMap,
};
