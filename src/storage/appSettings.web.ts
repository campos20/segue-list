import type { PersistedAppSettings } from "./appSettingsTypes";
import { readJson, SETTINGS_KEY, writeJson } from "./browserStorage";

/**
 * The browser's settings - same exports as appSettings.ts, backed by
 * localStorage instead of `settings.json` (see browserStorage.ts). Metro
 * picks this file for the web build only.
 */

export type { LyricsViewMode, PersistedAppSettings } from "./appSettingsTypes";

/**
 * Synchronous on purpose: read once at store-creation time, before the first
 * render, so there's no "flashes the wrong order, then swaps" window.
 */
export function readAppSettings(): PersistedAppSettings {
  const value = readJson(SETTINGS_KEY);
  return value !== null && typeof value === "object"
    ? (value as PersistedAppSettings)
    : {};
}

/**
 * Failing to persist must never block the UI - the change is already live in the store.
 *
 * Re-reads the stored settings right before writing and merges only the
 * changed fields on top, so another tab's change to a different setting is
 * kept rather than overwritten. (That fresh read also satisfies
 * browserStorage's "unchanged since last seen" check by design - the merge
 * is what protects settings, not that check.)
 */
export function writeAppSettings(changes: Partial<PersistedAppSettings>): void {
  try {
    writeJson(SETTINGS_KEY, { ...readAppSettings(), ...changes });
  } catch (error) {
    console.warn("Failed to persist app settings", error);
  }
}
