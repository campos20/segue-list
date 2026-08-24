import { createSong as createSongFile, deleteSong as deleteSongFile, writeSong } from "@/storage/songLibrary";
import type { SongManifest } from "@/types/song";
import { songKey } from "@/ui/libraryTree";
import type { AppDispatch, RootState } from "./index";
import { persistLibraryOrder } from "./persistLibrary";
import { removeSongFromAllSetlists } from "./persistSetlists";
import { songAdded, songRemoved, songUpdated, songsSelectors } from "./songsSlice";

/**
 * Song library writes. Each one writes the file first and updates the store
 * only if that succeeded, same contract as persistSetlists.ts.
 */

/** Creates a song, loose at the top of the Library, so it's visible immediately. */
export function createSong(name?: string) {
  return (dispatch: AppDispatch, getState: () => RootState): SongManifest | null => {
    let song: SongManifest;
    try {
      song = createSongFile(name);
    } catch (error) {
      console.warn("Failed to create a song", error);
      return null;
    }
    dispatch(songAdded(song));
    dispatch(persistLibraryOrder([songKey(song.id), ...getState().settings.libraryOrder]));
    return song;
  };
}

export function updateSong(id: string, changes: Partial<Omit<SongManifest, "id" | "createdAt">>) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    const song = songsSelectors.selectById(getState().songs, id);
    if (!song) return;

    const updated: SongManifest = { ...song, ...changes, id, updatedAt: new Date().toISOString() };
    try {
      writeSong(updated);
    } catch (error) {
      console.warn(`Failed to write song "${id}"`, error);
      return;
    }
    dispatch(songUpdated({ id, changes: { ...changes, updatedAt: updated.updatedAt } }));
  };
}

/** Deletes a song, drops it from every setlist that referenced it, and from the Library order. */
export function deleteSong(id: string) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    try {
      deleteSongFile(id);
    } catch (error) {
      console.warn(`Failed to delete song "${id}"`, error);
      return;
    }
    dispatch(songRemoved(id));
    dispatch(removeSongFromAllSetlists(id));

    const key = songKey(id);
    const order = getState().settings.libraryOrder;
    if (order.includes(key)) dispatch(persistLibraryOrder(order.filter((entry) => entry !== key)));
  };
}
