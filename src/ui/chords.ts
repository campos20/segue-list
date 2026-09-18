/**
 * Chord-line validation and pairing with lyrics. Chords live in their own
 * plain-text field (see types/song.ts), paired 1:1 by line index with
 * `lyrics` - line i's chords sit above lyrics line i, a blank line meaning
 * "no chords for that line". This file never touches color markup; that's
 * lyricsColor.ts's job, and chords mode never shows or edits it.
 */

// Root note, optional accidental, an optional structural quality, an
// optional extension/alteration, an optional slash bass note. Deliberately
// structural rather than a whitelist of every real chord name, so it
// accepts uncommon-but-valid chords (F#m7b5, Bb7sus4, C6/9) while still
// catching a mistyped root ("H7") or a nonsense suffix ("Cxyz").
const CHORD_TOKEN_RE =
  /^[A-G](?:#|b)?(?:maj|min|m|dim|aug)?(?:6\/9|69|2|4|5|6|7|9|11|13)?(?:sus2|sus4|add2|add4|add9|add11|add13)?(?:[#b](?:5|9|11|13))?(?:\/[A-G](?:#|b)?)?$/;

export function isValidChordToken(token: string): boolean {
  return CHORD_TOKEN_RE.test(token);
}

export interface InvalidChordToken {
  /** 1-indexed, matching how a line number reads in an error message. */
  line: number;
  token: string;
}

/**
 * Every invalid token in `chordsText`, line-numbered for an error message.
 * A line can hold several space-separated chords (e.g. a quick change
 * mid-line); each is checked independently. Blank lines and surrounding
 * whitespace are never invalid - only a non-empty token that doesn't match
 * chord grammar is reported.
 */
export function findInvalidChordTokens(chordsText: string): InvalidChordToken[] {
  const invalid: InvalidChordToken[] = [];
  chordsText.split("\n").forEach((line, index) => {
    for (const token of line.trim().split(/\s+/).filter(Boolean)) {
      if (!isValidChordToken(token)) invalid.push({ line: index + 1, token });
    }
  });
  return invalid;
}

/**
 * Pads or trims `chordsText` to exactly `lyricsLineCount` lines, keeping the
 * 1:1 pairing invariant with lyrics. Called at save time, not on every
 * keystroke, since chords and lyrics are edited in two independent text
 * boxes in Chords mode. A missing chord line is left blank, never invented;
 * an extra one (lyrics lines were removed) is dropped, since it would no
 * longer have a paired lyric line to sit above.
 */
export function alignChordsToLyricsLineCount(
  chordsText: string,
  lyricsLineCount: number,
): string {
  const lines = chordsText.length > 0 ? chordsText.split("\n") : [];
  const aligned = lines.slice(0, lyricsLineCount);
  while (aligned.length < lyricsLineCount) aligned.push("");
  return aligned.join("\n");
}

export interface ChordLyricsLine {
  chords: string;
  lyrics: string;
}

/**
 * Zips chords and lyrics line-by-line for the "1 chord line, 1 lyrics line"
 * display - see PresentationScreen's chords view and SongDetailScreen's
 * Chords mode. Tolerant of the two not being the same length (an unsaved
 * edit in progress) rather than assuming alignChordsToLyricsLineCount has
 * already run.
 */
export function pairChordsWithLyrics(
  chordsText: string,
  lyricsText: string,
): ChordLyricsLine[] {
  const chordLines = chordsText.length > 0 ? chordsText.split("\n") : [];
  const lyricLines = lyricsText.length > 0 ? lyricsText.split("\n") : [];
  const count = Math.max(chordLines.length, lyricLines.length);
  const paired: ChordLyricsLine[] = [];
  for (let i = 0; i < count; i++) {
    paired.push({ chords: chordLines[i] ?? "", lyrics: lyricLines[i] ?? "" });
  }
  return paired;
}
