import {
  importBundle as importBundleFile,
  isNewerThan,
  type ImportedBundle,
} from "@/storage/bundle";
import { writeSetlist } from "@/storage/setlistLibrary";
import { writeSong } from "@/storage/songLibrary";
import type { SetlistManifest } from "@/types/setlist";
import type { SongManifest } from "@/types/song";
import type { AppDispatch, RootState } from "./index";
import {
  setlistAdded,
  setlistReplaced,
  setlistsSelectors,
} from "./setlistsSlice";
import { songAdded, songReplaced, songsSelectors } from "./songsSlice";

/**
 * Parses a `.seguelist` backup's text and merges anything new into the
 * local library. Every item that was actually written reaches the store,
 * even when others in the same backup failed (see
 * ImportedBundle.failedSongIds) - the store never misses something that's
 * on disk.
 */
export function importBundleIntoLibrary(bundleText: string) {
  return (dispatch: AppDispatch, getState: () => RootState): ImportedBundle => {
    const state = getState();
    const result = importBundleFile(bundleText, {
      songs: songsSelectors.selectAll(state.songs),
      setlists: setlistsSelectors.selectAll(state.setlists),
    });

    for (const song of result.songs) dispatch(songAdded(song));
    for (const setlist of result.setlists) dispatch(setlistAdded(setlist));

    return result;
  };
}

export interface AppliedNewer {
  updatedSongIds: string[];
  updatedSetlistIds: string[];
  failedCount: number;
}

/**
 * Replaces local songs/setlists with a bundle's newer copies (see
 * ImportedBundle.newerSongs) - only ever called after the user confirmed.
 *
 * Each one is re-checked against the store right before writing, so a copy
 * that stopped being newer since the import was read (edited again while
 * the dialog was up, or deleted) is left alone. Same write-then-dispatch
 * contract as persistSongs.ts: the store only hears about a replacement
 * whose file write succeeded.
 */
export function applyNewerFromBundle(newer: {
  songs: SongManifest[];
  setlists: SetlistManifest[];
}) {
  return (dispatch: AppDispatch, getState: () => RootState): AppliedNewer => {
    const updatedSongIds: string[] = [];
    const updatedSetlistIds: string[] = [];
    let failedCount = 0;

    for (const song of newer.songs) {
      const local = songsSelectors.selectById(getState().songs, song.id);
      if (!local || !isNewerThan(song, local)) continue;
      try {
        writeSong(song);
      } catch (error) {
        console.warn(`Failed to update song "${song.id}" from backup`, error);
        failedCount++;
        continue;
      }
      dispatch(songReplaced(song));
      updatedSongIds.push(song.id);
    }

    for (const setlist of newer.setlists) {
      const local = setlistsSelectors.selectById(
        getState().setlists,
        setlist.id,
      );
      if (!local || !isNewerThan(setlist, local)) continue;
      try {
        writeSetlist(setlist);
      } catch (error) {
        console.warn(
          `Failed to update setlist "${setlist.id}" from backup`,
          error,
        );
        failedCount++;
        continue;
      }
      dispatch(setlistReplaced(setlist));
      updatedSetlistIds.push(setlist.id);
    }

    return { updatedSongIds, updatedSetlistIds, failedCount };
  };
}
