import { configureStore } from "@reduxjs/toolkit";
import settingsReducer from "./settingsSlice";
import setlistsReducer from "./setlistsSlice";
import songsReducer from "./songsSlice";

// No RTK Query: there's no backend, everything here is local device state.
export function createAppStore() {
  return configureStore({
    reducer: {
      songs: songsReducer,
      setlists: setlistsReducer,
      settings: settingsReducer,
    },
  });
}

export const store = createAppStore();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
