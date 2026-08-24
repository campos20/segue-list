import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { readAppSettings } from "@/storage/appSettings";

interface SettingsState {
  libraryOrder: string[];
}

const initialState: SettingsState = {
  libraryOrder: readAppSettings().libraryOrder ?? [],
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    libraryOrderSet(state, action: PayloadAction<string[]>) {
      state.libraryOrder = action.payload;
    },
  },
});

export const { libraryOrderSet } = settingsSlice.actions;
export default settingsSlice.reducer;
