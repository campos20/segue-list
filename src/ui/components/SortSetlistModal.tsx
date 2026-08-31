import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "@/i18n";
import type { SongManifest } from "@/types/song";
import {
  collectTags,
  sortAlphabetically,
  sortByTagPriority,
} from "@/ui/setlistSort";
import { moveItem } from "@/ui/reorder";
import {
  elevation,
  radii,
  spacing,
  useThemeColors,
  type ThemeColors,
} from "@/ui/theme";
import { Button } from "./Button";
import { MoveColumn } from "./MoveColumn";

interface SortSetlistModalProps {
  visible: boolean;
  songs: SongManifest[];
  onClose: () => void;
  onConfirm: (orderedSongIds: string[]) => void;
}

type SortMode = "alphabetical" | "tag";

/**
 * Lets the user reorder a setlist either alphabetically or by a tag
 * priority they arrange themselves - move-up/move-down buttons for that
 * priority list, not a drag gesture, same reasoning as every other
 * reorderable list in this app (see AGENTS.md).
 */
export function SortSetlistModal({
  visible,
  songs,
  onClose,
  onConfirm,
}: SortSetlistModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [mode, setMode] = useState<SortMode>("alphabetical");
  const [tagPriority, setTagPriority] = useState<string[]>([]);

  // Reset the draft to a fresh default each time the modal opens, without
  // clobbering the user's in-progress choice while it's up - the same
  // adjust-during-render sync used elsewhere in this app, keyed on the
  // open/closed transition rather than an entity id.
  const [wasVisible, setWasVisible] = useState(false);
  if (visible && !wasVisible) {
    setWasVisible(true);
    setMode("alphabetical");
    setTagPriority(collectTags(songs));
  } else if (!visible && wasVisible) {
    setWasVisible(false);
  }

  const availableTags = useMemo(() => collectTags(songs), [songs]);

  function handleConfirm() {
    const orderedIds =
      mode === "alphabetical"
        ? sortAlphabetically(songs)
        : sortByTagPriority(songs, tagPriority);
    onConfirm(orderedIds);
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
          <Text style={styles.title}>{t.setlist.sortTitle}</Text>

          <View style={styles.modeRow}>
            <Pressable
              onPress={() => setMode("alphabetical")}
              style={({ pressed }) => [
                styles.modeButton,
                mode === "alphabetical" && styles.modeButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  mode === "alphabetical" && styles.modeButtonTextActive,
                ]}
              >
                {t.setlist.sortAlphabetical}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("tag")}
              disabled={availableTags.length === 0}
              style={({ pressed }) => [
                styles.modeButton,
                mode === "tag" && styles.modeButtonActive,
                availableTags.length === 0 && styles.modeButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  mode === "tag" && styles.modeButtonTextActive,
                ]}
              >
                {t.setlist.sortByTag}
              </Text>
            </Pressable>
          </View>

          {mode === "tag" &&
            (availableTags.length === 0 ? (
              <Text style={styles.emptyTags}>{t.setlist.sortNoTags}</Text>
            ) : (
              <>
                <Text style={styles.tagListHint}>{t.setlist.sortTagHint}</Text>
                <ScrollView style={styles.tagListScroll}>
                  {tagPriority.map((tag, index) => (
                    <View key={tag} style={styles.tagPriorityRow}>
                      <Text style={styles.tagPriorityRank}>{index + 1}</Text>
                      <Text style={styles.tagPriorityName} numberOfLines={1}>
                        {tag}
                      </Text>
                      <MoveColumn
                        canMoveUp={index > 0}
                        canMoveDown={index < tagPriority.length - 1}
                        onMoveUp={() =>
                          setTagPriority(moveItem(tagPriority, index, "up"))
                        }
                        onMoveDown={() =>
                          setTagPriority(moveItem(tagPriority, index, "down"))
                        }
                        moveUpAccessibilityLabel={t.library.moveUp}
                        moveDownAccessibilityLabel={t.library.moveDown}
                      />
                    </View>
                  ))}
                </ScrollView>
              </>
            ))}

          <View style={styles.actions}>
            <Button variant="secondary" onPress={onClose}>
              {t.common.cancel}
            </Button>
            <Button
              onPress={handleConfirm}
              disabled={mode === "tag" && availableTags.length === 0}
            >
              {t.setlist.sortConfirm}
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
      maxWidth: 420,
      borderRadius: radii.lg,
      backgroundColor: colors.panelRaised,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
      ...elevation,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "800",
    },
    modeRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    modeButton: {
      flex: 1,
      borderRadius: radii.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingVertical: 10,
      alignItems: "center",
    },
    modeButtonActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    modeButtonDisabled: {
      opacity: 0.4,
    },
    modeButtonText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
    },
    modeButtonTextActive: {
      color: colors.accentText,
    },
    emptyTags: {
      color: colors.textTertiary,
      fontSize: 13,
    },
    tagListHint: {
      color: colors.textTertiary,
      fontSize: 12,
    },
    tagListScroll: {
      maxHeight: 240,
    },
    tagPriorityRow: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: spacing.xs,
      overflow: "hidden",
    },
    tagPriorityRank: {
      color: colors.textTertiary,
      fontSize: 13,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
      minWidth: 24,
      textAlign: "center",
    },
    tagPriorityName: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
      paddingVertical: 10,
    },
    actions: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    pressed: {
      opacity: 0.8,
    },
  });
}
