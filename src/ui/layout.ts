import type { ViewStyle } from "react-native";

/** Only these three, so it fits a View and a Text alike. */
export type ReadableColumnStyle = Pick<
  ViewStyle,
  "width" | "maxWidth" | "alignSelf"
>;

/**
 * Applied to each screen's header/content/footer blocks so that, on a wide
 * screen, they sit in a centered column of readable width instead of
 * stretching edge to edge. On iOS/Android this is deliberately empty -
 * phone (and tablet) layouts stay exactly as they are; layout.web.ts is
 * where the column is defined. Not used by Presentation mode, where the
 * whole screen belongs to the lyrics.
 */
export const readableColumn: ReadableColumnStyle = {};
