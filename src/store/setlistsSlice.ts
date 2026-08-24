import { createEntityAdapter, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SetlistManifest } from "@/types/setlist";

const setlistsAdapter = createEntityAdapter<SetlistManifest>();

const setlistsSlice = createSlice({
  name: "setlists",
  initialState: setlistsAdapter.getInitialState({ hydrated: false }),
  reducers: {
    setlistsHydrated(state, action: PayloadAction<SetlistManifest[]>) {
      setlistsAdapter.setAll(state, action.payload);
      state.hydrated = true;
    },
    setlistAdded: setlistsAdapter.addOne,
    setlistRemoved: setlistsAdapter.removeOne,
    setlistUpdated(state, action: PayloadAction<{ id: string; changes: Partial<SetlistManifest> }>) {
      setlistsAdapter.updateOne(state, { id: action.payload.id, changes: action.payload.changes });
    },
  },
});

export const { setlistsHydrated, setlistAdded, setlistRemoved, setlistUpdated } = setlistsSlice.actions;
export const setlistsSelectors = setlistsAdapter.getSelectors();
export default setlistsSlice.reducer;
