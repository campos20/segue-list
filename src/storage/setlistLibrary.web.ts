import type { SetlistManifest } from "@/types/setlist";
import {
  readAllJson,
  removeKey,
  SETLIST_KEY_PREFIX,
  writeJson,
} from "./browserStorage";
import { isUsableSetlist, newSetlistManifest } from "./manifests";

/**
 * The browser's setlist library - same exports as setlistLibrary.ts,
 * backed by localStorage instead of files (see browserStorage.ts). Metro
 * picks this file for the web build only.
 */

export { DRAFT_SETLIST_NAME } from "./manifests";

/** Reads every setlist. One unreadable entry is skipped rather than failing the whole scan. */
export async function listSetlists(): Promise<SetlistManifest[]> {
  return readAllJson(SETLIST_KEY_PREFIX).filter(isUsableSetlist);
}

export function writeSetlist(manifest: SetlistManifest): void {
  writeJson(`${SETLIST_KEY_PREFIX}${manifest.id}`, manifest);
}

export function createSetlist(name?: string): SetlistManifest {
  const manifest = newSetlistManifest(name);
  writeSetlist(manifest);
  return manifest;
}

/** Deletes a setlist. The songs it listed are untouched - they simply become loose again. */
export function deleteSetlist(id: string): void {
  removeKey(`${SETLIST_KEY_PREFIX}${id}`);
}
