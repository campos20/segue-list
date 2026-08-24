import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

/**
 * expo-file-system has no web implementation - this app is built for
 * iOS/Android, where a setlist lives on stage in your pocket, not in a
 * browser tab. Every storage function checks this before touching the
 * filesystem, so running on web degrades to an empty, non-persistent
 * library instead of crashing at boot.
 */
export const isFileSystemAvailable = Platform.OS !== "web";

function songsDirectory(): Directory {
  return new Directory(Paths.document, "songs");
}

export function songFile(songId: string): File {
  return new File(songsDirectory(), `${songId}.json`);
}

/** Ensures the songs directory exists and returns it. */
export function ensureSongsDirectoryExists(): Directory {
  const directory = songsDirectory();
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

function setlistsDirectory(): Directory {
  return new Directory(Paths.document, "setlists");
}

export function setlistFile(setlistId: string): File {
  return new File(setlistsDirectory(), `${setlistId}.json`);
}

/** Ensures the setlists directory exists and returns it. */
export function ensureSetlistsDirectoryExists(): Directory {
  const directory = setlistsDirectory();
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}
