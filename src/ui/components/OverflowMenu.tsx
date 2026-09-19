import { placeMenu } from "@/ui/menuPlacement";
import {
  elevation,
  radii,
  spacing,
  useThemeColors,
  type ThemeColors,
} from "@/ui/theme";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface OverflowMenuItem {
  key: string;
  label: string;
  onPress: () => void;
  testID?: string;
  destructive?: boolean;
  icon?: ReactNode; // Optional icon to display alongside the label
}

/** The trigger's position in window coordinates, from View.measureInWindow. */
interface TriggerRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OverflowMenuProps {
  items: OverflowMenuItem[];
  children: ReactNode;
  align?: "start" | "end";
  accessibilityLabel: string;
  testID?: string;
}

/**
 * A small dropdown anchored near whatever trigger it wraps, rendered through
 * a Modal so it paints above every other screen element on both platforms
 * without manual zIndex tuning. Position comes from `View.measureInWindow()`
 * - a long-standing core RN API, not a third-party popover library.
 *
 * Vertical placement is decided by placeMenu (ui/menuPlacement.ts) once the
 * menu has been laid out and its natural height is known: below the trigger
 * if it fits, else above, else on the roomier side with a capped height and
 * a scrollable list. It stays invisible until both that height and the
 * trigger's position are known, so it never flashes in the wrong place.
 */
export function OverflowMenu({
  items,
  children,
  align = "end",
  accessibilityLabel,
  testID,
}: OverflowMenuProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const triggerRef = useRef<View>(null);
  const [isOpen, setIsOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const [trigger, setTrigger] = useState<TriggerRect | null>(null);
  // The menu's natural height, taken from its first layout after opening -
  // not updated afterwards, so a height cap applied to a tall menu can't
  // feed back into the placement decision.
  const [menuHeight, setMenuHeight] = useState<number | null>(null);

  function open() {
    setTrigger(null);
    setMenuHeight(null);
    setIsOpen(true);
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setTrigger({ x, y, width, height });
    });
  }

  function close() {
    setIsOpen(false);
  }

  function handleSelect(item: OverflowMenuItem) {
    close();
    item.onPress();
  }

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={open}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {children}
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityLabel={accessibilityLabel}
          testID={testID ? `${testID}-backdrop` : undefined}
        />
        {trigger && (
          <View
            onLayout={(event) =>
              setMenuHeight(
                (current) => current ?? event.nativeEvent.layout.height,
              )
            }
            style={[
              styles.menu,
              menuPosition(trigger, menuHeight, align, insets),
              menuHeight === null && styles.menuMeasuring,
            ]}
          >
            <ScrollView bounces={false}>
              {items.map((item, index) => (
                <Pressable
                  key={item.key}
                  onPress={() => handleSelect(item)}
                  testID={item.testID}
                  style={({ pressed }) => [
                    styles.item,
                    index < items.length - 1 && styles.itemDivider,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.itemContent}>
                    {item.icon}
                    <Text
                      style={[
                        styles.itemText,
                        item.destructive && styles.itemTextDestructive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </Modal>
    </>
  );
}

function menuPosition(
  trigger: TriggerRect,
  menuHeight: number | null,
  align: "start" | "end",
  insets: { top: number; bottom: number },
) {
  const { top, maxHeight } = placeMenu({
    triggerTop: trigger.y,
    triggerHeight: trigger.height,
    menuHeight,
    windowHeight: Dimensions.get("window").height,
    insetTop: insets.top,
    insetBottom: insets.bottom,
  });
  const horizontal =
    align === "end"
      ? {
          right: Math.max(
            spacing.sm,
            Dimensions.get("window").width - (trigger.x + trigger.width),
          ),
        }
      : { left: trigger.x };
  return { top, maxHeight, ...horizontal };
}

/** The "..." trigger icon - three dots, drawn with Views rather than a glyph/icon font. */
export function KebabIcon() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.kebab}>
      <View style={styles.kebabDot} />
      <View style={styles.kebabDot} />
      <View style={styles.kebabDot} />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    pressed: {
      opacity: 0.6,
    },
    kebab: {
      width: 36,
      height: 36,
      borderRadius: radii.pill,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      // Same subtle wash as borderLight - white-on-dark or black-on-light,
      // whichever this theme is.
      backgroundColor: colors.borderLight,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    kebabDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textSecondary,
    },
    menu: {
      position: "absolute",
      minWidth: 180,
      maxWidth: 300,
      borderRadius: radii.lg,
      backgroundColor: colors.panelRaised,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
      ...elevation,
    },
    // Laid out at its natural size but not yet shown - see OverflowMenu's doc.
    menuMeasuring: {
      opacity: 0,
    },
    item: {
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
    },
    itemContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    itemDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    itemText: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    itemTextDestructive: {
      color: colors.danger,
    },
  });
}
