import type { Locale } from "@/i18n";
import { writeAppSettings } from "@/storage/appSettings";
import type { AppDispatch } from "./index";
import {
  languageOverrideSet,
  presentationAllCapsSet,
  presentationAutoScrollLevelSet,
  presentationFontSizeSet,
} from "./settingsSlice";

/** Sets the manual language override (or `null` to follow the device locale again) and persists it. */
export function persistLanguageOverride(locale: Locale | null) {
  return (dispatch: AppDispatch) => {
    dispatch(languageOverrideSet(locale));
    writeAppSettings({ languageOverride: locale ?? undefined });
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

/** Sets Presentation mode's auto-scroll speed (0 off, 1-3 slow to fast) and persists it. */
export function persistPresentationAutoScrollLevel(value: number) {
  return (dispatch: AppDispatch) => {
    dispatch(presentationAutoScrollLevelSet(value));
    writeAppSettings({ presentationAutoScrollLevel: value });
  };
}
