import { File } from "expo-file-system";
import { isAvailableAsync, shareAsync } from "expo-sharing";

/**
 * The app's one entry point to the OS share sheet.
 *
 * Handing a backup to the share sheet is what makes "save this to Drive"
 * work without the app ever knowing about Google: Drive, iCloud, email and a
 * USB cable are all just targets in the same sheet. Coming back the other
 * way needs nothing at all - a backup someone shares from their Drive
 * arrives through the ordinary file picker.
 */
export async function shareBundle(file: File, dialogTitle: string): Promise<void> {
  if (!(await isAvailableAsync())) {
    throw new Error("Sharing is not available on this device.");
  }

  await shareAsync(file.uri, {
    dialogTitle,
    mimeType: "application/json",
    UTI: "public.json",
  });
}
