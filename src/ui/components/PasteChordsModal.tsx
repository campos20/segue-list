import { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "@/i18n";
import { radii, spacing, useThemeColors, type ThemeColors } from "@/ui/theme";
import { Button } from "./Button";

interface PasteChordsModalProps {
  visible: boolean;
  onImport: (pastedText: string) => void;
  onClose: () => void;
}

/**
 * Collects a pasted chord chart (chord line, lyric line, repeating - see
 * ui/chords.ts's parseChordsAndLyrics, which does the actual splitting) and
 * hands the raw text back via onImport. Deliberately just a big plain
 * TextInput, not a dedicated paste button/clipboard API: the OS's own
 * paste gesture (long-press, Cmd+V) already works on any TextInput, so no
 * new dependency (e.g. expo-clipboard) is needed for something this simple
 * - see AGENTS.md on weighing new dependencies.
 */
export function PasteChordsModal({
  visible,
  onImport,
  onClose,
}: PasteChordsModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [text, setText] = useState("");

  // Resets the draft each time the modal opens, without clobbering an
  // in-progress paste while it's up - same adjust-during-render sync as
  // ColorPickerModal, keyed on the open/closed transition.
  const [wasVisible, setWasVisible] = useState(false);
  if (visible && !wasVisible) {
    setWasVisible(true);
    setText("");
  } else if (!visible && wasVisible) {
    setWasVisible(false);
  }

  function handleImport() {
    if (!text.trim()) return;
    onImport(text);
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
          <Text style={styles.title}>{t.song.pasteChordsTitle}</Text>
          <Text style={styles.hint}>{t.song.pasteChordsHint}</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t.song.pasteChordsPlaceholder}
            placeholderTextColor={colors.textTertiary}
            multiline
            autoFocus
            style={styles.input}
          />
          <View style={styles.actions}>
            <Button variant="secondary" onPress={onClose}>
              {t.common.cancel}
            </Button>
            <Button onPress={handleImport} disabled={!text.trim()}>
              {t.song.pasteChordsImport}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
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
      maxWidth: 480,
      height: "82%",
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
    },
    hint: {
      color: colors.textTertiary,
      fontSize: 12,
    },
    input: {
      flex: 1,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      padding: spacing.sm,
      fontSize: 13,
      fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
      textAlignVertical: "top",
    },
    actions: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
  });
}
