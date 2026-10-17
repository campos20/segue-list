/**
 * Nothing on iOS/Android - a phone's library lives in its documents
 * directory, with none of a browser's storage caveats. The web build gets
 * WebLibraryBanner.web.tsx instead (Metro picks it per platform), so none
 * of that file ships to a phone.
 */
export function WebLibraryBanner() {
  return null;
}
