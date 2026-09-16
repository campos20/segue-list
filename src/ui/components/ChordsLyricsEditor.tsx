import { useMemo, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInputKeyPressEventData,
  type TextInputSelectionChangeEventData,
  type ViewStyle,
} from "react-native";
import { sanitizeChordsText } from "@/ui/chordValidation";
import {
  fromRows,
  mergeRowIntoPrevious,
  splitRowAt,
  toRows,
  type ChordsLyricsRow,
} from "@/ui/chordsLyricsRows";
import { radii, spacing, useThemeColors, type ThemeColors } from "@/ui/theme";

interface ChordsLyricsEditorProps {
  lyrics: string;
  chords: string;
  onChange: (lyrics: string, chords: string) => void;
  lyricsPlaceholder: string;
  chordsPlaceholder: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Plain-text alternative to LyricsRichEditor for songs whose chords matter
 * more than lyric coloring (see SongManifest.editorMode's doc comment).
 * Lyrics and chords are still stored as two separate strings, but here
 * they're edited as one list of paired rows - pressing Enter mid-lyric
 * splits that row in two (the chord line staying with the first half), and
 * Backspace at the start of a row merges it into the previous one. Because
 * a structural edit acts on both a row's lyric and chord text at once, the
 * two texts can never drift out of position relative to each other the way
 * two independently-edited free-text boxes could.
 *
 * This deliberately doesn't extend LyricsRichEditor's WebView - hand-
 * handling Enter (see splitRowAt below) is exactly the kind of caret
 * manipulation LyricsRichEditor's own doc comment explains was found
 * unreliable inside a contenteditable's Selection/Range API. Plain React
 * Native TextInputs plus refs don't have that problem; that reliability is
 * the whole reason this is a separate, simpler, color-free editor rather
 * than an extension of the rich one.
 */
export function ChordsLyricsEditor({
  lyrics,
  chords,
  onChange,
  lyricsPlaceholder,
  chordsPlaceholder,
  style,
}: ChordsLyricsEditorProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const rows = toRows(lyrics, chords);
  const lyricRefs = useRef<(TextInput | null)[]>([]);
  // Latest known cursor position per row - read only from inside the event
  // handlers below (to decide a split point or whether Backspace landed at
  // the very start of a row), never rendered, so a ref rather than state.
  const selectionRef = useRef<{ start: number; end: number }[]>([]);

  function commit(nextRows: ChordsLyricsRow[]) {
    const result = fromRows(nextRows);
    onChange(result.lyrics, result.chords);
  }

  /** One frame late: the ref for a row created or shifted by this render's `commit` only exists once React has actually committed it. */
  function focusRow(index: number, cursor: number) {
    requestAnimationFrame(() => {
      const ref = lyricRefs.current[index];
      ref?.focus();
      ref?.setNativeProps({ selection: { start: cursor, end: cursor } });
    });
  }

  function handleLyricChange(index: number, text: string) {
    const next = [...rows];
    next[index] = { ...next[index], lyric: text };
    commit(next);
  }

  function handleChordChange(index: number, text: string) {
    const next = [...rows];
    next[index] = { ...next[index], chords: text };
    commit(next);
  }

  function handleChordBlur(index: number) {
    const sanitized = sanitizeChordsText(rows[index].chords);
    if (sanitized === rows[index].chords) return;
    const next = [...rows];
    next[index] = { ...next[index], chords: sanitized };
    commit(next);
  }

  function handleSelectionChange(
    index: number,
    event: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
  ) {
    selectionRef.current[index] = event.nativeEvent.selection;
  }

  function handleLyricSubmit(index: number) {
    const selection = selectionRef.current[index] ?? {
      start: rows[index].lyric.length,
      end: rows[index].lyric.length,
    };
    commit(splitRowAt(rows, index, selection.start));
    focusRow(index + 1, 0);
  }

  function handleLyricKeyPress(
    index: number,
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) {
    if (event.nativeEvent.key !== "Backspace") return;
    const selection = selectionRef.current[index];
    if (!selection || selection.start !== 0 || selection.end !== 0) return;
    if (index === 0) return;
    const { rows: next, joinPoint } = mergeRowIntoPrevious(rows, index);
    commit(next);
    focusRow(index - 1, joinPoint);
  }

  return (
    <ScrollView
      style={[styles.container, style]}
      keyboardShouldPersistTaps="handled"
    >
      {rows.map((row, index) => (
        <View key={index} style={styles.row}>
          <TextInput
            style={styles.chordInput}
            value={row.chords}
            onChangeText={(text) => handleChordChange(index, text)}
            onBlur={() => handleChordBlur(index)}
            placeholder={index === 0 ? chordsPlaceholder : undefined}
            placeholderTextColor={colors.textTertiary}
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            returnKeyType="next"
          />
          <TextInput
            ref={(instance) => {
              lyricRefs.current[index] = instance;
            }}
            style={styles.lyricInput}
            value={row.lyric}
            onChangeText={(text) => handleLyricChange(index, text)}
            onSelectionChange={(event) => handleSelectionChange(index, event)}
            onSubmitEditing={() => handleLyricSubmit(index)}
            onKeyPress={(event) => handleLyricKeyPress(index, event)}
            submitBehavior="submit"
            placeholder={index === 0 ? lyricsPlaceholder : undefined}
            placeholderTextColor={colors.textTertiary}
          />
        </View>
      ))}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    // Each row pairs one chord line with the lyric line it belongs to,
    // stacked so the chord visibly sits above the words it goes with.
    row: {
      marginBottom: 2,
    },
    chordInput: {
      backgroundColor: colors.chordBackground,
      color: colors.chordText,
      fontFamily: "monospace",
      fontSize: 14,
      lineHeight: 18,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderTopLeftRadius: radii.sm,
      borderTopRightRadius: radii.sm,
    },
    lyricInput: {
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontFamily: "monospace",
      fontSize: 14,
      lineHeight: 18,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderBottomLeftRadius: radii.sm,
      borderBottomRightRadius: radii.sm,
    },
  });
}
