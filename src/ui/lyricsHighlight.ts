/**
 * Marks a span of lyrics (a word, a phrase, a whole verse) as highlighted -
 * originally for flagging backing-vocal lines - by wrapping it inline in
 * the lyrics text itself, rather than a separate offset-based data
 * structure. A separate `{start, end}` list would silently drift out of
 * sync the moment the surrounding lyrics text is edited; markers that live
 * in the text move with it by construction. Double curly braces are
 * vanishingly unlikely to appear in real lyrics or chord charts, unlike a
 * single brace (`{C}` chord notation) or parens (ad-libs).
 */
export const HIGHLIGHT_OPEN = "{{";
export const HIGHLIGHT_CLOSE = "}}";

export interface LyricsSegment {
  text: string;
  highlighted: boolean;
}

/**
 * Splits marked-up lyrics into plain/highlighted runs. An unmatched opening
 * marker (the user deleted its closer, or edited around it) is treated as
 * plain text rather than swallowing the rest of the song.
 */
export function parseLyricsHighlights(source: string): LyricsSegment[] {
  const segments: LyricsSegment[] = [];
  let rest = source;

  while (rest.length > 0) {
    const openIndex = rest.indexOf(HIGHLIGHT_OPEN);
    if (openIndex === -1) {
      segments.push({ text: rest, highlighted: false });
      break;
    }
    if (openIndex > 0) {
      segments.push({ text: rest.slice(0, openIndex), highlighted: false });
    }

    const afterOpen = rest.slice(openIndex + HIGHLIGHT_OPEN.length);
    const closeIndex = afterOpen.indexOf(HIGHLIGHT_CLOSE);
    if (closeIndex === -1) {
      segments.push({ text: rest.slice(openIndex), highlighted: false });
      break;
    }

    segments.push({
      text: afterOpen.slice(0, closeIndex),
      highlighted: true,
    });
    rest = afterOpen.slice(closeIndex + HIGHLIGHT_CLOSE.length);
  }

  return segments;
}

export interface LyricsOverlaySegment {
  text: string;
  kind: "plain" | "marker" | "highlighted";
}

/**
 * Like `parseLyricsHighlights`, but keeps the `{{`/`}}` markers themselves
 * as their own "marker" segments instead of stripping them - for the
 * editor's WYSIWYG overlay, where an invisible-text TextInput sits exactly
 * on top of this rendering and needs every character (markers included) to
 * be present in both layers, or the two would wrap differently and the
 * cursor would drift out of alignment with what's on screen. The markers
 * are rendered dimmed rather than truly hidden - genuinely hiding them
 * would only be safe with a real rich-text editor, not a position overlay.
 */
export function parseLyricsForOverlay(source: string): LyricsOverlaySegment[] {
  const segments: LyricsOverlaySegment[] = [];
  let rest = source;

  while (rest.length > 0) {
    const openIndex = rest.indexOf(HIGHLIGHT_OPEN);
    if (openIndex === -1) {
      segments.push({ text: rest, kind: "plain" });
      break;
    }
    if (openIndex > 0) {
      segments.push({ text: rest.slice(0, openIndex), kind: "plain" });
    }

    const afterOpen = rest.slice(openIndex + HIGHLIGHT_OPEN.length);
    const closeIndex = afterOpen.indexOf(HIGHLIGHT_CLOSE);
    if (closeIndex === -1) {
      segments.push({ text: rest.slice(openIndex), kind: "plain" });
      break;
    }

    segments.push({ text: HIGHLIGHT_OPEN, kind: "marker" });
    segments.push({
      text: afterOpen.slice(0, closeIndex),
      kind: "highlighted",
    });
    segments.push({ text: HIGHLIGHT_CLOSE, kind: "marker" });
    rest = afterOpen.slice(closeIndex + HIGHLIGHT_CLOSE.length);
  }

  return segments;
}

/**
 * Groups parsed segments back into lines (one array of runs per line),
 * splitting on `\n` wherever it falls - including inside a highlighted
 * segment that spans a line break. Used where each source line needs to
 * become its own paragraph (docx export); the presentation screen instead
 * renders the segments in one wrapped Text, letting layout reflow them.
 */
export function splitIntoLines(segments: LyricsSegment[]): LyricsSegment[][] {
  const lines: LyricsSegment[][] = [[]];
  for (const segment of segments) {
    segment.text.split("\n").forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part.length > 0) {
        lines[lines.length - 1].push({
          text: part,
          highlighted: segment.highlighted,
        });
      }
    });
  }
  return lines;
}

/**
 * Toggles highlighting for the `[start, end)` selection in `text`: wraps it
 * in markers, or - if the selection exactly bounds an existing highlight,
 * markers included or excluded - strips them. Returns `text` unchanged for
 * an empty (cursor-only) selection.
 */
export function toggleHighlightAt(
  text: string,
  start: number,
  end: number,
): string {
  if (start >= end) return text;

  const selectionIncludesMarkers =
    text.slice(start, start + HIGHLIGHT_OPEN.length) === HIGHLIGHT_OPEN &&
    text.slice(end - HIGHLIGHT_CLOSE.length, end) === HIGHLIGHT_CLOSE;
  if (selectionIncludesMarkers) {
    return (
      text.slice(0, start) +
      text.slice(start + HIGHLIGHT_OPEN.length, end - HIGHLIGHT_CLOSE.length) +
      text.slice(end)
    );
  }

  const selectionSitsInsideMarkers =
    text.slice(Math.max(0, start - HIGHLIGHT_OPEN.length), start) ===
      HIGHLIGHT_OPEN &&
    text.slice(end, end + HIGHLIGHT_CLOSE.length) === HIGHLIGHT_CLOSE;
  if (selectionSitsInsideMarkers) {
    return (
      text.slice(0, start - HIGHLIGHT_OPEN.length) +
      text.slice(start, end) +
      text.slice(end + HIGHLIGHT_CLOSE.length)
    );
  }

  return (
    text.slice(0, start) +
    HIGHLIGHT_OPEN +
    text.slice(start, end) +
    HIGHLIGHT_CLOSE +
    text.slice(end)
  );
}
