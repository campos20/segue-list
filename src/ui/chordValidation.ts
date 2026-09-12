/**
 * Validates hand-typed chord tokens against a fixed vocabulary of chord
 * roots and qualities. Chords are authored as plain text on their own line
 * above the lyric line they belong to (e.g. "Am7", "D/F#") - never
 * ChordPro-style `[Am]` brackets - so this exists to keep typos and stray
 * text out of the chords field, not to parse an open-ended grammar.
 */

const NOTE_INDEX: Record<string, number> = {
  C: 0,
  "B#": 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  "E#": 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

// Longest-match-first: a chord's quality suffix is recognized by greedily
// consuming entries off this list. This is a finite whitelist, not a full
// chord grammar - an exotic quality outside this list simply isn't a valid
// chord, which is the point (see sanitizeChordsText).
const QUALITIES = [
  "maj13",
  "maj11",
  "maj9",
  "maj7",
  "maj",
  "m7b5",
  "m13",
  "m11",
  "m9",
  "m7",
  "m6",
  "madd9",
  "m",
  "min7",
  "min",
  "dim7",
  "dim",
  "aug",
  "sus2",
  "sus4",
  "sus",
  "add9",
  "add11",
  "add13",
  "add2",
  "add4",
  "add",
  "6/9",
  "6",
  "7sus4",
  "7b9",
  "7#9",
  "7b5",
  "7#5",
  "7",
  "9",
  "11",
  "13",
  "5",
  "2",
  "4",
  "b5",
  "#5",
  "b9",
  "#9",
  "#11",
  "no3",
];

const ROOT_PATTERN = /^([A-G])([#b]?)(.*)$/;

/** Whether a single root+quality run (no slash) is a recognized chord. */
function isValidRootQuality(part: string): boolean {
  const match = ROOT_PATTERN.exec(part);
  if (!match) return false;
  const [, letter, accidental, rest] = match;
  if (NOTE_INDEX[letter + accidental] === undefined) return false;

  let remaining = rest;
  while (remaining.length > 0) {
    const quality = QUALITIES.find((q) => remaining.startsWith(q));
    if (!quality) return false;
    remaining = remaining.slice(quality.length);
  }
  return true;
}

/**
 * Whether a single whitespace-delimited word is a recognized chord,
 * including a slash (bass note) chord like "D/F#". A "/" is only treated as
 * a bass-note separator when what follows it is itself a chord root - a
 * compound extension like "C6/9" has no bass note and is validated as one
 * token via the "6/9" quality entry above instead.
 */
export function isValidChordToken(token: string): boolean {
  if (token === "") return false;
  const slashIndex = token.indexOf("/");
  if (slashIndex !== -1) {
    const before = token.slice(0, slashIndex);
    const after = token.slice(slashIndex + 1);
    if (isValidRootQuality(after)) {
      return isValidRootQuality(before);
    }
  }
  return isValidRootQuality(token);
}

/**
 * Removes any word that isn't a recognized chord from chord-chart text,
 * leaving valid chords and all whitespace untouched so the remaining chords
 * keep their authored column position over the lyrics. Meant to be applied
 * when the chords field loses focus and again right before saving, rather
 * than on every keystroke - a live per-character filter would fight the
 * cursor while a chord like "Bbmaj7" is still partway through being typed.
 */
export function sanitizeChordsText(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      // Alternates token, whitespace, token, ... (even indices are token
      // runs, possibly "") - same split used by a chord-line-aware
      // transform would use, so whitespace between valid chords is never
      // touched.
      line
        .split(/(\s+)/)
        .map((part, index) =>
          index % 2 === 0 && part !== "" && !isValidChordToken(part)
            ? ""
            : part,
        )
        .join(""),
    )
    .join("\n");
}
