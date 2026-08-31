import { strToU8, zipSync } from "fflate";
import { File, Paths } from "expo-file-system";
import type { SongManifest } from "@/types/song";
import {
  parseLyricsColors,
  splitIntoLines,
  type ColorSpan,
} from "@/ui/lyricsColor";
import { isFileSystemAvailable } from "./paths";

/**
 * Writes a setlist (or the whole library) out as one .docx: a title page
 * followed by every song as a heading and its lyrics, one song per printed
 * page - a portable lyric binder that opens in Word, Google Docs, or
 * LibreOffice on any device, not just this app.
 *
 * A .docx is a zip of a handful of XML parts. Rather than pull in a full
 * document-building library for what's plain text underneath, this writes
 * the minimal set of parts a reader actually requires
 * (`[Content_Types].xml`, `_rels/.rels`, `word/document.xml`) directly as
 * templates - the same "hand-roll the narrow XML, zip it with fflate"
 * approach as the reverse direction in lyricsImport.ts.
 */
export class DocxExportError extends Error {}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Monospace, matching SongDetailScreen's lyrics editor - keeps chord charts
// and any hand-spaced alignment intact when opened outside the app.
const LYRICS_RUN_PROPS = `<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>`;
const NO_LYRICS_RUN_PROPS = `<w:i/><w:color w:val="888888"/>`;

/**
 * A colored span's font/background color shouldn't leak its raw
 * `<span style="...">` markup into an exported document - it should read as
 * visibly colored there too, the same choice as picked in the app.
 */
function colorRunProps(span: ColorSpan | undefined): string {
  if (!span) return LYRICS_RUN_PROPS;
  const color = span.color ? `<w:color w:val="${span.color}"/>` : "";
  const shading = span.background
    ? `<w:shd w:val="clear" w:fill="${span.background}"/>`
    : "";
  return `${LYRICS_RUN_PROPS}${color}${shading}`;
}

function run(text: string, runProps: string): string {
  return `<w:r><w:rPr>${runProps}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function textParagraph(
  text: string,
  runProps: string,
  paragraphProps = "",
): string {
  if (text.length === 0) return "<w:p/>";
  const pPr = paragraphProps ? `<w:pPr>${paragraphProps}</w:pPr>` : "";
  return `<w:p>${pPr}${run(text, runProps)}</w:p>`;
}

/**
 * One `<w:p>` per line, so a blank line between verses stays a blank line -
 * and, within a line, one `<w:r>` per colored/plain run, so a colored
 * phrase renders with its own font/background color instead of showing its
 * raw `<span style="...">` markup.
 */
function lyricsParagraphs(lyrics: string): string {
  const lines = splitIntoLines(parseLyricsColors(lyrics));
  return lines
    .map((line) => {
      if (line.length === 0) return "<w:p/>";
      const runs = line
        .map((segment) => run(segment.text, colorRunProps(segment.span)))
        .join("");
      return `<w:p>${runs}</w:p>`;
    })
    .join("");
}

function songSection(
  song: SongManifest,
  isFirst: boolean,
  noLyricsLabel: string,
): string {
  const pageBreak = isFirst
    ? ""
    : `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
  const heading = textParagraph(
    song.name,
    `<w:b/><w:sz w:val="32"/>`,
    `<w:spacing w:before="240" w:after="120"/>`,
  );
  const lyrics = song.lyrics?.trim()
    ? lyricsParagraphs(song.lyrics)
    : textParagraph(noLyricsLabel, NO_LYRICS_RUN_PROPS);
  return pageBreak + heading + lyrics;
}

function buildDocumentXml(
  title: string,
  songs: SongManifest[],
  noLyricsLabel: string,
): string {
  const titleParagraph = textParagraph(
    title,
    `<w:b/><w:sz w:val="44"/>`,
    `<w:jc w:val="center"/><w:spacing w:after="480"/>`,
  );
  const sections = songs
    .map((song, index) => songSection(song, index === 0, noLyricsLabel))
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${titleParagraph}${sections}<w:sectPr/></w:body></w:document>`
  );
}

const CONTENT_TYPES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
  `</Types>`;

const RELS_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
  `</Relationships>`;

/** Filename for a docx of `label`, e.g. "Friday Night" -> "friday-night.docx". Mirrors bundleFileName. */
export function docxFileName(label: string): string {
  const slug =
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "segue-list";
  return `${slug}.docx`;
}

/** Writes `songs` as one .docx into the cache directory, where it can be handed to the share sheet. */
export function writeSongsAsDocxToCache(
  songs: SongManifest[],
  title: string,
  noLyricsLabel: string,
): File {
  if (!isFileSystemAvailable) {
    throw new DocxExportError("Exporting isn't supported in this environment.");
  }
  const bytes = zipSync({
    "[Content_Types].xml": strToU8(CONTENT_TYPES_XML),
    "_rels/.rels": strToU8(RELS_XML),
    "word/document.xml": strToU8(buildDocumentXml(title, songs, noLyricsLabel)),
  });

  const destination = new File(Paths.cache, docxFileName(title));
  if (destination.exists) destination.delete();
  destination.write(bytes);
  return destination;
}
