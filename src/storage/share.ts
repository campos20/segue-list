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
async function share(
  file: File,
  dialogTitle: string,
  mimeType: string,
  UTI: string,
): Promise<void> {
  if (!(await isAvailableAsync())) {
    throw new Error("Sharing is not available on this device.");
  }
  await shareAsync(file.uri, { dialogTitle, mimeType, UTI });
}

export async function shareBundle(
  file: File,
  dialogTitle: string,
): Promise<void> {
  await share(file, dialogTitle, "application/json", "public.json");
}

export async function shareDocx(
  file: File,
  dialogTitle: string,
): Promise<void> {
  await share(
    file,
    dialogTitle,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "org.openxmlformats.wordprocessingml.document",
  );
}
