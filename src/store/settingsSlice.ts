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

const initialState: SettingsState = {
  libraryOrder: readAppSettings().libraryOrder ?? [],
  languageOverride: readAppSettings().languageOverride ?? null,
  presentationAllCaps: readAppSettings().presentationAllCaps ?? false,
  presentationFontSize: readAppSettings().presentationFontSize ?? DEFAULT_PRESENTATION_FONT_SIZE,
  presentationAutoScrollLevel: readAppSettings().presentationAutoScrollLevel ?? 0,
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
