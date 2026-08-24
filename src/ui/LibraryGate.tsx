import { useEffect, type ReactNode } from "react";
import { listSetlists, listSongs } from "@/storage";
import { useAppDispatch } from "@/store/hooks";
import { setlistsHydrated } from "@/store/setlistsSlice";
import { songsHydrated } from "@/store/songsSlice";

/**
 * Reads the whole local library (songs and setlists) off disk once at app
 * start.
 *
 * Lives at the root rather than in a screen because Expo Router restores
 * whatever route was last open - a detail screen can be the first thing
 * mounted after a reload, and it needs its data in the store by then.
 *
 * The two reads are independent: setlists only hold song ids, so a failure
 * to read them costs the user their grouping for this launch, never a song.
 * The Library falls back to showing everything loose rather than showing
 * nothing.
 */
export function LibraryGate({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let cancelled = false;

    listSongs()
      .then((songs) => {
        if (!cancelled) dispatch(songsHydrated(songs));
      })
      .catch((error) => {
        console.warn("Failed to read the song library", error);
        if (!cancelled) dispatch(songsHydrated([]));
      });

    listSetlists()
      .then((setlists) => {
        if (!cancelled) dispatch(setlistsHydrated(setlists));
      })
      .catch((error) => {
        console.warn("Failed to read setlists", error);
        if (!cancelled) dispatch(setlistsHydrated([]));
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return <>{children}</>;
}
