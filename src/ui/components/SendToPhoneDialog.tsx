import type { SongManifest } from "@/types/song";

/**
 * Whether the Library's song menu offers "Send to phone (QR code)". Not on
 * iOS/Android: the point is getting a song from the web version onto the
 * phone, and the QR code is drawn with a web-only library - the dialog
 * lives in SendToPhoneDialog.web.tsx, which Metro keeps out of the phone
 * bundle.
 */
export const SEND_TO_PHONE_SUPPORTED = false;

export function SendToPhoneDialog(_props: {
  song: SongManifest | null;
  onClose: () => void;
}) {
  return null;
}
