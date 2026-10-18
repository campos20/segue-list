import { useLocalSearchParams } from "expo-router";

/**
 * The song payload an import link carries (see ui/songLink.ts). On a phone
 * it arrives as the `d` query parameter of `seguelist://import?d=...`;
 * importPayload.web.ts reads the web page's URL fragment instead.
 */
export function useImportPayload(): string | null {
  const { d } = useLocalSearchParams<{ d?: string }>();
  return typeof d === "string" && d.length > 0 ? d : null;
}
