import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  elevation,
  radii,
  spacing,
  useThemeColors,
  type ThemeColors,
} from "@/ui/theme";

export interface OverflowMenuItem {
  key: string;
  label: string;
  onPress: () => void;
  testID?: string;
  destructive?: boolean;
}

interface Anchor {
  top: number;
  left?: number;
  right?: number;
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
  const [anchor, setAnchor] = useState<Anchor>(() =>
    align === "end"
      ? { top: 80, right: spacing.lg }
      : { top: 80, left: spacing.lg },
  );

  function open() {
    setIsOpen(true);
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor(
        align === "end"
          ? {
              top: y + height + 6,
              right: Math.max(
                spacing.sm,
                Dimensions.get("window").width - (x + width),
              ),
            }
          : { top: y + height + 6, left: x },
      );
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
        <View style={[styles.menu, anchor]}>
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
              <Text
                style={[
                  styles.itemText,
                  item.destructive && styles.itemTextDestructive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  );
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
    item: {
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
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
