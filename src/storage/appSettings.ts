import { File, Paths } from "expo-file-system";
import type { Locale } from "@/i18n";
import { isFileSystemAvailable } from "./paths";

export interface PersistedAppSettings {
  /**
   * The Library's top-level order over *both* setlists and loose songs, as
   * prefixed keys (`setlist:x`, `song:y`) - see ui/libraryTree.ts. One list
   * rather than two because the two kinds interleave on screen. The order of
   * songs *within* a setlist is not here; it lives in that setlist's own
   * manifest, next to the membership it belongs to.
   */
  libraryOrder?: string[];
  /** Manually chosen language, overriding the device locale. Absent means "follow the device". */
  languageOverride?: Locale;
  /** Presentation mode's all-caps lyrics toggle, remembered across sessions. */
  presentationAllCaps?: boolean;
  /** Presentation mode's lyrics font size in points, remembered across sessions. */
  presentationFontSize?: number;
  /** Presentation mode's auto-scroll speed: 0 is off, 1-3 are slow to fast. */
  presentationAutoScrollLevel?: number;
}

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
