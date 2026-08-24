import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Locale } from "@/i18n";
import { readAppSettings } from "@/storage/appSettings";

interface SettingsState {
  libraryOrder: string[];
  languageOverride: Locale | null;
  presentationAllCaps: boolean;
}

const initialState: SettingsState = {
  libraryOrder: readAppSettings().libraryOrder ?? [],
  languageOverride: readAppSettings().languageOverride ?? null,
  presentationAllCaps: readAppSettings().presentationAllCaps ?? false,
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
  },
});

export const { libraryOrderSet, languageOverrideSet, presentationAllCapsSet } = settingsSlice.actions;
export default settingsSlice.reducer;
