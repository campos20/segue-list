import { bundleFileName } from "./bundle";
import { docxFileName } from "./docxExport";

/**
 * The browser's counterpart to share.ts - same exports, but the file is
 * downloaded instead of handed to a share sheet. A download is what a
 * browser user expects from "Export", and it's the same on every desktop
 * browser; from there the file reaches the phone however the user already
 * moves files (Drive, AirDrop, email, a cable) and comes in through the
 * app's ordinary "Import backup".
 */
function download(
  fileName: string,
  contents: string | Uint8Array<ArrayBuffer>,
  mimeType: string,
): void {
  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Revoking synchronously can cancel the download in some browsers;
    // a later tick is enough for it to have started.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/** Downloads a `.seguelist` backup (see serializeBundle) named after `label`. */
export async function shareBundle(
  bundleText: string,
  label: string,
  _dialogTitle: string,
): Promise<void> {
  download(bundleFileName(label), bundleText, "application/json");
}

/** Downloads a .docx (see buildSongsDocx) named after `label`. */
export async function shareDocx(
  docxBytes: Uint8Array,
  label: string,
  _dialogTitle: string,
): Promise<void> {
  download(
    docxFileName(label),
    new Uint8Array(docxBytes),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
}
