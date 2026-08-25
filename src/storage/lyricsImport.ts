import { strFromU8, unzipSync } from "fflate";
import type { File } from "expo-file-system";

/**
 * Reads lyrics out of a picked .txt/.docx/.odt file so a user with dozens of
 * lyric sheets already sitting in Drive/OneDrive/Files doesn't have to
 * retype each one. .docx and .odt are both a zip of XML parts underneath -
 * `word/document.xml` and `content.xml` respectively - so both go through
 * the same "strip the markup, keep paragraph/line breaks" extraction, just
 * pointed at different tag names.
 */
export class LyricsImportError extends Error {}

const SUPPORTED_EXTENSIONS = ["txt", "docx", "odt"] as const;
type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

function isSupportedExtension(extension: string): extension is SupportedExtension {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extension);
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&"); // last: the substitutions above can themselves introduce literal "&"
}

/** Escapes regex metacharacters in an XML tag name (namespace colons aren't special, kept for clarity). */
function tagPattern(tagName: string, selfClosing: boolean): RegExp {
  return selfClosing ? new RegExp(`<${tagName}\\b[^>]*/>`, "g") : new RegExp(`</${tagName}>`, "g");
}

/**
 * Turns one XML part's markup into plain text. `paragraphTags` end a line
 * (including when self-closed, i.e. an empty paragraph - which is how a
 * blank line between verses is represented), `breakTags` are in-paragraph
 * line breaks, `tabTags` are tab stops. Everything else is just structure
 * around the `<...>text</...>` runs and can be dropped once those are
 * resolved into whitespace.
 */
function extractTextFromXml(xml: string, paragraphTags: string[], breakTags: string[], tabTags: string[]): string {
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

function readZipPart(zip: Record<string, Uint8Array>, path: string, fileName: string, kind: string): string {
  const part = zip[path];
  if (!part) throw new LyricsImportError(`"${fileName}" doesn't look like a valid ${kind} file.`);
  return strFromU8(part);
}

function extractDocxText(zip: Record<string, Uint8Array>, fileName: string): string {
  const xml = readZipPart(zip, "word/document.xml", fileName, ".docx");
  return extractTextFromXml(xml, ["w:p"], ["w:br", "w:cr"], ["w:tab"]);
}

function extractOdtText(zip: Record<string, Uint8Array>, fileName: string): string {
  const xml = readZipPart(zip, "content.xml", fileName, ".odt");
  return extractTextFromXml(xml, ["text:p", "text:h"], ["text:line-break"], ["text:tab"]);
}

/** Normalizes line endings and collapses accidental long gaps, without flattening intentional blank lines between verses. */
function cleanLyrics(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface ImportedLyricsFile {
  name: string;
  lyrics: string;
}

/** Reads a picked .txt/.docx/.odt file into a song name (from the filename) and its lyrics text. */
export async function extractLyricsFromFile(file: File, fileName: string): Promise<ImportedLyricsFile> {
  const extension = extensionOf(fileName);
  if (!isSupportedExtension(extension)) {
    throw new LyricsImportError(`"${fileName}" isn't a .txt, .docx, or .odt file.`);
  }
  const name = fileName.slice(0, fileName.length - extension.length - 1).trim() || fileName;

  if (extension === "txt") {
    return { name, lyrics: cleanLyrics(await file.text()) };
  }

  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(await file.bytes());
  } catch {
    throw new LyricsImportError(`"${fileName}" couldn't be read as a .${extension} file.`);
  }

  const raw = extension === "docx" ? extractDocxText(zip, fileName) : extractOdtText(zip, fileName);
  return { name, lyrics: cleanLyrics(raw) };
}
