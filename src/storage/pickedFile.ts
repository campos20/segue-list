import type { DocumentPickerAsset } from "expo-document-picker";
import { File } from "expo-file-system";
import type { ReadableFile } from "./lyricsImport";

/**
 * Opens a file the user picked with expo-document-picker for reading. On a
 * phone the picker hands back a `file://` copy in the cache directory
 * (`copyToCacheDirectory: true`), and expo-file-system's `File` already is a
 * ReadableFile. pickedFile.web.ts wraps the browser's own `File` object
 * instead - same export, chosen per platform by Metro.
 */
export function openPickedFile(asset: DocumentPickerAsset): ReadableFile {
  return new File(asset.uri);
}
