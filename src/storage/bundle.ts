import { File, Paths } from "expo-file-system";
import type { SetlistManifest } from "@/types/setlist";
import type { SongManifest } from "@/types/song";
import { isFileSystemAvailable } from "./paths";
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
  songs: SongManifest[];
  setlists: SetlistManifest[];
  skippedSongIds: string[];
  skippedSetlistIds: string[];
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

/** Writes a bundle into the cache directory, where it can be handed to the share sheet. */
export function writeBundleToCache(
  contents: BundleContents,
  label: string,
  appVersion?: string,
): File {
  if (!isFileSystemAvailable) {
    throw new BundleFormatError(
      "Backups aren't supported in this environment.",
    );
  }
  const bundle = buildBundle(contents, appVersion);
  const destination = new File(Paths.cache, bundleFileName(label));
  if (destination.exists) destination.delete();
  destination.write(JSON.stringify(bundle, null, 2));
  return destination;
}

function isUsableBundle(value: unknown): value is LibraryBundle {
  const candidate = value as LibraryBundle | null;
  return (
    candidate?.format === BUNDLE_FORMAT &&
    Array.isArray(candidate.songs) &&
    Array.isArray(candidate.setlists)
  );
}

/** Reads a `.seguelist` file back into its parts, without writing anything. */
export function readBundle(file: File): LibraryBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.textSync());
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
 * Merges a bundle into the local library.
 *
 * A song or setlist whose id already exists locally is left untouched
 * rather than overwritten: re-importing your own backup is a no-op instead
 * of silently replacing something you've since changed, and a bundle from
 * someone else can never clobber one of yours that happens to share an id.
 */
export function importBundle(
  file: File,
  existing: BundleContents,
): ImportedBundle {
  const bundle = readBundle(file);

  const existingSongIds = new Set(existing.songs.map((song) => song.id));
  const newSongs: SongManifest[] = [];
  const skippedSongIds: string[] = [];
  for (const song of bundle.songs) {
    if (existingSongIds.has(song.id)) {
      skippedSongIds.push(song.id);
      continue;
    }
    writeSong(song);
    newSongs.push(song);
  }

  const existingSetlistIds = new Set(
    existing.setlists.map((setlist) => setlist.id),
  );
  const newSetlists: SetlistManifest[] = [];
  const skippedSetlistIds: string[] = [];
  for (const setlist of bundle.setlists) {
    if (existingSetlistIds.has(setlist.id)) {
      skippedSetlistIds.push(setlist.id);
      continue;
    }
    writeSetlist(setlist);
    newSetlists.push(setlist);
  }

  return {
    songs: newSongs,
    setlists: newSetlists,
    skippedSongIds,
    skippedSetlistIds,
  };
}
