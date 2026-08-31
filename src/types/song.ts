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
  createdAt: string;
  updatedAt: string;
}
