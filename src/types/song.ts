/**
 * A song in the library. Lives on disk as `songs/<id>.json`, independent of
 * any setlist - a setlist only ever holds a song's id (see SetlistManifest),
 * so the same song can be in several setlists, or in none.
 */
export interface SongManifest {
  id: string;
  name: string;
  lyrics: string | null;
  /** Optional so a manifest written before tags existed still parses; treat a missing value as `[]`. */
  tags?: string[];
  /**
   * Approximate playing time in seconds, entered by hand (there is no audio
   * file to read it from). Paces Presentation mode's auto-scroll. Missing or
   * null means "not set" - Presentation mode then falls back to
   * DEFAULT_DURATION_SECONDS (see ui/duration.ts) so auto-scroll is always
   * available, just untimed.
   */
  durationSeconds?: number | null;
  /**
   * Chord chart text, plain (no ChordPro `[Am]` brackets). Line N is meant
   * to sit above lyrics line N in a monospace font, columns positioned by
   * hand-typed spacing. Optional/nullable like `lyrics`.
   */
  chords?: string | null;
  createdAt: string;
  updatedAt: string;
}
