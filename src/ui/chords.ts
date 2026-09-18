/**
 * Chord-line validation and pairing with lyrics. Chords live in their own
 * plain-text field (see types/song.ts), paired 1:1 by line index with
 * `lyrics` - line i's chords sit above lyrics line i, a blank line meaning
 * "no chords for that line". This file never touches color markup; that's
 * lyricsColor.ts's job, and chords mode never shows or edits it.
 */

// A chord's "quality" - everything between the root and an optional slash
// bass note: an optional structural quality, extension, alteration, and a
// parenthesized extension. Deliberately structural rather than a whitelist
// of every real chord name, so it accepts uncommon-but-valid chords
// (F#m7b5, Bb7sus4, C6/9) while still catching a nonsense suffix ("Cxyz").
// Shared between the validating regex below and the capturing one
// transposeChordToken uses, so the two can't drift apart.
//
// "º"/"°" (diminished) and a bare/trailing "+" (augmented) are common
// shorthand in Brazilian "cifra" notation (e.g. "Cº", "E5+"), and a
// parenthesized extension ("E7(9)", "D(add9)") is common wherever chord
// charts get pasted in from - added specifically so a pasted chart isn't
// full of false "invalid chord" flags (see parseChordsAndLyrics).
const CHORD_QUALITY_SRC =
  "(?:maj|min|m|dim|º|°|aug|5\\+|\\+)?(?:6\\/9|69|2|4|5|6|7|9|11|13)?(?:sus2|sus4|add2|add4|add9|add11|add13)?(?:[#b](?:5|9|11|13))?(?:\\((?:add)?[#b]?(?:2|4|5|6|7|9|11|13)\\))?";

const CHORD_TOKEN_RE = new RegExp(
  `^[A-G](?:#|b)?${CHORD_QUALITY_SRC}(?:\\/[A-G](?:#|b)?)?$`,
);

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
export function findInvalidChordTokens(
  chordsText: string,
): InvalidChordToken[] {
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

// Same shape as CHORD_TOKEN_RE, but with the root, quality, and bass note
// captured separately so transposeChordToken can shift just the note
// letters and leave the quality (m7, sus4, ...) untouched.
const CHORD_TOKEN_CAPTURE_RE = new RegExp(
  `^([A-G])(#|b)?(${CHORD_QUALITY_SRC})(?:\\/([A-G])(#|b)?)?$`,
);

const SHARP_SCALE = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const NATURAL_SEMITONE: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** A note's position (0-11) on the chromatic scale, wrapped into range. */
function noteToSemitone(
  letter: string,
  accidental: string | undefined,
): number {
  const semitone =
    NATURAL_SEMITONE[letter] +
    (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
  return ((semitone % 12) + 12) % 12;
}

function transposeNote(
  letter: string,
  accidental: string | undefined,
  steps: number,
): string {
  const semitone = noteToSemitone(letter, accidental) + steps;
  return SHARP_SCALE[((semitone % 12) + 12) % 12];
}

/**
 * Shifts one chord token by `steps` semitones (half steps), respelling the
 * root and any slash-bass note on the sharps scale - the quality (m7, sus4,
 * add9, ...) is copied through unchanged since transposition never changes
 * a chord's shape, only its root. A token that isn't a recognized chord
 * shape (blank, or something findInvalidChordTokens would already have
 * flagged) is returned unchanged rather than guessed at.
 */
export function transposeChordToken(token: string, steps: number): string {
  if (steps === 0) return token;
  const match = token.match(CHORD_TOKEN_CAPTURE_RE);
  if (!match) return token;
  const [, rootLetter, rootAccidental, quality, bassLetter, bassAccidental] =
    match;
  const newRoot = transposeNote(rootLetter, rootAccidental, steps);
  const newBass = bassLetter
    ? transposeNote(bassLetter, bassAccidental, steps)
    : undefined;
  return `${newRoot}${quality}${newBass ? `/${newBass}` : ""}`;
}

/**
 * Transposes every chord token in `chordsText` by `steps` semitones,
 * preserving line breaks and inter-token spacing exactly - only the chord
 * tokens themselves change. Used for display (Presentation mode, and
 * SongDetailScreen's Chords-mode preview) - the underlying stored `chords`
 * field is never rewritten by this, so the original is always one "Reset"
 * away. See SongManifest.transposeSteps.
 */
export function transposeChordsText(chordsText: string, steps: number): string {
  if (steps === 0 || chordsText.length === 0) return chordsText;
  return chordsText
    .split("\n")
    .map((line) =>
      line
        .split(/(\s+)/)
        .map((part) =>
          part.trim().length > 0 ? transposeChordToken(part, steps) : part,
        )
        .join(""),
    )
    .join("\n");
}

function isChordOnlyLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every(isValidChordToken);
}

/**
 * Parses a pasted chord chart - a chord line, then the lyric line it goes
 * with, repeating, as commonly copied from lyric/chord sites - into
 * chords/lyrics text ready to drop straight into Chords mode's two fields
 * (already paired 1:1 by line, same as alignChordsToLyricsLineCount's
 * invariant). A line counts as a chord line only if EVERY space-separated
 * token on it is a recognized chord (isValidChordToken) - column spacing
 * within a chord line is preserved verbatim, since both the chords and
 * lyrics fields render in the same monospace font stacked directly (see
 * PresentationScreen), so a chord positioned over a specific syllable stays
 * positioned over it. Anything that isn't a pure chord line - an actual
 * lyric line, a section marker like "[Chorus]", or a blank separator line -
 * becomes a lyrics line with a blank paired chord line.
 *
 * This is a heuristic, not a real parser: a lyric line that happens to be
 * made up entirely of chord-shaped short words (a lone "A", or "Em" used as
 * a real word) can misclassify as a chord line. The result lands in the
 * same per-line editable rows as manual entry, so a misparse is exactly as
 * easy to fix by hand afterward as a typo would be.
 */
export function parseChordsAndLyrics(source: string): {
  chords: string;
  lyrics: string;
} {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const chordLines: string[] = [];
  const lyricLines: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (isChordOnlyLine(lines[i])) {
      chordLines.push(lines[i]);
      lyricLines.push(lines[i + 1] ?? "");
      i += 2;
    } else {
      chordLines.push("");
      lyricLines.push(lines[i]);
      i += 1;
    }
  }
  return { chords: chordLines.join("\n"), lyrics: lyricLines.join("\n") };
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
