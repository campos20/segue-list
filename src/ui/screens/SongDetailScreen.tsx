import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { ColorPickerModal } from "@/ui/components/ColorPickerModal";
import { LyricsPreviewDrawer } from "@/ui/components/LyricsPreviewDrawer";
import { TextField } from "@/ui/components/TextField";
import { applyColorAt, getSpanAt, type ColorSpan } from "@/ui/lyricsColor";
import {
  elevation,
  radii,
  spacing,
  useThemeColors,
  type ThemeColors,
} from "@/ui/theme";

// Matches the presentation screen's own lyrics style (PresentationScreen.tsx's
// default fontSize/lineHeight and font family), so the editor reads as a
// stand-in for the stage view rather than a plain form field.
const LYRICS_FONT_SIZE = 18;
const LYRICS_LINE_HEIGHT = 28;
const LYRICS_FONT_FAMILY = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

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
  const [lyricsSelection, setLyricsSelection] = useState({ start: 0, end: 0 });
  // Mirrors lyricsSelection but updated synchronously (no render lag), so
  // handleOpenColorPicker always reads the true latest selection even if
  // the user taps Color right after finishing a selection, before React
  // has re-rendered with the state from that selection change - a
  // stale-closure race that showed up as "have to tap twice".
  const lyricsSelectionRef = useRef({ start: 0, end: 0 });
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorPickerRange, setColorPickerRange] = useState({
    start: 0,
    end: 0,
  });

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

  /**
   * Opens the color picker for the current text selection - captured from
   * the ref (not the state variable) so it's never a render behind: reading
   * state here would capture whatever `lyricsSelection` was as of the last
   * render, which can still be the pre-selection value if this fires before
   * that render commits (the same stale-closure race that used to require
   * tapping twice). The selection is never fed back as a controlled
   * `selection` prop either way: round-tripping selection through state is
   * a known source of cursor-jump bugs on native TextInput, so this only
   * ever reads it.
   */
  function handleOpenColorPicker() {
    setColorPickerRange(lyricsSelectionRef.current);
    setColorPickerOpen(true);
  }

  /** Applies (or clears, for `span: null`) color across the range captured when the picker opened - see lyricsColor.ts. */
  function handleApplyColor(span: ColorSpan | null) {
    const { start, end } = colorPickerRange;
    setLyrics((current) => applyColorAt(current, start, end, span));
    setColorPickerOpen(false);
    lyricsSelectionRef.current = { start: 0, end: 0 };
    setLyricsSelection({ start: 0, end: 0 });
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
        {/*
          Fixed header (name, tags, the Highlight row) and fixed footer
          (Save/Present) never scroll away - only the lyrics box in between
          is flex: 1, so it's the one thing that shrinks/grows and scrolls
          internally. That's a deliberate layout choice: on a real stage,
          losing sight of Save mid-edit is worse than a shorter text box.
        */}
        <View style={styles.header}>
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

          <View style={styles.lyricsHeaderRow}>
            <Text style={styles.label}>{t.song.lyricsLabel}</Text>
            <Button
              variant="secondary"
              onPress={handleOpenColorPicker}
              disabled={lyricsSelection.start === lyricsSelection.end}
              style={styles.colorButton}
            >
              {t.song.colorButton}
            </Button>
          </View>
          <Text style={styles.hint}>{t.song.colorHint}</Text>
        </View>

        <View style={styles.lyricsSection}>
          <TextInput
            value={lyrics}
            onChangeText={setLyrics}
            onSelectionChange={(event) => {
              lyricsSelectionRef.current = event.nativeEvent.selection;
              setLyricsSelection(event.nativeEvent.selection);
            }}
            multiline
            textAlignVertical="top"
            placeholder={t.song.lyricsPlaceholder}
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
            cursorColor={colors.accent}
            style={styles.lyricsInput}
          />

          {/*
            Anchored to lyricsSection (not the whole screen) so it's always
            centered on the lyrics box itself, regardless of how tall the
            header ends up (more tags = taller header = lyricsSection starts
            lower) - a screen-relative percentage would drift into the
            header on a tag-heavy song.
          */}
          <Pressable
            onPress={() => setPreviewOpen(true)}
            style={({ pressed }) => [
              styles.previewTab,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.previewTabText}>
              {t.song.lyricsPreviewLabel}
            </Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
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
        </View>
      </KeyboardAvoidingView>

      <LyricsPreviewDrawer
        visible={previewOpen}
        lyrics={lyrics}
        onClose={() => setPreviewOpen(false)}
      />

      <ColorPickerModal
        visible={colorPickerOpen}
        initialSpan={getSpanAt(
          lyrics,
          colorPickerRange.start,
          colorPickerRange.end,
        )}
        onApply={handleApplyColor}
        onClose={() => setColorPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    // Never scrolls - name, tags, and the Highlight row stay on screen the
    // whole time you're editing.
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
      gap: spacing.xs,
    },
    // The one part of the screen that grows/shrinks with available space
    // and scrolls internally (via the TextInput's own native scrolling) -
    // see lyricsInput below.
    lyricsSection: {
      flex: 1,
      position: "relative",
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    // Never scrolls either - Save/Present are always reachable.
    footer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      gap: spacing.sm,
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
    lyricsHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    colorButton: {
      paddingVertical: 6,
      paddingHorizontal: spacing.md,
    },
    hint: {
      color: colors.textTertiary,
      fontSize: 11,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "700",
    },
    // A plain text field - a styled inline overlay was tried and found hard
    // to read, so the styled/highlighted rendering only lives in the
    // LyricsPreviewDrawer now. Still sized to match the presentation
    // screen's own lyrics font, so it at least *feels* like editing the
    // real thing. flex: 1 (both here and on lyricsSection) is what makes
    // this the one part of the screen that grows/shrinks - it scrolls
    // internally rather than pushing the header or footer off screen.
    lyricsInput: {
      flex: 1,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.background,
      color: colors.textPrimary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      fontSize: LYRICS_FONT_SIZE,
      lineHeight: LYRICS_LINE_HEIGHT,
      fontFamily: LYRICS_FONT_FAMILY,
    },
    // A tab pinned to the right edge of the lyrics box specifically (see
    // lyricsSection's position: relative) - opens LyricsPreviewDrawer.
    previewTab: {
      position: "absolute",
      right: 0,
      top: "50%",
      backgroundColor: colors.accent,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderTopLeftRadius: radii.md,
      borderBottomLeftRadius: radii.md,
      ...elevation,
    },
    previewTabText: {
      color: colors.accentText,
      fontSize: 13,
      fontWeight: "700",
    },
    savedText: {
      color: colors.success,
      fontSize: 13,
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
