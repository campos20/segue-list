import type { File } from "expo-file-system";
import {
  importBundle as importBundleFile,
  type ImportedBundle,
} from "@/storage/bundle";
import type { AppDispatch, RootState } from "./index";
import { setlistAdded, setlistsSelectors } from "./setlistsSlice";
import { songAdded, songsSelectors } from "./songsSlice";

/** Reads a `.seguelist` backup and merges anything new into the local library. */
export function importBundleIntoLibrary(file: File) {
  return (dispatch: AppDispatch, getState: () => RootState): ImportedBundle => {
    const state = getState();
    const result = importBundleFile(file, {
      songs: songsSelectors.selectAll(state.songs),
      setlists: setlistsSelectors.selectAll(state.setlists),
    });

    for (const song of result.songs) dispatch(songAdded(song));
    for (const setlist of result.setlists) dispatch(setlistAdded(setlist));

    return result;
  };
}
