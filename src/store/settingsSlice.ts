import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Locale } from "@/i18n";
import { readAppSettings } from "@/storage/appSettings";

export const DEFAULT_PRESENTATION_FONT_SIZE = 18;

interface SettingsState {
  libraryOrder: string[];
  languageOverride: Locale | null;
  presentationAllCaps: boolean;
  presentationFontSize: number;
  /** 0 is off, 1-3 are slow to fast. */
  presentationAutoScrollLevel: number;
}

// Read once - `readAppSettings()` is a synchronous disk read, and each of
// these fields would otherwise trigger its own at store-creation time.
const persisted = readAppSettings();

const initialState: SettingsState = {
  libraryOrder: persisted.libraryOrder ?? [],
  languageOverride: persisted.languageOverride ?? null,
  presentationAllCaps: persisted.presentationAllCaps ?? false,
  presentationFontSize:
    persisted.presentationFontSize ?? DEFAULT_PRESENTATION_FONT_SIZE,
  presentationAutoScrollLevel: persisted.presentationAutoScrollLevel ?? 0,
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    libraryOrderSet(state, action: PayloadAction<string[]>) {
      state.libraryOrder = action.payload;
    },
    languageOverrideSet(state, action: PayloadAction<Locale | null>) {
      state.languageOverride = action.payload;
    },
    presentationAllCapsSet(state, action: PayloadAction<boolean>) {
      state.presentationAllCaps = action.payload;
    },
    presentationFontSizeSet(state, action: PayloadAction<number>) {
      state.presentationFontSize = action.payload;
    },
    presentationAutoScrollLevelSet(state, action: PayloadAction<number>) {
      state.presentationAutoScrollLevel = action.payload;
    },
  },
});

export const {
  libraryOrderSet,
  languageOverrideSet,
  presentationAllCapsSet,
  presentationFontSizeSet,
  presentationAutoScrollLevelSet,
} = settingsSlice.actions;
export default settingsSlice.reducer;
