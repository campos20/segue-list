/**
 * Plain-text version of a setlist - the name, then one numbered line per
 * song, no lyrics - meant for pasting into a chat (WhatsApp, SMS, email) so
 * someone can see the running order without opening the app. Numbering is
 * by position in the setlist, so a song that appears twice is numbered
 * twice.
 */
export function setlistToText(name: string, songNames: string[]): string {
  const lines = songNames.map((songName, index) => `${index + 1}. ${songName}`);
  return [name, "", ...lines].join("\n");
}
