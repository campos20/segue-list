import type { DocumentPickerAsset } from "expo-document-picker";
import type { ReadableFile } from "./lyricsImport";

/**
 * The browser's counterpart to pickedFile.ts. On web, expo-document-picker
 * hands back the browser's own `File` object (`asset.file`) alongside a
 * `blob:` URI; reading it directly avoids a round trip through `fetch`,
 * which is only the fallback.
 */
async function blobOf(asset: DocumentPickerAsset): Promise<Blob> {
  if (asset.file) return asset.file;
  const response = await fetch(asset.uri);
  return response.blob();
}

export function openPickedFile(asset: DocumentPickerAsset): ReadableFile {
  return {
    async text() {
      return (await blobOf(asset)).text();
    },
    async bytes() {
      return new Uint8Array(await (await blobOf(asset)).arrayBuffer());
    },
  };
}
