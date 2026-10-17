import { File } from "expo-file-system";
import type { SetlistManifest } from "@/types/setlist";
import { isUsableSetlist, newSetlistManifest } from "./manifests";
import {
  ensureSetlistsDirectoryExists,
  isFileSystemAvailable,
  setlistFile,
} from "./paths";

export { DRAFT_SETLIST_NAME } from "./manifests";

/** Reads every setlist off disk. One unreadable file is skipped rather than failing the whole scan. */
export async function listSetlists(): Promise<SetlistManifest[]> {
  if (!isFileSystemAvailable) return [];

  const files = ensureSetlistsDirectoryExists()
    .list()
    .filter(
      (item): item is File =>
        item instanceof File && item.name.endsWith(".json"),
    );

  const manifests = await Promise.all(
    files.map(async (file): Promise<SetlistManifest | null> => {
      try {
        const manifest = await file.json();
        return isUsableSetlist(manifest) ? manifest : null;
      } catch {
        return null;
      }
    }),
  );

  return manifests.filter(
    (manifest): manifest is SetlistManifest => manifest !== null,
  );
}

export function writeSetlist(manifest: SetlistManifest): void {
  if (!isFileSystemAvailable) return;
  ensureSetlistsDirectoryExists();
  setlistFile(manifest.id).write(JSON.stringify(manifest, null, 2));
}

export function createSetlist(name?: string): SetlistManifest {
  const manifest = newSetlistManifest(name);
  writeSetlist(manifest);
  return manifest;
}

/** Deletes a setlist. The songs it listed are untouched - they simply become loose again. */
export function deleteSetlist(id: string): void {
  if (!isFileSystemAvailable) return;
  const file = setlistFile(id);
  if (file.exists) file.delete();
}
