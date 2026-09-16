/**
 * Pure line-array logic behind the plain-text "chords" editor
 * (ChordsLyricsEditor.tsx). Lyrics and chords are still stored as two
 * separate strings (see SongManifest.lyrics/chords) - this just treats them
 * as parallel arrays of same-length lines while editing, so a structural
 * edit (splitting a line in two, merging two lines back together) moves a
 * lyric line and its chord line as one atomic operation instead of two
 * independently-maintained arrays that can drift out of position relative
 * to each other.
 */

export interface ChordsLyricsRow {
  lyric: string;
  chords: string;
}

/**
 * Splits `lyrics`/`chords` into same-length rows, padding whichever is
 * shorter with blank lines. Always at least one row, even for two empty
 * strings, so there's always something to type into.
 */
export function toRows(lyrics: string, chords: string): ChordsLyricsRow[] {
  const lyricLines = lyrics.split("\n");
  const chordLines = chords.split("\n");
  const count = Math.max(lyricLines.length, chordLines.length, 1);
  return Array.from({ length: count }, (_, i) => ({
    lyric: lyricLines[i] ?? "",
    chords: chordLines[i] ?? "",
  }));
}

/** Inverse of toRows. */
export function fromRows(rows: ChordsLyricsRow[]): {
  lyrics: string;
  chords: string;
} {
  return {
    lyrics: rows.map((row) => row.lyric).join("\n"),
    chords: rows.map((row) => row.chords).join("\n"),
  };
}

/**
 * Splits row `index`'s lyric text at `cursorPos` into two rows - mirrors
 * what pressing Enter mid-line does in a normal text editor, just
 * decomposed across two parallel arrays. The chord line stays with the
 * first (before-cursor) half; the new row after it gets an empty chord
 * line, since a chord typed for the original single line can't be
 * meaningfully split between the two halves.
 */
export function splitRowAt(
  rows: ChordsLyricsRow[],
  index: number,
  cursorPos: number,
): ChordsLyricsRow[] {
  const row = rows[index];
  const before = row.lyric.slice(0, cursorPos);
  const after = row.lyric.slice(cursorPos);
  const next = [...rows];
  next.splice(
    index,
    1,
    { lyric: before, chords: row.chords },
    { lyric: after, chords: "" },
  );
  return next;
}

/** Combines two chord lines when their rows merge - whichever side is blank contributes nothing, so merging a line into its own blank continuation doesn't leave a stray trailing space. */
function joinChordLines(a: string, b: string): string {
  if (a.trim() === "") return b;
  if (b.trim() === "") return a;
  return `${a} ${b}`;
}

/**
 * Merges row `index` into the row before it - mirrors what Backspace does
 * at the start of a line in a normal text editor. Returns the merged rows
 * plus the character offset within the (now merged) previous row's lyric
 * where the join happened, so the caller can put the cursor exactly there.
 * A no-op when `index` is 0 - there's nothing before the first row to merge
 * into.
 */
export function mergeRowIntoPrevious(
  rows: ChordsLyricsRow[],
  index: number,
): { rows: ChordsLyricsRow[]; joinPoint: number } {
  if (index <= 0) {
    return { rows, joinPoint: rows[0]?.lyric.length ?? 0 };
  }
  const previous = rows[index - 1];
  const current = rows[index];
  const joinPoint = previous.lyric.length;
  const merged: ChordsLyricsRow = {
    lyric: previous.lyric + current.lyric,
    chords: joinChordLines(previous.chords, current.chords),
  };
  const next = [...rows];
  next.splice(index - 1, 2, merged);
  return { rows: next, joinPoint };
}
