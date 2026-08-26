import { Pressable, StyleSheet, View } from "react-native";
import { colors } from "@/ui/theme";

interface MoveColumnProps {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  moveUpAccessibilityLabel: string;
  moveDownAccessibilityLabel: string;
  testID?: string;
}

/**
 * The up/down reorder buttons used by every reorderable row in the app.
 * Explicit buttons rather than a drag gesture - deterministic, and doesn't
 * need to negotiate touch-responder priority against a sibling Pressable
 * inside a ScrollView.
 */
export function MoveColumn({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  moveUpAccessibilityLabel,
  moveDownAccessibilityLabel,
  testID,
}: MoveColumnProps) {
  return (
    <View style={styles.column}>
      <Pressable
        onPress={onMoveUp}
        disabled={!canMoveUp}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={moveUpAccessibilityLabel}
        testID={testID ? `${testID}-move-up` : undefined}
        style={({ pressed }) => [
          styles.button,
          pressed && canMoveUp && styles.pressed,
        ]}
      >
        <View style={[styles.arrowUp, !canMoveUp && styles.arrowDisabled]} />
      </Pressable>
      <Pressable
        onPress={onMoveDown}
        disabled={!canMoveDown}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={moveDownAccessibilityLabel}
        testID={testID ? `${testID}-move-down` : undefined}
        style={({ pressed }) => [
          styles.button,
          pressed && canMoveDown && styles.pressed,
        ]}
      >
        <View
          style={[styles.arrowDown, !canMoveDown && styles.arrowDisabled]}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    justifyContent: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  button: {
    width: 40,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  arrowUp: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: colors.textSecondary,
  },
  arrowDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.textSecondary,
  },
  arrowDisabled: {
    opacity: 0.25,
  },
});
