import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "@/i18n";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateSong } from "@/store/persistSongs";
import { songsSelectors } from "@/store/songsSlice";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/TextField";
import { colors, spacing } from "@/ui/theme";

export function SongDetailScreen() {
  const { songId } = useLocalSearchParams<{ songId: string }>();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const song = useAppSelector((state) => songsSelectors.selectById(state.songs, songId));

  const [name, setName] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [saved, setSaved] = useState(false);

  // Adjusted during render rather than in an effect: resets the draft when
  // the song first becomes available (hydration can land after this screen
  // mounts) or when navigating to a different one, without clobbering an
  // in-progress edit on an unrelated store update.
  const [syncedSongId, setSyncedSongId] = useState<string | undefined>(undefined);
  if (song && song.id !== syncedSongId) {
    setSyncedSongId(song.id);
    setName(song.name);
    setLyrics(song.lyrics ?? "");
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
    dispatch(updateSong(song.id, { name: name.trim(), lyrics: lyrics.trim() || null }));
    setSaved(true);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.back}>{t.common.back}</Text>
          </Pressable>

          <View style={styles.section}>
            <TextField label={t.song.nameLabel} value={name} onChangeText={setName} />
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
              onPress={() => router.push({ pathname: "/song/[songId]/present", params: { songId: song.id } })}
            >
              {t.setlist.present}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
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
});
