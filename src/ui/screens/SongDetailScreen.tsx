import { useTranslation } from "@/i18n";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { persistLyricsViewMode } from "@/store/persistSettings";
import { updateSong } from "@/store/persistSongs";
import { songsSelectors } from "@/store/songsSlice";
import {
  alignChordsAndLyricsRows,
  findInvalidChordTokens,
  pairChordsWithLyrics,
  parseChordsAndLyrics,
  transposeChordsText,
} from "@/ui/chords";
import { Button } from "@/ui/components/Button";
import { ColorPickerModal } from "@/ui/components/ColorPickerModal";
import {
  LyricsRichEditor,
  type LyricsRichEditorHandle,
} from "@/ui/components/LyricsRichEditor";
import { PasteChordsModal } from "@/ui/components/PasteChordsModal";
import { TextField } from "@/ui/components/TextField";
import {
  digitsFromDuration,
  formatDurationDigits,
  parseDurationDigits,
} from "@/ui/duration";
import {
  mergePlainLyricsEdit,
  plainTextFromLyrics,
  type ColorSpan,
} from "@/ui/lyricsColor";
import { radii, spacing, useThemeColors, type ThemeColors } from "@/ui/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
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
  // Raw digits only, no colon - the colon is positioned automatically for
  // display by formatDurationDigits. See duration.ts.
  const [durationDigits, setDurationDigits] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [chords, setChords] = useState("");
  // Semitones to transpose `chords` by for display - the stored `chords`
  // text is never rewritten by this, so it's always one Reset away from the
  // original pitch. See types/song.ts's transposeSteps.
  const [transposeSteps, setTransposeSteps] = useState(0);
  // Global, shared with Presentation mode's display - not a per-song or
  // per-visit choice. See settingsSlice.ts's LyricsViewMode and AGENTS.md.
  const mode = useAppSelector((state) => state.settings.lyricsViewMode);
  // The plain-text lyrics shown/edited in Chords mode - a separate draft
  // from `lyrics` (which stays the color-marked-up canonical value) so Rich
  // text mode never has to render or round-trip through plain text.
  // Derived fresh from `lyrics` each time Chords mode is entered (see
  // switchToChordsMode) and folded back on the way out (switchToRichMode /
  // handleSave) - see lyricsColor.ts's mergePlainLyricsEdit.
  const [chordsLyricsDraft, setChordsLyricsDraft] = useState("");
  // Focuses a newly-inserted row's chord field once it exists (the top of
  // the pair - matching the type-a-chord-line-then-Enter-into-its-lyric-line
  // flow) - see addLineAfter, which sets this, and each row's onLayout
  // below, which consumes it. A ref rather than state: the row's own native
  // onLayout (fired once its TextInput exists) is the actual signal to
  // focus, so there's no need to synchronize this through a render/effect
  // cycle.
  const pendingFocusIndexRef = useRef<number | null>(null);
  const chordLineInputRefs = useRef<(TextInput | null)[]>([]);
  const lyricLineInputRefs = useRef<(TextInput | null)[]>([]);
  const [hasSelection, setHasSelection] = useState(false);
  const [currentSpan, setCurrentSpan] = useState<ColorSpan | null>(null);
  const editorRef = useRef<LyricsRichEditorHandle>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  // Collapsed by default so the name field and lyrics box get most of the
  // screen - tags are secondary metadata, not something edited every time
  // this screen opens. Tapping the summary row expands the full editor.
  const [tagsExpanded, setTagsExpanded] = useState(false);
  // Hidden by default - the hint text was eating space every time this
  // screen opened, for something only worth reading once. The ⓘ button
  // reveals it on demand instead.
  const [durationHintVisible, setDurationHintVisible] = useState(false);
  const [saved, setSaved] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [pasteChordsOpen, setPasteChordsOpen] = useState(false);

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
    setDurationDigits(
      song.durationSeconds != null
        ? digitsFromDuration(song.durationSeconds)
        : "",
    );
    setLyrics(song.lyrics ?? "");
    setChords(song.chords ?? "");
    setTransposeSteps(song.transposeSteps ?? 0);
    setTags(song.tags ?? []);
    // mode is global and doesn't reset per song, but chordsLyricsDraft is
    // local draft state that does need seeding here if this song happens to
    // load while Chords mode is already active (switchToChordsMode won't
    // run in that case, since no tab press triggers it).
    if (mode === "chords")
      setChordsLyricsDraft(plainTextFromLyrics(song.lyrics ?? ""));
  }

  const parsedDuration = parseDurationDigits(durationDigits);

  /** Applies (or clears, for `span: null`) color to whatever's currently selected inside the editor's WebView - see LyricsRichEditor.tsx. */
  function handleApplyColor(span: ColorSpan | null) {
    if (span) editorRef.current?.applyColor(span);
    else editorRef.current?.clearColor();
    setColorPickerOpen(false);
  }

  /** Enters Chords mode (globally - see mode's declaration), deriving its plain-text lyrics draft fresh from the current (possibly colored) lyrics - see chordsLyricsDraft's declaration. */
  function switchToChordsMode() {
    setChordsLyricsDraft(plainTextFromLyrics(lyrics));
    dispatch(persistLyricsViewMode("chords"));
  }

  /** Leaves Chords mode (globally), folding any plain-text lyrics edit back into the canonical lyrics before Rich text mode renders it again. */
  function switchToRichMode() {
    setLyrics(mergePlainLyricsEdit(lyrics, chordsLyricsDraft));
    dispatch(persistLyricsViewMode("rich"));
  }

  /** Splits a pasted chord chart into the two draft fields via parseChordsAndLyrics, replacing whatever Chords mode currently has - confirmed first if that would discard existing content. Also resets transposeSteps to 0: the pasted chart is the new "original" pitch, not a transposition of whatever was there before. */
  function handlePasteChordsImport(pastedText: string) {
    const parsed = parseChordsAndLyrics(pastedText);
    function apply() {
      setChords(parsed.chords);
      setChordsLyricsDraft(parsed.lyrics);
      setTransposeSteps(0);
      setPasteChordsOpen(false);
    }
    const hasExistingContent =
      chords.trim().length > 0 || chordsLyricsDraft.trim().length > 0;
    if (hasExistingContent) {
      Alert.alert(
        t.song.pasteChordsOverwriteTitle,
        t.song.pasteChordsOverwriteBody,
        [
          { text: t.song.keepEditing, style: "cancel" },
          {
            text: t.song.pasteChordsOverwriteConfirm,
            style: "destructive",
            onPress: apply,
          },
        ],
      );
    } else {
      apply();
    }
  }

  // Chords mode's combined editor renders one row per line - a chord field
  // stacked directly above its paired lyric field, matching how Presentation
  // mode displays them - while `chords`/`chordsLyricsDraft` stay the two
  // flat, newline-joined strings handleSave already knows how to align and
  // validate. `chordLines` always has at least one row so a brand-new song
  // has somewhere to start typing. `displayChords` is `chords` transposed
  // for on-screen preview only - the chord field shows and (when
  // transposeSteps is 0) edits `chords` itself, never a transposed value,
  // so typing can never get tangled up with the transpose math.
  const chordLines = useMemo(() => {
    const paired = pairChordsWithLyrics(chords, chordsLyricsDraft);
    const withAtLeastOne =
      paired.length > 0 ? paired : [{ chords: "", lyrics: "" }];
    return withAtLeastOne.map((line) => ({
      ...line,
      displayChords: transposeChordsText(line.chords, transposeSteps),
    }));
  }, [chords, chordsLyricsDraft, transposeSteps]);

  function withPaddedLineArrays(
    apply: (chordLines: string[], lyricLines: string[]) => void,
  ) {
    const chordArr = chords.length > 0 ? chords.split("\n") : [];
    const lyricArr =
      chordsLyricsDraft.length > 0 ? chordsLyricsDraft.split("\n") : [];
    while (chordArr.length < chordLines.length) chordArr.push("");
    while (lyricArr.length < chordLines.length) lyricArr.push("");
    apply(chordArr, lyricArr);
    setChords(chordArr.join("\n"));
    setChordsLyricsDraft(lyricArr.join("\n"));
  }

  /**
   * A single-line field never contains "\n" (multiline is off), so this
   * can't desync the line-array invariant the other helpers rely on. Only
   * called while transposeSteps is 0 - the chord field is read-only
   * whenever it isn't (see its `editable` prop below), showing a transposed
   * preview instead of the editable original.
   */
  function updateChordLine(index: number, text: string) {
    withPaddedLineArrays((chordArr) => {
      chordArr[index] = text;
    });
  }

  function updateLyricLine(index: number, text: string) {
    withPaddedLineArrays((_chordArr, lyricArr) => {
      lyricArr[index] = text;
    });
  }

  /** Explicit action, not an Enter-key/newline interception - deterministic and easy to verify, in the spirit of this app's move-up/move-down buttons over a drag gesture (see AGENTS.md). */
  function addLineAfter(index: number) {
    withPaddedLineArrays((chordArr, lyricArr) => {
      chordArr.splice(index + 1, 0, "");
      lyricArr.splice(index + 1, 0, "");
    });
    pendingFocusIndexRef.current = index + 1;
  }

  function removeLine(index: number) {
    if (chordLines.length <= 1) return;
    withPaddedLineArrays((chordArr, lyricArr) => {
      chordArr.splice(index, 1);
      lyricArr.splice(index, 1);
    });
  }

  // Every tag used anywhere in the library, offered as one-tap suggestions
  // so tagging the same way twice doesn't require retyping (and doesn't
  // drift into near-duplicates like "live" vs "Live").
  const suggestedTags = useMemo(() => {
    // Keyed by lowercase so "live" and "Live" from different songs collapse
    // into one suggestion, and a tag the current song already has (in any
    // casing) is excluded rather than offered as a no-op tap - see addTag's
    // own case-insensitive duplicate check.
    const known = new Map<string, string>();
    for (const candidate of allSongs) {
      for (const tag of candidate.tags ?? []) {
        known.set(tag.toLowerCase(), tag);
      }
    }
    for (const tag of tags) known.delete(tag.toLowerCase());
    return Array.from(known.values()).sort((a, b) => a.localeCompare(b));
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

    // Chords mode's plain-text lyrics edit only lives in chordsLyricsDraft
    // until now - fold it back into the canonical lyrics first, exactly
    // like leaving the mode normally would (switchToRichMode).
    const mergedLyrics =
      mode === "chords"
        ? mergePlainLyricsEdit(lyrics, chordsLyricsDraft)
        : lyrics;

    // With chords, trim by row (dropping only rows blank on both sides) so
    // chord-only rows survive and no lyric slides up against the wrong
    // chords - a plain lyrics.trim() would strip a leading blank lyric row
    // and, worse, leave every chord after it paired with the wrong line, or
    // drop all the chords outright when the lyrics are empty. Without any
    // chords there's nothing to keep aligned, so it's the plain trim.
    const hasAnyChord = chords
      .split("\n")
      .some((line) => line.trim().length > 0);
    const aligned = hasAnyChord
      ? alignChordsAndLyricsRows(chords, mergedLyrics)
      : { chords: "", lyrics: mergedLyrics.trim() };

    const invalidTokens = findInvalidChordTokens(aligned.chords);
    if (invalidTokens.length > 0) {
      Alert.alert(
        t.song.invalidChordsTitle,
        t.song.invalidChordsBody(invalidTokens),
      );
      return;
    }

    // A chord-only song can have lyrics that are nothing but blank rows;
    // that's saved as no lyrics rather than a string of newlines. The chords
    // still carry the row count on their own (pairChordsWithLyrics pads).
    const savedLyrics =
      plainTextFromLyrics(aligned.lyrics).trim().length > 0
        ? aligned.lyrics
        : "";
    const savedChords = aligned.chords;

    // Mirror exactly what gets dispatched below, or isDirty (which compares
    // this local draft state against the saved song) can end up stuck
    // true forever - the trim above can shorten the lyrics by rows that
    // chordsLyricsDraft doesn't know about yet, and blank chords save as
    // null. Left unreconciled, every future isDirty check reads true, which
    // is silent on web (Alert.alert is a no-op there - see AGENTS.md) but on
    // native means Present/Back show a "Discard changes?" prompt that never
    // stops appearing, even right after a successful save.
    setLyrics(savedLyrics);
    setChords(savedChords);
    if (mode === "chords") {
      setChordsLyricsDraft(plainTextFromLyrics(savedLyrics));
    }

    dispatch(
      updateSong(song.id, {
        name: name.trim(),
        durationSeconds: parsedDuration,
        lyrics: savedLyrics || null,
        chords: savedChords || null,
        transposeSteps,
        tags,
      }),
    );
    setSaved(true);
  }

  const isDirty =
    name !== song.name ||
    parsedDuration !== (song.durationSeconds ?? null) ||
    lyrics !== (song.lyrics ?? "") ||
    chords !== (song.chords ?? "") ||
    transposeSteps !== (song.transposeSteps ?? 0) ||
    (mode === "chords" && chordsLyricsDraft !== plainTextFromLyrics(lyrics)) ||
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
          Fixed header (name, tags, the Color row) and fixed footer
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
              autoFocus
            />
          </View>

          <View style={styles.section}>
            <View style={styles.durationTagsRow}>
              <View style={styles.durationColumn}>
                <View style={styles.durationLabelRow}>
                  <Text style={styles.label}>{t.song.durationLabel}</Text>
                  <Pressable
                    onPress={() =>
                      setDurationHintVisible((visible) => !visible)
                    }
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t.song.durationHintToggleLabel(
                      durationHintVisible,
                    )}
                    accessibilityState={{ expanded: durationHintVisible }}
                  >
                    <Text style={styles.infoIcon}>ⓘ</Text>
                  </Pressable>
                </View>
                <TextField
                  value={formatDurationDigits(durationDigits)}
                  onChangeText={(text) =>
                    // Colon is display-only, positioned automatically by
                    // formatDurationDigits from whatever raw digits are
                    // typed - stripping non-digits here also throws away
                    // any colon this same onChangeText round-tripped back in.
                    // No length cap: durations aren't bounded elsewhere
                    // (digitsFromDuration can produce more than 4 digits),
                    // so truncating here would make long durations
                    // unenterable and break round-tripping on reopen.
                    setDurationDigits(text.replace(/\D/g, ""))
                  }
                  placeholder={t.song.durationPlaceholder}
                  keyboardType="number-pad"
                />
                {durationHintVisible && (
                  <Text style={styles.hint}>{t.song.durationDefaultHint}</Text>
                )}
              </View>

              <Pressable
                onPress={() => setTagsExpanded((expanded) => !expanded)}
                style={({ pressed }) => [
                  styles.tagsColumn,
                  pressed && styles.pressed,
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t.song.tagsToggleLabel(tagsExpanded)}
                accessibilityState={{ expanded: tagsExpanded }}
              >
                <View style={styles.tagsSummaryRow}>
                  <Text style={styles.label}>{t.song.tagsLabel}</Text>
                  <Text style={styles.tagsChevron}>
                    {tagsExpanded ? "▲" : "▼"}
                  </Text>
                </View>
                <Text
                  style={styles.tagsSummaryText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {tags.length > 0 ? tags.join(", ") : t.song.noTags}
                </Text>
              </Pressable>
            </View>

            {tagsExpanded && (
              <>
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
                          accessibilityLabel={`${t.song.addTag} ${tag}`}
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
              </>
            )}
          </View>

          <View style={styles.lyricsHeaderRow}>
            <View style={styles.modeTabRow}>
              <Pressable
                onPress={() => mode !== "rich" && switchToRichMode()}
                style={[
                  styles.modeTab,
                  mode === "rich" && styles.modeTabActive,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === "rich" }}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    mode === "rich" && styles.modeTabTextActive,
                  ]}
                >
                  {t.song.richTextTab}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => mode !== "chords" && switchToChordsMode()}
                style={[
                  styles.modeTab,
                  mode === "chords" && styles.modeTabActive,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === "chords" }}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    mode === "chords" && styles.modeTabTextActive,
                  ]}
                >
                  {t.song.chordsTab}
                </Text>
              </Pressable>
            </View>
            {mode === "rich" && (
              <Button
                variant="secondary"
                onPress={() => setColorPickerOpen(true)}
                disabled={!hasSelection}
                style={styles.colorButton}
              >
                {t.song.colorButton}
              </Button>
            )}
            {mode === "chords" && (
              <Button
                variant="secondary"
                onPress={() => setPasteChordsOpen(true)}
                style={styles.colorButton}
              >
                {t.song.pasteChordsButton}
              </Button>
            )}
          </View>
          <Text style={styles.hint}>
            {mode === "rich" ? t.song.colorHint : t.song.chordsModeHint}
          </Text>
          {mode === "chords" && (
            <View style={styles.transposeRow}>
              <Pressable
                onPress={() => setTransposeSteps((steps) => steps - 1)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t.song.transposeDownLabel}
                style={styles.transposeButton}
              >
                <Text style={styles.transposeButtonText}>−½</Text>
              </Pressable>
              <Text style={styles.transposeValue}>
                {transposeSteps === 0
                  ? t.song.transposeOriginal
                  : t.song.transposeLabel(transposeSteps)}
              </Text>
              <Pressable
                onPress={() => setTransposeSteps((steps) => steps + 1)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t.song.transposeUpLabel}
                style={styles.transposeButton}
              >
                <Text style={styles.transposeButtonText}>+½</Text>
              </Pressable>
              {transposeSteps !== 0 && (
                <Pressable
                  onPress={() => setTransposeSteps(0)}
                  hitSlop={8}
                  style={styles.transposeResetButton}
                >
                  <Text style={styles.transposeResetText}>
                    {t.song.transposeReset}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
          {mode === "chords" && transposeSteps !== 0 && (
            <Text style={styles.hint}>{t.song.transposeEditHint}</Text>
          )}
        </View>

        {mode === "rich" ? (
          <View style={styles.lyricsSection}>
            <LyricsRichEditor
              ref={editorRef}
              value={lyrics}
              onChangeText={setLyrics}
              onSelectionChange={(selected, span) => {
                setHasSelection(selected);
                setCurrentSpan(span);
              }}
              placeholder={t.song.lyricsPlaceholder}
            />
          </View>
        ) : (
          <View style={styles.lyricsSection}>
            <ScrollView
              style={styles.combinedLinesScroll}
              contentContainerStyle={styles.combinedLinesContent}
              keyboardShouldPersistTaps="handled"
            >
              {chordLines.map((line, index) => (
                <View
                  key={index}
                  style={styles.lineRow}
                  onLayout={() => {
                    if (pendingFocusIndexRef.current !== index) return;
                    pendingFocusIndexRef.current = null;
                    chordLineInputRefs.current[index]?.focus();
                  }}
                >
                  <View style={styles.lineInputs}>
                    <TextInput
                      ref={(el) => {
                        chordLineInputRefs.current[index] = el;
                      }}
                      value={line.displayChords}
                      onChangeText={(text) => updateChordLine(index, text)}
                      editable={transposeSteps === 0}
                      placeholder={t.song.chordsLabel}
                      placeholderTextColor={colors.textTertiary}
                      returnKeyType="next"
                      onSubmitEditing={() =>
                        lyricLineInputRefs.current[index]?.focus()
                      }
                      submitBehavior="submit"
                      style={[
                        styles.chordLineInput,
                        transposeSteps !== 0 && styles.chordLineInputReadOnly,
                      ]}
                    />
                    <TextInput
                      ref={(el) => {
                        lyricLineInputRefs.current[index] = el;
                      }}
                      value={line.lyrics}
                      onChangeText={(text) => updateLyricLine(index, text)}
                      placeholder={t.song.lyricsLabel}
                      placeholderTextColor={colors.textTertiary}
                      returnKeyType="next"
                      onSubmitEditing={() => addLineAfter(index)}
                      submitBehavior="submit"
                      style={styles.lyricLineInput}
                    />
                  </View>
                  <Pressable
                    onPress={() => removeLine(index)}
                    disabled={chordLines.length <= 1}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t.song.removeLineLabel(index + 1)}
                    style={styles.removeLineButton}
                  >
                    <Text
                      style={[
                        styles.removeLineText,
                        chordLines.length <= 1 && styles.removeLineTextDisabled,
                      ]}
                    >
                      ×
                    </Text>
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={() => addLineAfter(chordLines.length - 1)}
                style={({ pressed }) => [
                  styles.addLineButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.addLineText}>{t.song.addLine}</Text>
              </Pressable>
            </ScrollView>
          </View>
        )}

        <View style={styles.footer}>
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
            {saved && <Text style={styles.savedText}>{t.song.saved}</Text>}
          </View>
        </View>
      </KeyboardAvoidingView>

      <ColorPickerModal
        visible={colorPickerOpen}
        initialSpan={currentSpan}
        onApply={handleApplyColor}
        onClose={() => setColorPickerOpen(false)}
      />

      <PasteChordsModal
        visible={pasteChordsOpen}
        onImport={handlePasteChordsImport}
        onClose={() => setPasteChordsOpen(false)}
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
    // Never scrolls - name, tags, and the Color row stay on screen the
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
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      gap: spacing.xs,
    },
    // Chords mode's combined editor - one scrollable column of row pairs,
    // each a chord field directly above its lyric field, matching how
    // Presentation mode displays them (see chordLines in the component).
    combinedLinesScroll: {
      flex: 1,
    },
    combinedLinesContent: {
      paddingBottom: spacing.lg,
      gap: spacing.xs,
    },
    lineRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    lineInputs: {
      flex: 1,
      gap: 2,
    },
    chordLineInput: {
      borderRadius: radii.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.accent,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      fontSize: 13,
      fontWeight: "700",
      fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    },
    // While transposed, the chord field shows a preview it can't be typed
    // into (see the `editable` prop) - dimmed so that's legible at a glance.
    chordLineInputReadOnly: {
      opacity: 0.6,
    },
    lyricLineInput: {
      borderRadius: radii.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      fontSize: 14,
      fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    },
    removeLineButton: {
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    removeLineText: {
      color: colors.textTertiary,
      fontSize: 18,
      fontWeight: "700",
    },
    removeLineTextDisabled: {
      opacity: 0.3,
    },
    addLineButton: {
      alignSelf: "flex-start",
      marginTop: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    addLineText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "700",
    },
    // Never scrolls either - Save/Present are always reachable.
    footer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: spacing.xs,
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
    modeTabRow: {
      flexDirection: "row",
      gap: spacing.xs,
    },
    // Chords mode only - transposeSteps is a per-song setting (see
    // types/song.ts) that never rewrites the stored `chords` text, so
    // "Reset" always returns to the original pitch.
    transposeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    transposeButton: {
      borderRadius: radii.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
    },
    transposeButtonText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
    },
    transposeValue: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "700",
      minWidth: 84,
      textAlign: "center",
    },
    transposeResetButton: {
      paddingHorizontal: spacing.xs,
      paddingVertical: 4,
    },
    transposeResetText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "700",
    },
    modeTab: {
      borderRadius: radii.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    modeTabActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    modeTabText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "700",
    },
    modeTabTextActive: {
      color: colors.accentText,
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
    durationTagsRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
    },
    durationColumn: {
      width: 88,
      gap: spacing.xs,
    },
    durationLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    infoIcon: {
      color: colors.textTertiary,
      fontSize: 13,
    },
    tagsColumn: {
      flex: 1,
      minWidth: 0,
      paddingTop: 2,
      gap: 4,
    },
    tagsSummaryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    tagsSummaryText: {
      color: colors.textTertiary,
      fontSize: 13,
    },
    tagsChevron: {
      color: colors.textTertiary,
      fontSize: 10,
    },
    savedText: {
      color: colors.success,
      fontSize: 13,
    },
    actionsRow: {
      flexDirection: "row",
      alignItems: "center",
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
