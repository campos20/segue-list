import { useThemeColors } from "@/ui/theme";
import { StyleSheet, View } from "react-native";

/**
 * Small glyphs for OverflowMenu items, drawn with plain Views (triangles via
 * the border trick, lines and circles via absolutely-positioned Views) -
 * same approach as KebabIcon in OverflowMenu.tsx, deliberately not an icon
 * font. Every icon is laid out inside a fixed 18x18 box so they line up in
 * the menu regardless of shape.
 */
const SIZE = 18;

function ArrowTrayIcon({ direction }: { direction: "in" | "out" }) {
  const colors = useThemeColors();
  const color = colors.textSecondary;
  const pointingDown = direction === "in";
  return (
    <View style={styles.box}>
      <View
        style={[
          styles.arrowShaft,
          { backgroundColor: color, top: pointingDown ? 1 : 2 },
        ]}
      />
      <View
        style={[
          pointingDown ? styles.triangleDown : styles.triangleUp,
          pointingDown
            ? { borderTopColor: color, top: 8 }
            : { borderBottomColor: color, top: 1 },
        ]}
      />
      <View style={[styles.tray, { backgroundColor: color }]} />
    </View>
  );
}

export function ImportIcon() {
  return <ArrowTrayIcon direction="in" />;
}

export function ExportIcon() {
  return <ArrowTrayIcon direction="out" />;
}

function DocumentIcon({ direction }: { direction: "in" | "out" }) {
  const colors = useThemeColors();
  const color = colors.textSecondary;
  const pointingDown = direction === "in";
  return (
    <View style={styles.box}>
      <View style={[styles.documentBody, { borderColor: color }]}>
        <View style={[styles.documentLine, { backgroundColor: color }]} />
        <View
          style={[
            styles.documentLine,
            styles.documentLineShort,
            { backgroundColor: color },
          ]}
        />
      </View>
      <View
        style={[
          pointingDown ? styles.badgeTriangleDown : styles.badgeTriangleUp,
          pointingDown
            ? { borderTopColor: color }
            : { borderBottomColor: color },
        ]}
      />
    </View>
  );
}

export function ImportLyricsIcon() {
  return <DocumentIcon direction="in" />;
}

export function ExportDocxIcon() {
  return <DocumentIcon direction="out" />;
}

export function SettingsIcon() {
  const colors = useThemeColors();
  const color = colors.textSecondary;
  return (
    <View style={styles.box}>
      <View style={[styles.sliderLine, { backgroundColor: color, top: 3 }]} />
      <View
        style={[styles.sliderKnob, { backgroundColor: color, top: 1.5, left: 10 }]}
      />
      <View
        style={[styles.sliderLine, { backgroundColor: color, top: 8 }]}
      />
      <View
        style={[styles.sliderKnob, { backgroundColor: color, top: 6.5, left: 4 }]}
      />
      <View
        style={[styles.sliderLine, { backgroundColor: color, top: 13 }]}
      />
      <View
        style={[styles.sliderKnob, { backgroundColor: color, top: 11.5, left: 12 }]}
      />
    </View>
  );
}

export function AboutIcon() {
  const colors = useThemeColors();
  const color = colors.textSecondary;
  return (
    <View style={styles.box}>
      <View style={[styles.infoCircle, { borderColor: color }]} />
      <View style={[styles.infoDot, { backgroundColor: color }]} />
      <View style={[styles.infoStem, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: SIZE,
    height: SIZE,
  },
  arrowShaft: {
    position: "absolute",
    left: 8,
    width: 2,
    height: 7,
    borderRadius: 1,
  },
  triangleDown: {
    position: "absolute",
    left: 5,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  triangleUp: {
    position: "absolute",
    left: 5,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 5,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  tray: {
    position: "absolute",
    bottom: 0,
    left: 2,
    width: 14,
    height: 2,
    borderRadius: 1,
  },
  documentBody: {
    position: "absolute",
    left: 4,
    top: 1,
    width: 10,
    height: 14,
    borderWidth: 1.5,
    borderRadius: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  documentLine: {
    width: 5,
    height: 1.3,
    borderRadius: 1,
  },
  documentLineShort: {
    width: 3,
  },
  badgeTriangleDown: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 4,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  badgeTriangleUp: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderBottomWidth: 4,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  sliderLine: {
    position: "absolute",
    left: 1,
    width: 16,
    height: 1.5,
    borderRadius: 1,
  },
  sliderKnob: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  infoCircle: {
    position: "absolute",
    left: 1,
    top: 1,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  infoDot: {
    position: "absolute",
    left: 8,
    top: 5,
    width: 2,
    height: 2,
    borderRadius: 1,
  },
  infoStem: {
    position: "absolute",
    left: 8,
    top: 8.5,
    width: 2,
    height: 5,
    borderRadius: 1,
  },
});
