/**
 * Nothing on iOS/Android - there, the import screen already is the app.
 * The web build gets OpenInAppLink.web.tsx: a phone camera opens the QR
 * link in the browser, and that's where the hand-off to the app happens.
 */
export function OpenInAppLink(_props: { payload: string }) {
  return null;
}
