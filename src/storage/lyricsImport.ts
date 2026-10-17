import { strFromU8, unzipSync } from "fflate";
import { looksLikeChordPro, parseChordPro } from "@/ui/chordPro";
import { LyricsImportError } from "./lyricsImportError";
import { extractPdfText } from "./pdfTextExtract";

/**
 * Reads lyrics out of a picked .txt/.docx/.odt/.pdf file so a user with
 * dozens of lyric sheets already sitting in Drive/OneDrive/Files doesn't
 * have to retype each one. .docx and .odt are both a zip of XML parts
 * underneath - `word/document.xml` and `content.xml` respectively - so both
 * go through the same "strip the markup, keep paragraph/line breaks"
 * extraction, just pointed at different tag names. .pdf has no such
 * shortcut - see pdfTextExtract.ts for why and how.
 *
 * ChordPro (see ui/chordPro.ts) needs no choice from the user either way:
 * its own file extensions are read as text, and the text pulled out of ANY
 * supported file is checked for ChordPro syntax - a .txt, .docx or .pdf
 * chord sheet written in ChordPro imports with its chords too.
 */
export { LyricsImportError };

/** ChordPro's file extensions - all plain text. */
const CHORDPRO_EXTENSIONS = ["cho", "chordpro", "chopro", "crd", "pro"];
const SUPPORTED_EXTENSIONS = [
  "txt",
  "docx",
  "odt",
  "pdf",
  ...CHORDPRO_EXTENSIONS,
] as const;
type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

function isSupportedExtension(
  extension: string,
): extension is SupportedExtension {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extension);
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&amp;/g, "&"); // last: the substitutions above can themselves introduce literal "&"
}

/** Escapes regex metacharacters in an XML tag name (namespace colons aren't special, kept for clarity). */
function tagPattern(tagName: string, selfClosing: boolean): RegExp {
  return selfClosing
    ? new RegExp(`<${tagName}\\b[^>]*/>`, "g")
    : new RegExp(`</${tagName}>`, "g");
}

/**
 * Turns one XML part's markup into plain text. `paragraphTags` end a line
 * (including when self-closed, i.e. an empty paragraph - which is how a
 * blank line between verses is represented), `breakTags` are in-paragraph
 * line breaks, `tabTags` are tab stops. Everything else is just structure
 * around the `<...>text</...>` runs and can be dropped once those are
 * resolved into whitespace.
 */
function extractTextFromXml(
  xml: string,
  paragraphTags: string[],
  breakTags: string[],
  tabTags: string[],
): string {
  let text = xml;
  for (const tag of tabTags) text = text.replace(tagPattern(tag, true), "\t");
  for (const tag of breakTags) text = text.replace(tagPattern(tag, true), "\n");
  for (const tag of paragraphTags) {
    text = text.replace(tagPattern(tag, true), "\n");
    text = text.replace(tagPattern(tag, false), "\n");
  }
  text = text.replace(/<[^>]+>/g, "");
  return decodeXmlEntities(text);
}

function readZipPart(
  zip: Record<string, Uint8Array>,
  path: string,
  fileName: string,
  kind: string,
): string {
  const part = zip[path];
  if (!part)
    throw new LyricsImportError(
      `"${fileName}" doesn't look like a valid ${kind} file.`,
    );
  return strFromU8(part);
}

function extractDocxText(
  zip: Record<string, Uint8Array>,
  fileName: string,
): string {
  const xml = readZipPart(zip, "word/document.xml", fileName, ".docx");
  return extractTextFromXml(xml, ["w:p"], ["w:br", "w:cr"], ["w:tab"]);
}

function extractOdtText(
  zip: Record<string, Uint8Array>,
  fileName: string,
): string {
  const xml = readZipPart(zip, "content.xml", fileName, ".odt");
  return extractTextFromXml(
    xml,
    ["text:p", "text:h"],
    ["text:line-break"],
    ["text:tab"],
  );
}

/** Normalizes line endings and collapses accidental long gaps, without flattening intentional blank lines between verses. */
function cleanLyrics(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** One song read out of an imported file - plain-text lyrics, not yet in the rich-text storage format. */
export interface ImportedSong {
  name: string;
  lyrics: string;
  /** Paired 1:1 by line with `lyrics` (see ui/chords.ts); null when the file had none. */
  chords: string | null;
  durationSeconds: number | null;
  transposeSteps: number;
}

/**
 * The two reads extractSongsFromFile needs. expo-file-system's `File`
 * already has exactly this shape, so on a phone the picked file is passed
 * straight through; storage/pickedFile.web.ts adapts a browser `File` to it.
 */
export interface ReadableFile {
  text(): Promise<string>;
  bytes(): Promise<Uint8Array>;
}

async function extractText(
  file: ReadableFile,
  fileName: string,
  extension: SupportedExtension,
): Promise<string> {
  if (extension === "pdf") {
    return extractPdfText(await file.bytes(), fileName);
  }
  if (extension !== "docx" && extension !== "odt") {
    return file.text();
  }

  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(await file.bytes());
  } catch {
    throw new LyricsImportError(
      `"${fileName}" couldn't be read as a .${extension} file.`,
    );
  }
  return extension === "docx"
    ? extractDocxText(zip, fileName)
    : extractOdtText(zip, fileName);
}

/**
 * Reads a picked file into songs: usually one, named after the file, with
 * its text as lyrics. A ChordPro file (by extension or by content) brings
 * its chords, duration and transposition along, takes its name from
 * `{title}` when it has one, and can hold several songs (`{new_song}`).
 */
export async function extractSongsFromFile(
  file: ReadableFile,
  fileName: string,
): Promise<ImportedSong[]> {
  const extension = extensionOf(fileName);
  if (!isSupportedExtension(extension)) {
    throw new LyricsImportError(
      `"${fileName}" isn't a .txt, .docx, .odt, .pdf or ChordPro file.`,
    );
  }
  const name =
    fileName.slice(0, fileName.length - extension.length - 1).trim() ||
    fileName;
  const text = cleanLyrics(await extractText(file, fileName, extension));

  if (CHORDPRO_EXTENSIONS.includes(extension) || looksLikeChordPro(text)) {
    const songs = parseChordPro(text);
    if (songs.length > 0) {
      return songs.map((song, index) => ({
        name:
          song.title ?? (songs.length > 1 ? `${name} (${index + 1})` : name),
        lyrics: song.lyrics,
        chords: song.chords || null,
        durationSeconds: song.durationSeconds,
        transposeSteps: song.transposeSteps,
      }));
    }
  }

  return [
    {
      name,
      lyrics: text,
      chords: null,
      durationSeconds: null,
      transposeSteps: 0,
    },
  ];
}
