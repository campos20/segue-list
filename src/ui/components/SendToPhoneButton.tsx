import type { SongManifest } from "@/types/song";

/**
 * Nothing on iOS/Android. "Send to phone" exists for the web version -
 * editing at a keyboard, then getting the song onto the phone - and draws a
 * QR code with a web-only library, so it lives in SendToPhoneButton.web.tsx,
 * which Metro keeps out of the phone bundle.
 */
export function SendToPhoneButton(_props: {
  song: SongManifest;
  hasUnsavedChanges: boolean;
}) {
  return null;
}
