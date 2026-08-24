import { File } from "expo-file-system";
import type { SongManifest } from "@/types/song";
import { generateId } from "./ids";
import { ensureSongsDirectoryExists, isFileSystemAvailable, songFile } from "./paths";

export const DRAFT_SONG_NAME = "New song";

function isUsable(manifest: unknown): manifest is SongManifest {
  const candidate = manifest as SongManifest | null;
  return Boolean(candidate?.id) && typeof candidate?.name === "string";
}

/** Reads every song off disk. One unreadable file is skipped rather than failing the whole scan. */
export async function listSongs(): Promise<SongManifest[]> {
  if (!isFileSystemAvailable) return [];

  const files = ensureSongsDirectoryExists()
    .list()
    .filter((item): item is File => item instanceof File && item.name.endsWith(".json"));

  const manifests = await Promise.all(
    files.map(async (file): Promise<SongManifest | null> => {
      try {
        const manifest = await file.json();
        return isUsable(manifest) ? manifest : null;
      } catch {
        return null;
      }
    }),
  );

  return manifests.filter((manifest): manifest is SongManifest => manifest !== null);
}

export function writeSong(manifest: SongManifest): void {
  if (!isFileSystemAvailable) return;
  ensureSongsDirectoryExists();
  songFile(manifest.id).write(JSON.stringify(manifest, null, 2));
}

export function createSong(name = DRAFT_SONG_NAME): SongManifest {
  const now = new Date().toISOString();
  const manifest: SongManifest = {
    id: generateId(name),
    name,
    lyrics: null,
    createdAt: now,
    updatedAt: now,
  };
  writeSong(manifest);
  return manifest;
}

/** Deletes a song. Callers are responsible for unlinking it from any setlist that references it. */
export function deleteSong(id: string): void {
  if (!isFileSystemAvailable) return;
  const file = songFile(id);
  if (file.exists) file.delete();
}
