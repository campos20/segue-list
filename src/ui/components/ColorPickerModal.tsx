import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "@/i18n";
import type { ColorSpan } from "@/ui/lyricsColor";
import { radii, spacing, useThemeColors, type ThemeColors } from "@/ui/theme";
import { Button } from "./Button";

/** Shared by both the font-color and background-color rows, same as Word's quick color gallery reusing one grid for both tools. */
const PALETTE = [
  "FBBF24", // amber
  "34D399", // mint
  "60A5FA", // sky
  "F87171", // coral
  "A78BFA", // violet
  "F472B6", // rose
  "FB923C", // orange
  "9CA3AF", // gray
];

interface ColorPickerModalProps {
  visible: boolean;
  /** The selection's current span, if it exactly matches one - pre-fills the draft so changing just one of font/background color doesn't require re-picking the other. */
  initialSpan: ColorSpan | null;
  onApply: (span: ColorSpan | null) => void;
  onClose: () => void;
}

/**
 * Independent font-color and background-color pickers for the current
 * lyrics selection - similar to Word's Font Color / Text Highlight Color
 * tools, but combined into one small dialog with a single Apply rather than
 * two always-immediately-applied toolbar buttons. That keeps the "change
 * just the background, leave the font color as it was" case simple: the
 * draft starts from the selection's existing span (if any) and Apply
 * commits the whole thing at once, so there's no need to separately merge
 * partial updates into markup by hand.
 */
export function ColorPickerModal({
  visible,
  initialSpan,
  onApply,
  onClose,
}: ColorPickerModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [color, setColor] = useState<string | undefined>(undefined);
  const [background, setBackground] = useState<string | undefined>(undefined);

  // Reset the draft from the selection's current span each time the modal
  // opens, without clobbering an in-progress pick while it's up - the same
  // adjust-during-render sync used by SortSetlistModal, keyed on the
  // open/closed transition rather than an entity id.
  const [wasVisible, setWasVisible] = useState(false);
  if (visible && !wasVisible) {
    setWasVisible(true);
    setColor(initialSpan?.color);
    setBackground(initialSpan?.background);
  } else if (!visible && wasVisible) {
    setWasVisible(false);
  }

  function handleApply() {
    onApply(color || background ? { color, background } : null);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t.common.cancel}
        />
        <View style={styles.card}>
          <Text style={styles.title}>{t.song.colorTitle}</Text>

          <Text style={styles.label}>{t.song.textColorLabel}</Text>
          <SwatchRow
            selected={color}
            onSelect={setColor}
            noneLabel={t.song.colorNone}
          />

          <Text style={styles.label}>{t.song.backgroundColorLabel}</Text>
          <SwatchRow
            selected={background}
            onSelect={setBackground}
            noneLabel={t.song.colorNone}
          />

          <View style={styles.actions}>
            <Button variant="secondary" onPress={onClose}>
              {t.common.cancel}
            </Button>
            <Button onPress={handleApply}>{t.common.apply}</Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SwatchRow({
  selected,
  onSelect,
  noneLabel,
}: {
  selected: string | undefined;
  onSelect: (hex: string | undefined) => void;
  noneLabel: string;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.swatchRow}>
      <Pressable
        onPress={() => onSelect(undefined)}
        accessibilityLabel={noneLabel}
        style={({ pressed }) => [
          styles.noneSwatch,
          selected === undefined && styles.swatchSelected,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.noneSwatchText}>×</Text>
      </Pressable>
      {PALETTE.map((hex) => (
        <Pressable
          key={hex}
          onPress={() => onSelect(hex)}
          accessibilityLabel={`#${hex}`}
          style={({ pressed }) => [
            styles.swatch,
            { backgroundColor: `#${hex}` },
            selected === hex && styles.swatchSelected,
            pressed && styles.pressed,
          ]}
        />
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  const SWATCH_SIZE = 30;
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },
    card: {
      width: "100%",
      maxWidth: 420,
      borderRadius: radii.lg,
      backgroundColor: colors.panelRaised,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "800",
      marginBottom: spacing.xs,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "700",
      marginTop: spacing.sm,
    },
    swatchRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    swatch: {
      width: SWATCH_SIZE,
      height: SWATCH_SIZE,
      borderRadius: SWATCH_SIZE / 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    noneSwatch: {
      width: SWATCH_SIZE,
      height: SWATCH_SIZE,
      borderRadius: SWATCH_SIZE / 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    noneSwatchText: {
      color: colors.textTertiary,
      fontSize: 16,
      fontWeight: "700",
    },
    swatchSelected: {
      borderWidth: 2,
      borderColor: colors.accent,
    },
    pressed: {
      opacity: 0.7,
    },
    actions: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
  });
}
