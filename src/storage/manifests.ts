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
