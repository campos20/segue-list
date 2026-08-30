import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "@/i18n";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateSong } from "@/store/persistSongs";
import { songsSelectors } from "@/store/songsSlice";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/TextField";
import { radii, spacing, useThemeColors, type ThemeColors } from "@/ui/theme";

export function SongDetailScreen() {
  const { songId } = useLocalSearchParams<{ songId: string }>();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const song = useAppSelector((state) =>
    songsSelectors.selectById(state.songs, songId),
  );
  const allSongs = useAppSelector((state) =>
    songsSelectors.selectAll(state.songs),
  );

  const [name, setName] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [saved, setSaved] = useState(false);

  // Adjusted during render rather than in an effect: resets the draft when
  // the song first becomes available (hydration can land after this screen
  // mounts) or when navigating to a different one, without clobbering an
  // in-progress edit on an unrelated store update.
  const [syncedSongId, setSyncedSongId] = useState<string | undefined>(
    undefined,
  );
  if (song && song.id !== syncedSongId) {
    setSyncedSongId(song.id);
    setName(song.name);
    setLyrics(song.lyrics ?? "");
    setTags(song.tags ?? []);
  }

  // Every tag used anywhere in the library, offered as one-tap suggestions
  // so tagging the same way twice doesn't require retyping (and doesn't
  // drift into near-duplicates like "live" vs "Live").
  const suggestedTags = useMemo(() => {
    const known = new Set<string>();
    for (const candidate of allSongs) {
      for (const tag of candidate.tags ?? []) known.add(tag);
    }
    for (const tag of tags) known.delete(tag);
    return Array.from(known).sort((a, b) => a.localeCompare(b));
  }, [allSongs, tags]);

  function addTag(raw: string) {
    const trimmed = raw.trim();
    setTagDraft("");
    if (!trimmed) return;
    if (tags.some((tag) => tag.toLowerCase() === trimmed.toLowerCase())) return;
    setTags([...tags, trimmed]);
  }

  function removeTag(tag: string) {
    setTags(tags.filter((candidate) => candidate !== tag));
  }

  if (!song) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <Text style={styles.notFound}>{t.song.notFound}</Text>
      </SafeAreaView>
    );
  }

  function handleSave() {
    if (!song || !name.trim()) return;
    dispatch(
      updateSong(song.id, {
        name: name.trim(),
        lyrics: lyrics.trim() || null,
        tags,
      }),
    );
    setSaved(true);
  }

  const isDirty =
    name !== song.name ||
    lyrics !== (song.lyrics ?? "") ||
    JSON.stringify(tags) !== JSON.stringify(song.tags ?? []);

  /** Confirms before leaving an unsaved edit behind - a lyrics rewrite is the kind of thing you don't want to accidentally lose. */
  function confirmDiscardIfDirty(proceed: () => void) {
    if (!isDirty) {
      proceed();
      return;
    }
    Alert.alert(t.song.discardTitle, t.song.discardBody, [
      { text: t.song.keepEditing, style: "cancel" },
      { text: t.song.discardConfirm, style: "destructive", onPress: proceed },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable
            onPress={() => confirmDiscardIfDirty(() => router.back())}
            hitSlop={8}
          >
            <Text style={styles.back}>{t.common.back}</Text>
          </Pressable>

          <View style={styles.section}>
            <TextField
              label={t.song.nameLabel}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>{t.song.tagsLabel}</Text>
            {tags.length > 0 && (
              <View style={styles.tagRow}>
                {tags.map((tag) => (
                  <Pressable
                    key={tag}
                    onPress={() => removeTag(tag)}
                    accessibilityLabel={t.song.removeTag(tag)}
                    style={({ pressed }) => [
                      styles.tagChip,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.tagChipText}>{tag}</Text>
                    <Text style={styles.tagChipRemove}>×</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <View style={styles.tagInputRow}>
              <View style={styles.tagInputField}>
                <TextField
                  value={tagDraft}
                  onChangeText={setTagDraft}
                  placeholder={t.song.tagsPlaceholder}
                  onSubmitEditing={() => addTag(tagDraft)}
                  returnKeyType="done"
                />
              </View>
              <Button
                variant="secondary"
                onPress={() => addTag(tagDraft)}
                disabled={!tagDraft.trim()}
              >
                {t.song.addTag}
              </Button>
            </View>
            {suggestedTags.length > 0 && (
              <View style={styles.tagSuggestions}>
                <Text style={styles.suggestionsLabel}>
                  {t.song.suggestedTags}
                </Text>
                <View style={styles.tagRow}>
                  {suggestedTags.map((tag) => (
                    <Pressable
                      key={tag}
                      onPress={() => addTag(tag)}
                      style={({ pressed }) => [
                        styles.tagSuggestionChip,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.tagSuggestionText}>{tag}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>{t.song.lyricsLabel}</Text>
            <TextInput
              value={lyrics}
              onChangeText={setLyrics}
              multiline
              numberOfLines={20}
              textAlignVertical="top"
              placeholder={t.song.lyricsPlaceholder}
              placeholderTextColor={colors.textTertiary}
              style={styles.lyricsInput}
            />
          </View>

          {saved && <Text style={styles.savedText}>{t.song.saved}</Text>}

          <View style={styles.actionsRow}>
            <Button onPress={handleSave} disabled={!name.trim()}>
              {t.common.save}
            </Button>
            <Button
              variant="secondary"
              onPress={() =>
                confirmDiscardIfDirty(() =>
                  router.push({
                    pathname: "/song/[songId]/present",
                    params: { songId: song.id },
                  }),
                )
              }
            >
              {t.setlist.present}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    },
    notFound: {
      color: colors.danger,
      padding: spacing.lg,
    },
    back: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    section: {
      marginTop: spacing.lg,
      gap: spacing.xs,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "700",
    },
    lyricsInput: {
      minHeight: 320,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 15,
      lineHeight: 22,
      fontFamily: Platform.select({
        ios: "Menlo",
        android: "monospace",
        default: "monospace",
      }),
    },
    savedText: {
      color: colors.success,
      fontSize: 13,
      marginTop: spacing.md,
    },
    actionsRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    tagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    tagChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: radii.pill,
      backgroundColor: colors.panelRaised,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    tagChipText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "600",
    },
    tagChipRemove: {
      color: colors.textTertiary,
      fontSize: 15,
      fontWeight: "700",
    },
    tagInputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    tagInputField: {
      flex: 1,
    },
    tagSuggestions: {
      marginTop: spacing.sm,
      gap: spacing.xs,
    },
    suggestionsLabel: {
      color: colors.textTertiary,
      fontSize: 11,
      fontWeight: "700",
    },
    tagSuggestionChip: {
      borderRadius: radii.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    tagSuggestionText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
