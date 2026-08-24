import { writeAppSettings } from "@/storage/appSettings";
import type { AppDispatch } from "./index";
import { libraryOrderSet } from "./settingsSlice";

/**
 * Persists the Library's top-level order over both setlists and loose
 * songs (see ui/libraryTree.ts for the prefixed-key scheme). Kept in its own
 * file rather than in persistSetlists.ts or persistSongs.ts since both need
 * it and neither owns it.
 */
export function persistLibraryOrder(orderedKeys: string[]) {
  return (dispatch: AppDispatch) => {
    dispatch(libraryOrderSet(orderedKeys));
    writeAppSettings({ libraryOrder: orderedKeys });
  };
}
