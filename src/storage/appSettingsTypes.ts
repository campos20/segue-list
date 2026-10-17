import type { Locale } from "@/i18n";
import type { ThemeOverride } from "@/types/theme";

/*
 * The shape of the persisted settings, shared by appSettings.ts (a JSON
 * file on a phone) and appSettings.web.ts (localStorage in a browser).
 */

/**
 * Whether lyrics are shown/edited as rich (colored) text or as plain text
 * paired with a chords field. Defined here (rather than in settingsSlice,
 * which reads this file) so both it and this file can reference the type
 * without an import cycle.
 */
export type LyricsViewMode = "rich" | "chords";

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
  /** Absent means "dark" - see types/theme.ts. */
  themeOverride?: ThemeOverride;
  /** Presentation mode's all-caps lyrics toggle, remembered across sessions. */
  presentationAllCaps?: boolean;
  /** Shared by SongDetailScreen's editing tabs and Presentation mode's display - see LyricsViewMode. Absent means "rich". */
  lyricsViewMode?: LyricsViewMode;
  /** Presentation mode's lyrics font size in points, remembered across sessions. */
  presentationFontSize?: number;
}
