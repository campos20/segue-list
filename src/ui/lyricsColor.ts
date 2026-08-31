/**
 * Marks a span of lyrics (a word, a phrase, a whole verse) with a custom
 * font color and/or background color - originally built for flagging
 * backing-vocal lines with a single fixed highlight, generalized on user
 * request into independent color pickers (similar to Word's Font Color and
 * Text Highlight Color tools) - by wrapping it inline in the lyrics text
 * itself, rather than a separate offset-based data structure. A separate
 * `{start, end}` list would silently drift out of sync the moment the
 * surrounding lyrics text is edited; markers that live in the text move
 * with it by construction.
 *
 * Markup: `{{BG,FG}}text{{/}}`, where BG/FG are 6-digit hex colors with no
 * `#` and either may be empty (`{{FBBF24,}}` = background only, `{{,1C1400}}`
 * = font color only). Double curly braces are vanishingly unlikely to
 * appear in real lyrics or chord charts, unlike a single brace (`{C}` chord
 * notation) or parens (ad-libs).
 */
const OPEN_TAG_RE = /\{\{([0-9a-fA-F]{6})?,([0-9a-fA-F]{6})?\}\}/;
const OPEN_TAG_AT_START_RE = new RegExp(`^${OPEN_TAG_RE.source}`);
const OPEN_TAG_AT_END_RE = new RegExp(`${OPEN_TAG_RE.source}$`);
const CLOSE_TAG = "{{/}}";
// "{{" + 6-digit hex + "," + 6-digit hex + "}}"
const MAX_OPEN_TAG_LENGTH = 2 + 6 + 1 + 6 + 2;

export interface ColorSpan {
  /** 6-digit hex, no `#`. */
  background?: string;
  /** 6-digit hex, no `#`. */
  color?: string;
}

export interface LyricsColorSegment {
  text: string;
  span?: ColorSpan;
}

function makeOpenTag(span: ColorSpan): string {
  return `{{${span.background ?? ""},${span.color ?? ""}}}`;
}

function spanFromMatch(match: RegExpMatchArray): ColorSpan {
  return { background: match[1] || undefined, color: match[2] || undefined };
}

/**
 * Splits marked-up lyrics into plain/colored runs. An unmatched opening tag
 * (the user deleted its closer, or edited around it) is treated as plain
 * text - including its own `{{...}}` characters - rather than swallowing
 * the rest of the song. A stray close tag with nothing open is likewise
 * left as plain text.
 */
export function parseLyricsColors(source: string): LyricsColorSegment[] {
  const segments: LyricsColorSegment[] = [];
  const tokenRe = new RegExp(`${OPEN_TAG_RE.source}|\\{\\{/\\}\\}`, "g");
  let cursor = 0;
  let openTagStart = -1;
  let openSpan: ColorSpan | null = null;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(source))) {
    const isClose = match[0] === CLOSE_TAG;
    if (openSpan) {
      if (isClose) {
        segments.push({
          text: source.slice(cursor, match.index),
          span: openSpan,
        });
        openSpan = null;
        cursor = match.index + match[0].length;
      }
      // An open tag encountered while already inside a span is left as
      // literal text within that span - nesting isn't supported, which
      // keeps the grammar flat.
      continue;
    }
    if (isClose) continue; // stray close tag - leave as literal text

    if (match.index > cursor) {
      segments.push({ text: source.slice(cursor, match.index) });
    }
    openTagStart = match.index;
    openSpan = spanFromMatch(match);
    cursor = match.index + match[0].length;
  }

  if (openSpan) {
    // No matching close tag - restore the dangling open tag's own text
    // too, rather than silently dropping it.
    segments.push({ text: source.slice(openTagStart) });
  } else if (cursor < source.length) {
    segments.push({ text: source.slice(cursor) });
  }

  return segments.filter((segment) => segment.text.length > 0);
}

/**
 * Groups parsed segments back into lines (one array of runs per line),
 * splitting on `\n` wherever it falls - including inside a colored segment
 * that spans a line break. Used where each source line needs to become its
 * own paragraph (docx export); the presentation screen and preview drawer
 * instead render the segments in one wrapped Text, letting layout reflow them.
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

/**
 * The color span exactly covering `[start, end)`, if the selection lines up
 * precisely with an existing span's boundaries - markers included or
 * excluded either way. Used to pre-fill the color picker when the user
 * re-selects an already-colored phrase, so changing just one of font/
 * background color doesn't require re-picking the other from scratch.
 */
export function getSpanAt(
  text: string,
  start: number,
  end: number,
): ColorSpan | null {
  if (start >= end) return null;

  const windowStart = Math.max(0, start - MAX_OPEN_TAG_LENGTH);
  const openBefore = OPEN_TAG_AT_END_RE.exec(text.slice(windowStart, start));
  if (openBefore && text.slice(end, end + CLOSE_TAG.length) === CLOSE_TAG) {
    return spanFromMatch(openBefore);
  }

  const openAtStart = OPEN_TAG_AT_START_RE.exec(text.slice(start));
  if (
    openAtStart &&
    text.slice(end - CLOSE_TAG.length, end) === CLOSE_TAG &&
    start + openAtStart[0].length <= end - CLOSE_TAG.length
  ) {
    return spanFromMatch(openAtStart);
  }

  return null;
}

/**
 * Applies `span` to the `[start, end)` selection in `text`: if the
 * selection exactly bounds an existing span (markers included or
 * excluded), that span's tag is replaced with the new one in place;
 * otherwise the raw selection is wrapped in a new tag. Passing `span: null`
 * clears color instead - stripping an exactly-bound existing span's
 * markers, or doing nothing to a plain selection. Returns `text` unchanged
 * for an empty (cursor-only) selection.
 */
export function applyColorAt(
  text: string,
  start: number,
  end: number,
  span: ColorSpan | null,
): string {
  if (start >= end) return text;

  // Selection is exactly the inner content of an existing span, markers
  // excluded (an open tag ends right where the selection starts, a close
  // tag starts right where it ends).
  const windowStart = Math.max(0, start - MAX_OPEN_TAG_LENGTH);
  const openBefore = OPEN_TAG_AT_END_RE.exec(text.slice(windowStart, start));
  const closeAfter = text.slice(end, end + CLOSE_TAG.length) === CLOSE_TAG;
  if (openBefore && closeAfter) {
    const tagStart = start - openBefore[0].length;
    return (
      text.slice(0, tagStart) +
      (span ? makeOpenTag(span) : "") +
      text.slice(start, end) +
      (span ? CLOSE_TAG : "") +
      text.slice(end + CLOSE_TAG.length)
    );
  }

  // Selection exactly bounds an existing span, markers included (starts
  // with its open tag, ends with the matching close tag).
  const openAtStart = OPEN_TAG_AT_START_RE.exec(text.slice(start));
  const closeAtEnd = text.slice(end - CLOSE_TAG.length, end) === CLOSE_TAG;
  if (openAtStart && closeAtEnd) {
    const innerStart = start + openAtStart[0].length;
    const innerEnd = end - CLOSE_TAG.length;
    if (innerStart <= innerEnd) {
      const inner = text.slice(innerStart, innerEnd);
      return (
        text.slice(0, start) +
        (span ? makeOpenTag(span) + inner + CLOSE_TAG : inner) +
        text.slice(end)
      );
    }
  }

  // Plain selection: nothing to clear, or wrap it in a brand new span.
  if (!span) return text;
  return (
    text.slice(0, start) +
    makeOpenTag(span) +
    text.slice(start, end) +
    CLOSE_TAG +
    text.slice(end)
  );
}
