import { File, Paths } from "expo-file-system";
import type { PersistedAppSettings } from "./appSettingsTypes";
import { isFileSystemAvailable } from "./paths";

export type { LyricsViewMode, PersistedAppSettings } from "./appSettingsTypes";

/**
 * Synchronous on purpose: read once at store-creation time, before the first
 * render, so there's no "flashes the wrong order, then swaps" window.
 */
export function readAppSettings(): PersistedAppSettings {
  if (!isFileSystemAvailable) return {};
  try {
    const file = new File(Paths.document, "settings.json");
    if (!file.exists) return {};
    return JSON.parse(file.textSync());
  } catch {
    return {};
  }
}

/** Failing to persist must never block the UI - the change is already live in the store. */
export function writeAppSettings(changes: Partial<PersistedAppSettings>): void {
  if (!isFileSystemAvailable) return;
  try {
    const updated = { ...readAppSettings(), ...changes };
    new File(Paths.document, "settings.json").write(
      JSON.stringify(updated, null, 2),
    );
  } catch (error) {
    console.warn("Failed to persist app settings", error);
  }
}
