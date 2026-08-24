import { createEntityAdapter, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SongManifest } from "@/types/song";

const songsAdapter = createEntityAdapter<SongManifest>();

const songsSlice = createSlice({
  name: "songs",
  // `hydrated` tells "no songs on disk yet" apart from "haven't read the disk yet".
  initialState: songsAdapter.getInitialState({ hydrated: false }),
  reducers: {
    songsHydrated(state, action: PayloadAction<SongManifest[]>) {
      songsAdapter.setAll(state, action.payload);
      state.hydrated = true;
    },
    songAdded: songsAdapter.addOne,
    songRemoved: songsAdapter.removeOne,
    songUpdated(state, action: PayloadAction<{ id: string; changes: Partial<SongManifest> }>) {
      songsAdapter.updateOne(state, { id: action.payload.id, changes: action.payload.changes });
    },
  },
});

export const { songsHydrated, songAdded, songRemoved, songUpdated } = songsSlice.actions;
export const songsSelectors = songsAdapter.getSelectors();
export default songsSlice.reducer;
