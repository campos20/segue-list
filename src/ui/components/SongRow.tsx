import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/ui/theme";
import { KebabIcon, OverflowMenu, type OverflowMenuItem } from "./OverflowMenu";
import { MoveColumn } from "./MoveColumn";

interface SongRowProps {
  title: string;
  hasLyrics: boolean;
  hasLyricsLabel: string;
  noLyricsLabel: string;
  onPress: () => void;
  menuItems: OverflowMenuItem[];
  menuAccessibilityLabel: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  moveUpAccessibilityLabel: string;
  moveDownAccessibilityLabel: string;
  /** Indents the row and drops its shadow, for a song shown inside a setlist. */
  nested?: boolean;
  /** 1-based position within its setlist. Omitted at the top level, where there is no set to be fourth in. */
  position?: number;
  testID?: string;
}

export function SongRow({
  title,
  hasLyrics,
  hasLyricsLabel,
  noLyricsLabel,
  onPress,
  menuItems,
  menuAccessibilityLabel,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  moveUpAccessibilityLabel,
  moveDownAccessibilityLabel,
  nested,
  position,
  testID,
}: SongRowProps) {
  return (
    <View style={[styles.container, nested && styles.nested]}>
      <Pressable
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {position !== undefined && (
          <Text style={styles.position}>{position}</Text>
        )}
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.meta}>
            {hasLyrics ? hasLyricsLabel : noLyricsLabel}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <View style={styles.menuColumn}>
        <OverflowMenu
          items={menuItems}
          accessibilityLabel={menuAccessibilityLabel}
          testID={testID ? `${testID}-menu` : undefined}
        >
          <KebabIcon />
        </OverflowMenu>
      </View>

      <MoveColumn
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        moveUpAccessibilityLabel={moveUpAccessibilityLabel}
        moveDownAccessibilityLabel={moveDownAccessibilityLabel}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  nested: {
    // Reads as contained by the setlist above it rather than as another
    // top-level row: pulled in from the left, flatter background.
    marginLeft: spacing.lg,
    backgroundColor: colors.panelRaised,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  position: {
    color: colors.textTertiary,
    fontSize: 15,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    minWidth: 20,
    marginRight: spacing.sm,
    textAlign: "right",
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  meta: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  chevron: {
    color: colors.textTertiary,
    fontSize: 22,
    fontWeight: "600",
    marginLeft: spacing.sm,
  },
  menuColumn: {
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
});
