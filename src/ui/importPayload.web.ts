import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

/**
 * The browser's counterpart to importPayload.ts. A QR code points at
 * `<site>/import#<payload>`: the fragment is never sent to the server
 * (GitHub Pages never sees the song), so it's read from the page's own URL,
 * once, at mount. `?d=` is still accepted, for the same link shape the
 * app uses.
 */
export function useImportPayload(): string | null {
  const { d } = useLocalSearchParams<{ d?: string }>();
  const [fromFragment] = useState(() =>
    typeof window === "undefined" ? "" : window.location.hash.replace(/^#/, ""),
  );
  if (fromFragment.length > 0) return fromFragment;
  return typeof d === "string" && d.length > 0 ? d : null;
}
