import { ImportSongScreen } from "@/ui/screens/ImportSongScreen";

/**
 * A song shared by QR code: `seguelist://import?d=...` on a phone,
 * `<site>/import#...` on the web. See ui/songLink.ts.
 */
export default function ImportSongRoute() {
  return <ImportSongScreen />;
}
