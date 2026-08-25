import { File } from "expo-file-system";
import { extractLyricsFromFile } from "@/storage/lyricsImport";
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

export interface LyricsFileImportFailure {
  fileName: string;
  error: string;
}

export interface LyricsFileImportResult {
  imported: SongManifest[];
  failed: LyricsFileImportFailure[];
}

/**
 * Creates one song per picked .txt/.docx/.odt file, named from the filename
 * with lyrics read out of it. Each file is isolated - one that fails to
 * parse is reported and skipped rather than aborting the batch, since a
 * bulk import of a folder of lyric sheets is exactly the case where one bad
 * file shouldn't cost you the other eleven.
 */
export function importSongsFromLyricsFiles(files: { uri: string; fileName: string }[]) {
  return async (dispatch: AppDispatch, getState: () => RootState): Promise<LyricsFileImportResult> => {
    const imported: SongManifest[] = [];
    const failed: LyricsFileImportFailure[] = [];

    for (const { uri, fileName } of files) {
      try {
        const { name, lyrics } = await extractLyricsFromFile(new File(uri), fileName);
        const song = createSongFile(name, lyrics || null);
        dispatch(songAdded(song));
        imported.push(song);
      } catch (error) {
        failed.push({ fileName, error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (imported.length > 0) {
      const order = getState().settings.libraryOrder;
      dispatch(persistLibraryOrder([...imported.map((song) => songKey(song.id)), ...order]));
    }

    return { imported, failed };
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
