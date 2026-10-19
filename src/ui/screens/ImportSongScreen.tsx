import { useTranslation } from "@/i18n";
import { isNewerThan } from "@/storage/bundle";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { saveSharedSong } from "@/store/persistSongs";
import { songsSelectors } from "@/store/songsSlice";
import { Button } from "@/ui/components/Button";
import { OpenInAppLink } from "@/ui/components/OpenInAppLink";
import { formatDurationDigits, digitsFromDuration } from "@/ui/duration";
import { useImportPayload } from "@/ui/importPayload";
import { plainTextFromLyrics } from "@/ui/lyricsColor";
import { decodeSongLink, SongLinkError } from "@/ui/songLink";
import { radii, spacing, useThemeColors, type ThemeColors } from "@/ui/theme";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PREVIEW_LINES = 12;

/**
 * Where a song shared by QR code lands (see ui/songLink.ts) - on the phone
 * through `seguelist://import?d=...`, on the web through
 * `<site>/import#...`.
 *
 * Nothing is saved on arrival: anyone can make a link, so the song is shown
 * first and only saved when the user taps. Whether that's "Save" or
 * "Update" (or nothing to do) follows the same rule as importing a backup -
 * an existing song is only replaced by a strictly newer copy, so scanning
 * an old code can't roll back an edit made here since.
 */
export function ImportSongScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const payload = useImportPayload();
  const [saveFailed, setSaveFailed] = useState(false);

  const decoded = useMemo(() => {
    if (!payload) return { error: "invalid" as const };
    try {
      return { song: decodeSongLink(payload) };
    } catch (error) {
      return {
        error:
          error instanceof SongLinkError ? error.reason : ("invalid" as const),
      };
    }
  }, [payload]);

  const hydrated = useAppSelector((state) => state.songs.hydrated);
  const local = useAppSelector((state) =>
    decoded.song
      ? songsSelectors.selectById(state.songs, decoded.song.id)
      : undefined,
  );

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  function openSong(songId: string) {
    router.replace({ pathname: "/song/[songId]", params: { songId } });
  }

  function handleSave() {
    if (!decoded.song) return;
    const outcome = dispatch(saveSharedSong(decoded.song));
    if (outcome === "failed") {
      setSaveFailed(true);
      return;
    }
    openSong(decoded.song.id);
  }

  const song = decoded.song;
  const lyricsLines = song?.lyrics
    ? plainTextFromLyrics(song.lyrics).split("\n")
    : [];
  const status = !song
    ? null
    : !local
      ? "new"
      : isNewerThan(song, local)
        ? "newer"
        : "upToDate";

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={leave}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.back}>{t.common.back}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>{t.importLink.title}</Text>

        {!song ? (
          <>
            <Text style={styles.error}>
              {decoded.error === "newerVersion"
                ? t.importLink.newerVersion
                : t.importLink.invalid}
            </Text>
            <Button variant="secondary" onPress={() => router.replace("/")}>
              {t.importLink.goToLibrary}
            </Button>
          </>
        ) : (
          <>
            <Text style={styles.title}>{song.name}</Text>
            <Text style={styles.meta}>
              {[
                song.chords ? t.importLink.withChords : null,
                song.durationSeconds
                  ? formatDurationDigits(
                      digitsFromDuration(song.durationSeconds),
                    )
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>

            {lyricsLines.length > 0 && (
              <View style={styles.preview}>
                <Text style={styles.previewText}>
                  {lyricsLines.slice(0, PREVIEW_LINES).join("\n")}
                  {lyricsLines.length > PREVIEW_LINES ? "\n…" : ""}
                </Text>
              </View>
            )}

            {/* Web only (renders nothing on a phone): a phone camera opens
                the QR link in the browser, where handing it to the app is
                what the user almost always wants - so it comes first. */}
            {payload && <OpenInAppLink payload={payload} />}

            {!hydrated ? (
              <View style={styles.row}>
                <ActivityIndicator color={colors.textSecondary} />
                <Text style={styles.meta}>{t.importLink.loading}</Text>
              </View>
            ) : status === "upToDate" ? (
              <>
                <Text style={styles.meta}>{t.importLink.upToDate}</Text>
                <Button onPress={() => openSong(song.id)}>
                  {t.importLink.openSong}
                </Button>
              </>
            ) : (
              <>
                {status === "newer" && (
                  <Text style={styles.meta}>{t.importLink.updateHint}</Text>
                )}
                <Button onPress={handleSave}>
                  {status === "newer" ? t.importLink.update : t.importLink.save}
                </Button>
                {saveFailed && (
                  <Text style={styles.error}>{t.importLink.saveFailed}</Text>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    back: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    pressed: {
      opacity: 0.7,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: 80,
      gap: spacing.md,
      maxWidth: 640,
      width: "100%",
      alignSelf: "center",
    },
    eyebrow: {
      color: colors.textTertiary,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
    title: {
      color: colors.textPrimary,
      fontSize: 26,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    meta: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    error: {
      color: colors.danger,
      fontSize: 15,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    preview: {
      padding: spacing.md,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.panel,
    },
    previewText: {
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 22,
    },
  });
}
