import { File, Paths } from "expo-file-system";
import { isAvailableAsync, shareAsync } from "expo-sharing";
import { bundleFileName } from "./bundle";
import { docxFileName } from "./docxExport";
import { isFileSystemAvailable } from "./paths";

/**
 * The app's one way to hand a generated file to the user.
 *
 * On a phone that's the OS share sheet, which is what makes "save this to
 * Drive" work without the app ever knowing about Google: Drive, iCloud,
 * email and a USB cable are all just targets in the same sheet. Coming back
 * the other way needs nothing at all - a backup someone shares from their
 * Drive arrives through the ordinary file picker.
 *
 * share.web.ts is the browser's counterpart, with the same exports; Metro
 * picks one or the other per platform, so nothing here ships to the web
 * build and nothing in that file ships to iOS/Android.
 */
async function writeToCacheAndShare(
  fileName: string,
  contents: string | Uint8Array,
  dialogTitle: string,
  mimeType: string,
  UTI: string,
): Promise<void> {
  if (!isFileSystemAvailable) {
    throw new Error("Exporting isn't supported in this environment.");
  }
  const destination = new File(Paths.cache, fileName);
  if (destination.exists) destination.delete();
  destination.write(contents);

  if (!(await isAvailableAsync())) {
    throw new Error("Sharing is not available on this device.");
  }
  await shareAsync(destination.uri, { dialogTitle, mimeType, UTI });
}

/** Shares a `.seguelist` backup (see serializeBundle) named after `label`. */
export async function shareBundle(
  bundleText: string,
  label: string,
  dialogTitle: string,
): Promise<void> {
  await writeToCacheAndShare(
    bundleFileName(label),
    bundleText,
    dialogTitle,
    "application/json",
    "public.json",
  );
}

/** Shares a .docx (see buildSongsDocx) named after `label`. */
export async function shareDocx(
  docxBytes: Uint8Array,
  label: string,
  dialogTitle: string,
): Promise<void> {
  await writeToCacheAndShare(
    docxFileName(label),
    docxBytes,
    dialogTitle,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "org.openxmlformats.wordprocessingml.document",
  );
}
