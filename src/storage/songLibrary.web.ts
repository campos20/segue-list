import type { SongManifest } from "@/types/song";
import {
  readAllJson,
  removeKey,
  SONG_KEY_PREFIX,
  writeJson,
} from "./browserStorage";
import { isUsableSong, newSongManifest } from "./manifests";

/**
 * The browser's song library - same exports as songLibrary.ts, backed by
 * localStorage instead of files (see browserStorage.ts). Metro picks this
 * file for the web build only.
 */

export { DRAFT_SONG_NAME } from "./manifests";

/** Reads every song. One unreadable entry is skipped rather than failing the whole scan. */
export async function listSongs(): Promise<SongManifest[]> {
  return readAllJson(SONG_KEY_PREFIX).filter(isUsableSong);
}

export function writeSong(manifest: SongManifest): void {
  writeJson(`${SONG_KEY_PREFIX}${manifest.id}`, manifest);
}

export function createSong(
  name?: string,
  lyrics: string | null = null,
): SongManifest {
  const manifest = newSongManifest(name, lyrics);
  writeSong(manifest);
  return manifest;
}

/** Deletes a song. Callers are responsible for unlinking it from any setlist that references it. */
export function deleteSong(id: string): void {
  removeKey(`${SONG_KEY_PREFIX}${id}`);
}
