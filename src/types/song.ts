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
   * null means "not set" - auto-scroll is simply unavailable for that song.
   */
  durationSeconds?: number | null;
  createdAt: string;
  updatedAt: string;
}
