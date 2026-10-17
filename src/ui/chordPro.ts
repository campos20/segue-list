import {
  alignChordsAndLyricsRows,
  isValidChordToken,
  pairChordsWithLyrics,
  parseChordsAndLyrics,
  transposeChordToken,
} from "@/ui/chords";
import { plainTextFromLyrics } from "@/ui/lyricsColor";
import type { SongManifest } from "@/types/song";

/**
 * ChordPro (https://www.chordpro.org/chordpro/) - the de facto interchange
 * format for chords + lyrics: plain text with each chord in brackets at the
 * exact point in the lyric where it changes (`A[G]mazing [G7]grace`), plus
 * `{directive: value}` lines for metadata and sections. OnSong,
 * SongbookPro, Planning Center, OpenLP and most other chord apps read and
 * write it.
 *
 * This app stores chords the other common way - a chord line above each
 * lyric line, positioned by column (see chords.ts) - so this module only
 * converts between the two, with no I/O. There's nothing for the user to
 * choose: imports (files and "Paste chords") detect ChordPro by its syntax
 * via looksLikeChordPro, and fall back to the existing plain-text handling
 * otherwise.
 *
 * Deliberately lossy where the app has nothing to map to: no song sections
 * (verse/chorus markers become a label line when they carry one, otherwise
 * nothing), no key/tempo/capo fields, no fonts/colors. What the app does
 * have - title, chords, lyrics, duration, transposition - round-trips.
 */

export interface ChordProSong {
  /** From `{title}`; null when the file doesn't say (the caller falls back to the filename). */
  title: string | null;
  /** Plain text, one line per row - not yet in the rich-text storage format. */
  lyrics: string;
  /** Paired 1:1 by line with `lyrics` (see chords.ts); "" when the song has no chords. */
  chords: string;
  durationSeconds: number | null;
  /** From `{transpose: n}` - same meaning as SongManifest.transposeSteps. */
  transposeSteps: number;
}

interface Row {
  chords: string;
  lyrics: string;
}

// `{name}`, `{name: value}` or `{name value}`. A name may carry a
// conditional selector (`{title-guitar: ...}`), dropped by directiveName.
const DIRECTIVE_RE = /^\{\s*([A-Za-z_][\w-]*)\s*(?:[:\s]\s*(.*?))?\s*\}$/;
const BRACKET_RE = /\[([^\]]*)\]/g;

const ALIASES: Record<string, string> = {
  t: "title",
  st: "subtitle",
  c: "comment",
  ci: "comment_italic",
  cb: "comment_box",
  soc: "start_of_chorus",
  eoc: "end_of_chorus",
  sov: "start_of_verse",
  eov: "end_of_verse",
  sob: "start_of_bridge",
  eob: "end_of_bridge",
  sot: "start_of_tab",
  eot: "end_of_tab",
  sog: "start_of_grid",
  eog: "end_of_grid",
  ns: "new_song",
  np: "new_page",
  npp: "new_physical_page",
  colb: "column_break",
};

// Directives that only appear in ChordPro, so finding one is proof enough.
// `start_of_*`/`end_of_*` are matched by prefix (see isKnownDirective).
const KNOWN_DIRECTIVES = new Set([
  "title",
  "subtitle",
  "artist",
  "composer",
  "lyricist",
  "arranger",
  "album",
  "year",
  "copyright",
  "key",
  "time",
  "tempo",
  "duration",
  "capo",
  "transpose",
  "meta",
  "comment",
  "comment_italic",
  "comment_box",
  "highlight",
  "chorus",
  "new_song",
  "new_page",
  "new_physical_page",
  "column_break",
  "columns",
  "define",
  "chord",
]);

// Blocks whose content is notation source (ABC, LilyPond, SVG), not
// something a lyric screen can show - skipped rather than dumped as text.
const SKIPPED_BLOCKS = new Set(["abc", "ly", "svg"]);

function directiveName(raw: string): string {
  const base = raw.toLowerCase().split("-")[0];
  return ALIASES[base] ?? base;
}

function isKnownDirective(name: string): boolean {
  return (
    KNOWN_DIRECTIVES.has(name) ||
    name.startsWith("start_of_") ||
    name.startsWith("end_of_")
  );
}

function bracketsHoldAChord(line: string): boolean {
  for (const match of line.matchAll(BRACKET_RE)) {
    if (isValidChordToken(match[1].trim())) return true;
  }
  return false;
}

/**
 * True when `text` is (very likely) ChordPro: any recognized `{directive}`
 * line, or at least two lines with an inline `[Chord]`. Two, not one, so a
 * plain lyric sheet with a single bracketed chord-shaped word isn't
 * reinterpreted; and a bracketed section marker like "[Chorus]" never
 * counts, since it isn't a valid chord.
 */
export function looksLikeChordPro(text: string): boolean {
  let linesWithChords = 0;
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const directive = line.trim().match(DIRECTIVE_RE);
    if (directive && isKnownDirective(directiveName(directive[1]))) {
      return true;
    }
    if (bracketsHoldAChord(line) && ++linesWithChords >= 2) return true;
  }
  return false;
}

/**
 * Splits one ChordPro line into a chord line and a lyric line. Each chord
 * goes at the column where it sat in the lyric; when chords are closer
 * together than they are wide (`[Am][G]la`), the later one shifts right
 * to leave a space, rather than padding the lyric itself - the lyrics stay
 * exactly as written, at the cost of a crowded chord drifting a little
 * past its syllable.
 *
 * A bracket that doesn't hold a valid chord (`[Chorus]`, `[N.C.]`,
 * `[*Riff]`) stays in the lyric as written, brackets included. Moving it to
 * the chord line would leave a song that can't be saved (Chords mode
 * rejects invalid chords), and dropping it would lose text.
 */
function parseChordProLine(line: string): Row {
  let lyrics = "";
  const placed: { column: number; chord: string }[] = [];
  let consumed = 0;
  for (const match of line.matchAll(BRACKET_RE)) {
    const start = match.index ?? 0;
    lyrics += line.slice(consumed, start);
    const token = match[1].trim();
    if (isValidChordToken(token)) {
      placed.push({ column: lyrics.length, chord: token });
    } else {
      lyrics += match[0];
    }
    consumed = start + match[0].length;
  }
  lyrics += line.slice(consumed);

  let chords = "";
  for (const { column, chord } of placed) {
    const at =
      chords.length === 0 ? column : Math.max(column, chords.length + 1);
    chords = chords.padEnd(at) + chord;
  }
  return { chords, lyrics: lyrics.trim().length === 0 ? "" : lyrics };
}

/** `{duration}` as seconds - "225", "3:45" or "1:02:03" - or null when unparseable. */
function parseDurationValue(value: string): number | null {
  const parts = value.trim().split(":");
  if (parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) {
    return null;
  }
  const seconds = parts.reduce((total, part) => total * 60 + Number(part), 0);
  return seconds > 0 ? seconds : null;
}

function parseTransposeValue(value: string): number {
  const steps = Number(value.trim());
  return Number.isInteger(steps) && Math.abs(steps) <= 24 ? steps : 0;
}

interface SongInProgress {
  title: string | null;
  durationSeconds: number | null;
  transposeSteps: number;
  rows: Row[];
  /** Inside {start_of_chorus}...{end_of_chorus}: rows also collected here. */
  chorusRows: Row[] | null;
  /** The last finished chorus, which `{chorus}` repeats. */
  lastChorus: Row[];
  /** Inside a tab/grid/textblock: lines are kept verbatim, no chord parsing. */
  verbatim: boolean;
  /** Inside an ABC/LilyPond/SVG block: lines are dropped. */
  skipping: boolean;
}

function newSong(): SongInProgress {
  return {
    title: null,
    durationSeconds: null,
    transposeSteps: 0,
    rows: [],
    chorusRows: null,
    lastChorus: [],
    verbatim: false,
    skipping: false,
  };
}

function finishSong(song: SongInProgress): ChordProSong | null {
  const aligned = alignChordsAndLyricsRows(
    song.rows.map((row) => row.chords).join("\n"),
    song.rows.map((row) => row.lyrics).join("\n"),
  );
  const hasChords = aligned.chords.trim().length > 0;
  if (!song.title && !hasChords && aligned.lyrics.trim().length === 0) {
    return null;
  }
  return {
    title: song.title,
    lyrics: aligned.lyrics,
    chords: hasChords ? aligned.chords : "",
    durationSeconds: song.durationSeconds,
    transposeSteps: song.transposeSteps,
  };
}

/** Every song in a ChordPro document - more than one when separated by `{new_song}`. */
export function parseChordPro(source: string): ChordProSong[] {
  const songs: ChordProSong[] = [];
  let song = newSong();

  function push(row: Row) {
    song.rows.push(row);
    song.chorusRows?.push(row);
  }

  function applyDirective(name: string, value: string) {
    if (name === "new_song") {
      const finished = finishSong(song);
      if (finished) songs.push(finished);
      song = newSong();
    } else if (name === "title") {
      if (value) song.title = value;
    } else if (name === "duration") {
      song.durationSeconds = parseDurationValue(value);
    } else if (name === "transpose") {
      song.transposeSteps = parseTransposeValue(value);
    } else if (name === "meta") {
      // `{meta: title Amazing Grace}` is the long form of `{title: ...}`.
      const [, metaName, metaValue] = value.match(/^(\S+)\s*(.*)$/) ?? [];
      if (metaName) applyDirective(directiveName(metaName), metaValue);
    } else if (
      name === "comment" ||
      name === "comment_italic" ||
      name === "comment_box" ||
      name === "highlight"
    ) {
      // Shown on the page in ChordPro ("Chorus x2", "Slowly") - so a lyric line here.
      if (value) push({ chords: "", lyrics: value });
    } else if (name === "chorus") {
      for (const row of song.lastChorus) push(row);
    } else if (name.startsWith("start_of_")) {
      const block = name.slice("start_of_".length);
      if (SKIPPED_BLOCKS.has(block)) {
        song.skipping = true;
        return;
      }
      // The app has no sections; a labelled one keeps its label as a line.
      if (value) push({ chords: "", lyrics: value });
      if (block === "chorus") song.chorusRows = [];
      if (block === "tab" || block === "grid" || block === "textblock") {
        song.verbatim = true;
      }
    } else if (name.startsWith("end_of_")) {
      if (song.chorusRows && name === "end_of_chorus") {
        song.lastChorus = song.chorusRows;
        song.chorusRows = null;
      }
      song.verbatim = false;
      song.skipping = false;
    }
    // Anything else (key, tempo, capo, fonts, chord diagrams...) has no
    // counterpart in the app and is ignored.
  }

  for (const rawLine of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    const directive = line.trim().match(DIRECTIVE_RE);
    if (directive) {
      applyDirective(directiveName(directive[1]), directive[2] ?? "");
      continue;
    }
    if (song.skipping) continue;
    if (song.verbatim) {
      push({ chords: "", lyrics: line });
      continue;
    }
    // A line starting with "#" is a ChordPro comment, never displayed.
    if (line.startsWith("#")) continue;
    push(parseChordProLine(line));
  }

  const last = finishSong(song);
  if (last) songs.push(last);
  return songs;
}

/**
 * What "Paste chords" should fill Chords mode with: a ChordPro chart is
 * converted (its first song, if it holds several), anything else goes
 * through the existing chords-above-lyrics heuristic - the user never has
 * to say which one they pasted.
 */
export function parsePastedChordChart(text: string): {
  chords: string;
  lyrics: string;
  transposeSteps: number;
} {
  if (looksLikeChordPro(text)) {
    const [first] = parseChordPro(text);
    if (first) {
      return {
        chords: first.chords,
        lyrics: first.lyrics,
        transposeSteps: first.transposeSteps,
      };
    }
  }
  return { ...parseChordsAndLyrics(text), transposeSteps: 0 };
}

/**
 * Merges one chord line into its lyric line as inline `[Chord]`s, each at
 * the column it sat over. Chords are transposed by `steps` but positioned
 * by the original line, so a chord whose name grows (C -> C#) doesn't push
 * the ones after it off their syllables. A chord past the end of the lyric
 * (or on an instrumental, chord-only row) pads the lyric with spaces so the
 * spacing between chords survives.
 */
function mergeChordLine(chordLine: string, lyricLine: string, steps: number) {
  if (chordLine.trim().length === 0) return lyricLine;
  const chords = [...chordLine.matchAll(/\S+/g)].map((match) => ({
    column: match.index ?? 0,
    chord: transposeChordToken(match[0], steps),
  }));
  let merged = lyricLine;
  // Right to left, so inserting one doesn't shift the columns of the rest.
  for (const { column, chord } of chords.reverse()) {
    merged = merged.padEnd(column);
    merged = `${merged.slice(0, column)}[${chord}]${merged.slice(column)}`;
  }
  return merged.replace(/\s+$/, "");
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * One song as ChordPro. Chords are written at the pitch the song is shown
 * at (transposeSteps applied), not as the stored original plus a
 * `{transpose}` directive: plenty of apps ignore that directive, and a
 * musician opening the file should see what they actually play. Lyric
 * colors are dropped - ChordPro has no portable way to color part of a line.
 */
export function songToChordPro(song: SongManifest): string {
  const lines = [`{title: ${song.name.replace(/[{}]/g, "")}}`];
  if (song.durationSeconds) {
    lines.push(`{duration: ${formatDuration(song.durationSeconds)}}`);
  }
  lines.push("");

  const lyrics = plainTextFromLyrics(song.lyrics ?? "");
  const chords = song.chords ?? "";
  const steps = song.transposeSteps ?? 0;
  if (chords.trim().length === 0) {
    if (lyrics.length > 0) lines.push(...lyrics.split("\n"));
  } else {
    for (const row of pairChordsWithLyrics(chords, lyrics)) {
      lines.push(mergeChordLine(row.chords, row.lyrics, steps));
    }
  }
  return lines.join("\n");
}

/** Several songs in one ChordPro document, separated by `{new_song}` (ChordPro's own multi-song convention). */
export function songsToChordPro(songs: SongManifest[]): string {
  return `${songs.map(songToChordPro).join("\n\n{new_song}\n")}\n`;
}

/** Filename for a ChordPro export of `label`, e.g. "Friday Night" -> "friday-night.cho". Mirrors docxFileName. */
export function chordProFileName(label: string): string {
  const slug =
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "segue-list";
  return `${slug}.cho`;
}
