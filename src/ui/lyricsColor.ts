/**
 * Marks a span of lyrics (a word, a phrase, a whole verse) with a custom
 * font color and/or background color - originally a single fixed
 * "highlight", generalized on user request into independent color pickers
 * (similar to Word's Font Color and Text Highlight Color tools), and now
 * edited live in LyricsRichEditor's WebView rather than through raw markup
 * in a plain text field.
 *
 * Storage format: plain text (newlines kept literal, not `<br>`) with
 * `<span style="color:#RRGGBB;background-color:#RRGGBB;">text</span>`
 * wrapping colored runs - either color/background may be absent from the
 * style. This is never trusted as real HTML: every read goes through
 * `parseLyricsColors`, which only recognizes this exact tag shape and
 * treats anything else (including a `.seguelist` backup crafted by someone
 * else) as literal text - see `sanitizeLyricsHtml`, which is what's
 * actually injected into the editor's WebView.
 */
const HEX = "[0-9a-fA-F]{6}";
const OPEN_TAG_RE = new RegExp(
  `<span style="(?:color:#(${HEX});)?(?:background-color:#(${HEX});)?">`,
);
const CLOSE_TAG = "</span>";

export interface ColorSpan {
  /** 6-digit hex, no `#`. */
  color?: string;
  /** 6-digit hex, no `#`. */
  background?: string;
}

export interface LyricsColorSegment {
  text: string;
  span?: ColorSpan;
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Inverse of escapeText. `&amp;` last, mirroring lyricsImport.ts's decodeXmlEntities - the substitutions above can themselves introduce a literal "&". */
function unescapeText(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function spanFromMatch(match: RegExpMatchArray): ColorSpan {
  return { color: match[1] || undefined, background: match[2] || undefined };
}

/**
 * Splits marked-up lyrics into plain/colored runs. An unmatched opening tag
 * (a hand-edited or foreign `.seguelist` file) is treated as plain text -
 * including its own `<span...>` characters - rather than swallowing the
 * rest of the song or, worse, being trusted as real markup. A stray close
 * tag with nothing open is likewise left as plain text.
 */
export function parseLyricsColors(source: string): LyricsColorSegment[] {
  const segments: LyricsColorSegment[] = [];
  const tokenRe = new RegExp(`${OPEN_TAG_RE.source}|${CLOSE_TAG}`, "g");
  let cursor = 0;
  let openTagStart = -1;
  let openSpan: ColorSpan | null = null;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(source))) {
    const isClose = match[0] === CLOSE_TAG;
    if (openSpan) {
      if (isClose) {
        segments.push({
          text: unescapeText(source.slice(cursor, match.index)),
          span: openSpan,
        });
        openSpan = null;
        cursor = match.index + match[0].length;
      }
      // An open tag encountered while already inside a span is left as
      // literal text within that span - nesting isn't supported, which
      // keeps the grammar flat (and matches what the editor itself can
      // ever actually produce).
      continue;
    }
    if (isClose) continue; // stray close tag - leave as literal text

    if (match.index > cursor) {
      segments.push({ text: unescapeText(source.slice(cursor, match.index)) });
    }
    openTagStart = match.index;
    openSpan = spanFromMatch(match);
    cursor = match.index + match[0].length;
  }

  if (openSpan) {
    // No matching close tag - restore the dangling open tag's own text
    // too, rather than silently dropping it.
    segments.push({ text: unescapeText(source.slice(openTagStart)) });
  } else if (cursor < source.length) {
    segments.push({ text: unescapeText(source.slice(cursor)) });
  }

  return segments.filter((segment) => segment.text.length > 0);
}

/**
 * Groups parsed segments back into lines (one array of runs per line),
 * splitting on `\n` wherever it falls - including inside a colored segment
 * that spans a line break. Used where each source line needs to become its
 * own paragraph (docx export); the presentation screen instead renders the
 * segments in one wrapped Text, letting layout reflow them.
 */
export function splitIntoLines(
  segments: LyricsColorSegment[],
): LyricsColorSegment[][] {
  const lines: LyricsColorSegment[][] = [[]];
  for (const segment of segments) {
    segment.text.split("\n").forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part.length > 0) {
        lines[lines.length - 1].push({ text: part, span: segment.span });
      }
    });
  }
  return lines;
}

/** Rebuilds the canonical markup string from parsed segments - the inverse of parseLyricsColors. */
export function buildLyricsHtml(segments: LyricsColorSegment[]): string {
  return segments
    .map((segment) => {
      const text = escapeText(segment.text);
      if (!segment.span?.color && !segment.span?.background) return text;
      let style = "";
      if (segment.span.color) style += `color:#${segment.span.color};`;
      if (segment.span.background)
        style += `background-color:#${segment.span.background};`;
      return `<span style="${style}">${text}</span>`;
    })
    .join("");
}

/**
 * Parses then rebuilds `source` through the canonical grammar - the only
 * safe thing to inject as the WebView editor's initial content. `source`
 * may come from a `.seguelist` backup someone else made; this guarantees
 * whatever reaches the WebView's `innerHTML` is built entirely from our own
 * `<span style="...">` construction, never arbitrary markup that could run
 * a script.
 */
export function sanitizeLyricsHtml(source: string): string {
  return buildLyricsHtml(parseLyricsColors(source));
}

/** Converts plain imported lyrics text (from a picked .txt/.docx/.odt/.pdf file) into the storage format - just HTML-escaping, since plain text has no spans. */
export function plainTextToLyricsHtml(text: string): string {
  return escapeText(text);
}
