import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, spacing } from "@/ui/theme";
import { MoveColumn } from "./MoveColumn";
import { KebabIcon, OverflowMenu, type OverflowMenuItem } from "./OverflowMenu";

interface SetlistRowProps {
  name: string;
  songsLabel: string;
  expanded: boolean;
  onToggle: () => void;
  expandAccessibilityLabel: string;
  menuItems: OverflowMenuItem[];
  menuAccessibilityLabel: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  moveUpAccessibilityLabel: string;
  moveDownAccessibilityLabel: string;
  /** When set, the name is replaced by a text field - the setlist is being renamed in place. */
  renaming?: boolean;
  renamePlaceholder?: string;
  onRenameSubmit?: (name: string) => void;
  onRenameCancel?: () => void;
  testID?: string;
}

/**
 * A setlist header in the Library, styled as a container for the song rows
 * indented beneath it rather than as another song. Renaming happens in
 * place, in this row.
 */
export function SetlistRow({
  name,
  songsLabel,
  expanded,
  onToggle,
  expandAccessibilityLabel,
  menuItems,
  menuAccessibilityLabel,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  moveUpAccessibilityLabel,
  moveDownAccessibilityLabel,
  renaming,
  renamePlaceholder,
  onRenameSubmit,
  onRenameCancel,
  testID,
}: SetlistRowProps) {
  return (
    <View style={styles.container}>
      <Pressable
        onPress={onToggle}
        disabled={renaming}
        accessibilityRole="button"
        accessibilityLabel={expandAccessibilityLabel}
        accessibilityState={{ expanded }}
        testID={testID}
        style={({ pressed }) => [
          styles.row,
          pressed && !renaming && styles.pressed,
        ]}
      >
        <View
          style={[
            styles.triangle,
            expanded ? styles.triangleOpen : styles.triangleClosed,
          ]}
        />
        <View style={styles.body}>
          {renaming ? (
            <TextInput
              defaultValue={name}
              placeholder={renamePlaceholder}
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={(event) =>
                onRenameSubmit?.(event.nativeEvent.text)
              }
              onBlur={onRenameCancel}
              testID={testID ? `${testID}-rename-input` : undefined}
            />
          ) : (
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
          )}
          <Text style={styles.meta}>{songsLabel}</Text>
        </View>
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
    borderRadius: radii.lg,
    backgroundColor: colors.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  triangle: {
    width: 0,
    height: 0,
    marginLeft: 4,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 9,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: colors.textSecondary,
  },
  triangleClosed: {
    transform: [{ rotate: "0deg" }],
  },
  triangleOpen: {
    transform: [{ rotate: "90deg" }],
  },
  body: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  input: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    padding: 0,
  },
  meta: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  menuColumn: {
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
});
