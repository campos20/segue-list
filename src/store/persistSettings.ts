import type { Locale } from "@/i18n";
import { writeAppSettings } from "@/storage/appSettings";
import type { ThemeOverride } from "@/types/theme";
import type { AppDispatch } from "./index";
import {
  languageOverrideSet,
  presentationAllCapsSet,
  presentationFontSizeSet,
  themeOverrideSet,
} from "./settingsSlice";

/** Sets the manual language override (or `null` to follow the device locale again) and persists it. */
export function persistLanguageOverride(locale: Locale | null) {
  return (dispatch: AppDispatch) => {
    dispatch(languageOverrideSet(locale));
    writeAppSettings({ languageOverride: locale ?? undefined });
  };
}

/** Sets the theme preference ("system" follows the device) and persists it. */
export function persistThemeOverride(theme: ThemeOverride) {
  return (dispatch: AppDispatch) => {
    dispatch(themeOverrideSet(theme));
    writeAppSettings({ themeOverride: theme });
  };
}

/** Sets Presentation mode's all-caps toggle and persists it, so it stays how you last left it. */
export function persistPresentationAllCaps(value: boolean) {
  return (dispatch: AppDispatch) => {
    dispatch(presentationAllCapsSet(value));
    writeAppSettings({ presentationAllCaps: value });
  };
}

/** Sets Presentation mode's lyrics font size and persists it. */
export function persistPresentationFontSize(value: number) {
  return (dispatch: AppDispatch) => {
    dispatch(presentationFontSizeSet(value));
    writeAppSettings({ presentationFontSize: value });
  };
}
