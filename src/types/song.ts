/**
 * A song in the library. Lives on disk as `songs/<id>.json`, independent of
 * any setlist - a setlist only ever holds a song's id (see SetlistManifest),
 * so the same song can be in several setlists, or in none.
 */
export interface SongManifest {
  id: string;
  name: string;
  lyrics: string | null;
  /**
   * Chord line text, paired 1:1 by line index with `lyrics` - line i's
   * chords sit above lyrics line i, a blank line meaning "no chords for
   * that line" (see ui/chords.ts). Always plain text, never the
   * `<span style="...">` color markup `lyrics` can contain - chords mode
   * has no rich text. Optional/null so a manifest written before chords
   * existed still parses, and so a song with no chords entered stays null
   * rather than an all-blank-lines string.
   */
  chords?: string | null;
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
  createdAt: string;
  updatedAt: string;
}
