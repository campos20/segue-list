import {
  createSetlist as createSetlistFile,
  deleteSetlist as deleteSetlistFile,
  writeSetlist,
} from "@/storage/setlistLibrary";
import type { SetlistManifest } from "@/types/setlist";
import { moveItem } from "@/ui/reorder";
import { setlistKey } from "@/ui/libraryTree";
import type { AppDispatch, RootState } from "./index";
import { persistLibraryOrder } from "./persistLibrary";
import {
  setlistAdded,
  setlistRemoved,
  setlistUpdated,
  setlistsSelectors,
} from "./setlistsSlice";

/**
 * Setlist writes. Each one writes the file first and updates the store only
 * if that succeeded - the manifest on disk is the record, so the store must
 * never claim a change that isn't there.
 *
 * All of this is synchronous. A setlist holds song ids only, so nothing
 * here ever touches a song's own file - which is what makes reorganising
 * instant even for a large library.
 */

/** Creates a setlist and places it at the top of the Library, so it's visible immediately. */
export function createSetlist(name?: string) {
  return (
    dispatch: AppDispatch,
    getState: () => RootState,
  ): SetlistManifest | null => {
    let setlist: SetlistManifest;
    try {
      setlist = createSetlistFile(name);
    } catch (error) {
      console.warn("Failed to create a setlist", error);
      return null;
    }
    dispatch(setlistAdded(setlist));
    dispatch(
      persistLibraryOrder([
        setlistKey(setlist.id),
        ...getState().settings.libraryOrder,
      ]),
    );
    return setlist;
  };
}

export function renameSetlist(id: string, name: string) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    patch(dispatch, getState, id, { name });
  };
}

/**
 * Copies a setlist under a new name, at the top of the Library. The copy
 * references the same song ids as the source - songs aren't duplicated,
 * only the grouping is, same as any other setlist membership.
 */
export function duplicateSetlist(id: string, name: string) {
  return (
    dispatch: AppDispatch,
    getState: () => RootState,
  ): SetlistManifest | null => {
    const source = selectSetlist(getState(), id);
    if (!source) return null;

    let setlist: SetlistManifest;
    try {
      setlist = createSetlistFile(name);
      setlist = { ...setlist, songs: [...source.songs] };
      writeSetlist(setlist);
    } catch (error) {
      console.warn("Failed to duplicate a setlist", error);
      return null;
    }
    dispatch(setlistAdded(setlist));
    dispatch(
      persistLibraryOrder([
        setlistKey(setlist.id),
        ...getState().settings.libraryOrder,
      ]),
    );
    return setlist;
  };
}

/** Deletes a setlist. The songs it listed are untouched - they simply become loose again. */
export function deleteSetlist(id: string) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    try {
      deleteSetlistFile(id);
    } catch (error) {
      console.warn(`Failed to delete setlist "${id}"`, error);
      return;
    }
    dispatch(setlistRemoved(id));

    const key = setlistKey(id);
    const order = getState().settings.libraryOrder;
    if (order.includes(key))
      dispatch(persistLibraryOrder(order.filter((entry) => entry !== key)));
  };
}

/** No-ops if the song is already in the setlist, so a double-tap can't duplicate a row. */
export function addSongToSetlist(setlistId: string, songId: string) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    const setlist = selectSetlist(getState(), setlistId);
    if (!setlist || setlist.songs.includes(songId)) return;
    patch(dispatch, getState, setlistId, { songs: [...setlist.songs, songId] });
  };
}

export function removeSongFromSetlist(setlistId: string, songId: string) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    const setlist = selectSetlist(getState(), setlistId);
    if (!setlist) return;
    patch(dispatch, getState, setlistId, {
      songs: setlist.songs.filter((id) => id !== songId),
    });
  };
}

export function moveSongInSetlist(
  setlistId: string,
  index: number,
  direction: "up" | "down",
) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    const setlist = selectSetlist(getState(), setlistId);
    if (!setlist) return;
    const songs = moveItem(setlist.songs, index, direction);
    if (songs !== setlist.songs)
      patch(dispatch, getState, setlistId, { songs });
  };
}

/**
 * Replaces a setlist's whole song order at once - the bulk counterpart to
 * `moveSongInSetlist`'s single step, used by the sort modal. `songIds` must
 * be a permutation of the setlist's current songs; anything else is a no-op
 * rather than a way to sneak a song in or out of the setlist.
 */
export function reorderSetlistSongs(setlistId: string, songIds: string[]) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    const setlist = selectSetlist(getState(), setlistId);
    if (!setlist) return;
    const sameSongs =
      songIds.length === setlist.songs.length &&
      new Set(songIds).size === setlist.songs.length &&
      setlist.songs.every((id) => songIds.includes(id));
    if (!sameSongs) return;
    patch(dispatch, getState, setlistId, { songs: songIds });
  };
}

/** Drops a deleted song from every setlist that listed it - see persistSongs.ts's deleteSong. */
export function removeSongFromAllSetlists(songId: string) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    const setlists = setlistsSelectors
      .selectAll(getState().setlists)
      .filter((setlist) => setlist.songs.includes(songId));

    for (const setlist of setlists) {
      patch(dispatch, getState, setlist.id, {
        songs: setlist.songs.filter((id) => id !== songId),
      });
    }
  };
}

function selectSetlist(
  state: RootState,
  id: string,
): SetlistManifest | undefined {
  return setlistsSelectors.selectById(state.setlists, id);
}

/** Merges `changes` onto the store's copy, writes the file, then updates the store. */
function patch(
  dispatch: AppDispatch,
  getState: () => RootState,
  id: string,
  changes: Partial<Omit<SetlistManifest, "id" | "createdAt">>,
): void {
  const setlist = selectSetlist(getState(), id);
  if (!setlist) return;

  const updated: SetlistManifest = {
    ...setlist,
    ...changes,
    id,
    updatedAt: new Date().toISOString(),
  };
  try {
    writeSetlist(updated);
  } catch (error) {
    console.warn(`Failed to write setlist "${id}"`, error);
    return;
  }
  dispatch(
    setlistUpdated({
      id,
      changes: { ...changes, updatedAt: updated.updatedAt },
    }),
  );
}
