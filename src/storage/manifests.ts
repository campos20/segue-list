import type { SetlistManifest } from "@/types/setlist";
import type { SongManifest } from "@/types/song";
import { generateId } from "./ids";

/*
 * What a brand-new song or setlist looks like, before it's written
 * anywhere. Shared by the phone's file-backed libraries (songLibrary.ts,
 * setlistLibrary.ts) and the browser's localStorage-backed ones
 * (*.web.ts), so both platforms create identical manifests.
 */

export const DRAFT_SONG_NAME = "New song";
export const DRAFT_SETLIST_NAME = "New setlist";

/** What an import (a ChordPro file, say) can set on a song at creation, beyond its name and lyrics. */
export interface NewSongFields {
  chords?: string | null;
  durationSeconds?: number | null;
  transposeSteps?: number;
}

export function newSongManifest(
  name = DRAFT_SONG_NAME,
  lyrics: string | null = null,
  fields: NewSongFields = {},
): SongManifest {
  const now = new Date().toISOString();
  return {
    id: generateId(name),
    name,
    lyrics,
    chords: fields.chords || null,
    transposeSteps: fields.transposeSteps ?? 0,
    tags: [],
    ...(fields.durationSeconds
      ? { durationSeconds: fields.durationSeconds }
      : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export function newSetlistManifest(name = DRAFT_SETLIST_NAME): SetlistManifest {
  const now = new Date().toISOString();
  return {
    id: generateId(name),
    name,
    songs: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Whether `id` has the shape generateId produces (lowercase letters, digits
 * and hyphens). An id becomes a file name (`songs/<id>.json`), so one that
 * arrives from outside the app - a QR link, say - is only trusted when it
 * matches: something like `../settings` must never reach the filesystem.
 */
export function isSafeId(id: unknown): id is string {
  // 250: a file name is at most 255 bytes, and ".json" takes 5. generateId
  // doesn't cap its slug, so a long song name gives a long (but valid) id.
  return typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,249}$/.test(id);
}

export function isUsableSong(manifest: unknown): manifest is SongManifest {
  const candidate = manifest as SongManifest | null;
  return Boolean(candidate?.id) && typeof candidate?.name === "string";
}

export function isUsableSetlist(
  manifest: unknown,
): manifest is SetlistManifest {
  const candidate = manifest as SetlistManifest | null;
  return (
    Boolean(candidate?.id) &&
    typeof candidate?.name === "string" &&
    Array.isArray(candidate?.songs)
  );
}
