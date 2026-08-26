import type { PersistedAppSettings } from "@/storage/appSettings";
import type { SetlistManifest } from "@/types/setlist";
import type { SongManifest } from "@/types/song";

/**
 * The Library shows setlists and loose songs interleaved in one list, the
 * way Postman or Insomnia show folders alongside requests. Both kinds
 * therefore share one ordering, which means one namespace of keys - hence
 * the prefixes.
 */
export function setlistKey(id: string): string {
  return `setlist:${id}`;
}

export function songKey(id: string): string {
  return `song:${id}`;
}

export type LibraryItem =
  | {
      kind: "setlist";
      key: string;
      setlist: SetlistManifest;
      /** The setlist's songs, resolved and in the setlist's own order. */
      songs: SongManifest[];
    }
  | { kind: "song"; key: string; song: SongManifest };

export function resolveLibraryOrder(settings: PersistedAppSettings): string[] {
  return settings.libraryOrder ?? [];
}

/**
 * Arranges songs and setlists into the list the Library renders.
 *
 * A song listed by any setlist is shown inside it and *not* at the top
 * level, matching how a request in Postman lives in its collection rather
 * than in both places. A song listed by two setlists appears in both -
 * setlists hold ids, so membership is not exclusive.
 *
 * Ids that no longer resolve are dropped rather than rendered as blanks: a
 * setlist outlives the songs it points at (a song can be deleted from the
 * Library), and a setlist full of ghosts is worse than a short setlist.
 */
export function buildLibraryTree(
  songs: SongManifest[],
  setlists: SetlistManifest[],
  order: string[] = [],
): LibraryItem[] {
  const byId = new Map(songs.map((song) => [song.id, song]));

  const setlistItems: LibraryItem[] = setlists.map((setlist) => ({
    kind: "setlist",
    key: setlistKey(setlist.id),
    setlist,
    songs: setlist.songs
      .map((id) => byId.get(id))
      .filter((song): song is SongManifest => song !== undefined),
  }));

  const filed = new Set(setlists.flatMap((setlist) => setlist.songs));
  const looseItems: LibraryItem[] = songs
    .filter((song) => !filed.has(song.id))
    .map((song) => ({ kind: "song", key: songKey(song.id), song }));

  // Setlists first among the not-yet-ordered, so one the user just made is
  // visible without scrolling past a long song list to find it.
  return applyOrder([...setlistItems, ...looseItems], order);
}

/**
 * Puts `items` into `order`, appending anything `order` doesn't mention in
 * its existing relative position. A new item is never lost just because the
 * saved order predates it.
 */
function applyOrder(items: LibraryItem[], order: string[]): LibraryItem[] {
  if (order.length === 0) return items;

  const byKey = new Map(items.map((item) => [item.key, item]));
  const placed = order
    .map((key) => byKey.get(key))
    .filter((item): item is LibraryItem => item !== undefined);
  const placedKeys = new Set(placed.map((item) => item.key));

  return [...placed, ...items.filter((item) => !placedKeys.has(item.key))];
}
