import type { SetlistManifest } from "@/types/setlist";
import type { SongManifest } from "@/types/song";
import { writeSetlist } from "./setlistLibrary";
import { writeSong } from "./songLibrary";

/**
 * The `.seguelist` backup file: one JSON document holding every song (name +
 * lyrics) and every setlist (which just references song ids), so the whole
 * library can be backed up, moved to a new phone, or handed to another
 * musician.
 *
 * There is no backend and no database format to match - this is plain JSON,
 * not a binary container. A library here is text, so there is nothing that
 * benefits from streaming or a hand-rolled byte layout.
 */
export const BUNDLE_FORMAT = "segue-list-bundle";
export const BUNDLE_VERSION = 1;
export const BUNDLE_EXTENSION = "seguelist";

export interface LibraryBundle {
  format: typeof BUNDLE_FORMAT;
  version: number;
  app?: string;
  createdAt: string;
  songs: SongManifest[];
  setlists: SetlistManifest[];
}

export interface BundleContents {
  songs: SongManifest[];
  setlists: SetlistManifest[];
}

export interface ImportedBundle {
  /** New to this library - already written by importBundle. */
  songs: SongManifest[];
  setlists: SetlistManifest[];
  /** Already here, and the local copy is at least as recent - left alone. */
  skippedSongIds: string[];
  skippedSetlistIds: string[];
  /**
   * Already here, but the bundle's copy was saved more recently - NOT
   * written by importBundle. Replacing a local copy is destructive, so the
   * caller asks first and only then hands these to
   * store/persistBundle.ts's applyNewerFromBundle.
   */
  newerSongs: SongManifest[];
  newerSetlists: SetlistManifest[];
  /**
   * New to this library, but their write failed (browser storage full, a
   * disk error) - not saved, and not in `songs`/`setlists`. Each item is
   * written on its own, so one failure never costs the items before or
   * after it, and every item that did save is still returned for the store.
   * A setlist whose song failed just shows without that song (see
   * ui/libraryTree.ts).
   */
  failedSongIds: string[];
  failedSetlistIds: string[];
}

export class BundleFormatError extends Error {}

/** Filename for a bundle of `label`, e.g. "My Library" -> "my-library.seguelist". */
export function bundleFileName(label: string): string {
  const slug =
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "segue-list";
  return `${slug}.${BUNDLE_EXTENSION}`;
}

export function buildBundle(
  contents: BundleContents,
  appVersion?: string,
): LibraryBundle {
  return {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    app: appVersion,
    createdAt: new Date().toISOString(),
    songs: contents.songs,
    setlists: contents.setlists,
  };
}

/**
 * The bundle as the text that goes into a `.seguelist` file. Pure on
 * purpose - writing it somewhere and handing it to the user is
 * platform-specific (share sheet on a phone, download in a browser) and
 * lives in share.ts, so this stays the same on every platform.
 */
export function serializeBundle(
  contents: BundleContents,
  appVersion?: string,
): string {
  return JSON.stringify(buildBundle(contents, appVersion), null, 2);
}

function isUsableBundle(value: unknown): value is LibraryBundle {
  const candidate = value as LibraryBundle | null;
  return (
    candidate?.format === BUNDLE_FORMAT &&
    Array.isArray(candidate.songs) &&
    Array.isArray(candidate.setlists)
  );
}

/** Parses a `.seguelist` file's text back into its parts, without writing anything. */
export function parseBundle(text: string): LibraryBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BundleFormatError("This file isn't a valid segue-list backup.");
  }
  if (!isUsableBundle(parsed)) {
    throw new BundleFormatError("This file isn't a valid segue-list backup.");
  }
  if (parsed.version > BUNDLE_VERSION) {
    throw new BundleFormatError(
      `This backup was made by a newer version of the app (format ${parsed.version}). Update to open it.`,
    );
  }
  return parsed;
}

/**
 * True only when `incoming` was saved strictly after `local`. An unparseable
 * timestamp on either side is never "newer" - when in doubt, the local copy
 * wins.
 */
export function isNewerThan(
  incoming: { updatedAt: string },
  local: { updatedAt: string },
): boolean {
  const incomingTime = Date.parse(incoming.updatedAt);
  const localTime = Date.parse(local.updatedAt);
  if (Number.isNaN(incomingTime) || Number.isNaN(localTime)) return false;
  return incomingTime > localTime;
}

/**
 * Merges a bundle into the local library.
 *
 * Anything whose id isn't here yet is written straight away. A song or
 * setlist whose id already exists locally is never overwritten here:
 * re-importing your own backup is a no-op instead of silently replacing
 * something you've since changed. When the bundle's copy is newer (edited
 * on the web version, say, then moved to the phone), it comes back in
 * `newerSongs`/`newerSetlists` for the caller to confirm before applying.
 */
export function importBundle(
  text: string,
  existing: BundleContents,
): ImportedBundle {
  const bundle = parseBundle(text);

  const existingSongs = new Map(existing.songs.map((song) => [song.id, song]));
  const newSongs: SongManifest[] = [];
  const skippedSongIds: string[] = [];
  const newerSongs: SongManifest[] = [];
  const failedSongIds: string[] = [];
  for (const song of bundle.songs) {
    const local = existingSongs.get(song.id);
    if (local) {
      if (isNewerThan(song, local)) newerSongs.push(song);
      else skippedSongIds.push(song.id);
      continue;
    }
    try {
      writeSong(song);
    } catch (error) {
      console.warn(`Failed to import song "${song.id}"`, error);
      failedSongIds.push(song.id);
      continue;
    }
    newSongs.push(song);
  }

  const existingSetlists = new Map(
    existing.setlists.map((setlist) => [setlist.id, setlist]),
  );
  const newSetlists: SetlistManifest[] = [];
  const skippedSetlistIds: string[] = [];
  const newerSetlists: SetlistManifest[] = [];
  const failedSetlistIds: string[] = [];
  for (const setlist of bundle.setlists) {
    const local = existingSetlists.get(setlist.id);
    if (local) {
      if (isNewerThan(setlist, local)) newerSetlists.push(setlist);
      else skippedSetlistIds.push(setlist.id);
      continue;
    }
    try {
      writeSetlist(setlist);
    } catch (error) {
      console.warn(`Failed to import setlist "${setlist.id}"`, error);
      failedSetlistIds.push(setlist.id);
      continue;
    }
    newSetlists.push(setlist);
  }

  return {
    songs: newSongs,
    setlists: newSetlists,
    skippedSongIds,
    skippedSetlistIds,
    newerSongs,
    newerSetlists,
    failedSongIds,
    failedSetlistIds,
  };
}
