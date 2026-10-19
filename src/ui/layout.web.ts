import type { ViewStyle } from "react-native";

/** Only these three, so it fits a View and a Text alike. */
export type ReadableColumnStyle = Pick<
  ViewStyle,
  "width" | "maxWidth" | "alignSelf"
>;

/**
 * The browser's counterpart to layout.ts. A desktop window is often 1500px+
 * wide; a library row, a settings item or the song editor stretched that
 * far reads badly (the title on one edge, its buttons on the other). 800px
 * fits the song editor's monospace lyrics comfortably and keeps the library
 * compact. Each block only gets a max width and centers itself - the
 * screen's background, and scrolling, still span the whole window.
 */
export const READABLE_COLUMN_WIDTH = 800;

export const readableColumn: ReadableColumnStyle = {
  width: "100%",
  maxWidth: READABLE_COLUMN_WIDTH,
  alignSelf: "center",
};
