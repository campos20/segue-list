/**
 * A setlist in the library. Lives on disk as `setlists/<id>.json`.
 *
 * `songs` holds song *ids*, not songs - a setlist is a grouping, the same
 * way a folder groups files without owning their content. This is what lets
 * one song sit in several setlists, or in none, without ever being copied.
 */
export interface SetlistManifest {
  id: string;
  name: string;
  songs: string[];
  createdAt: string;
  updatedAt: string;
}
