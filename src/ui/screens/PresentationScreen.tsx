import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "@/i18n";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { persistPresentationAllCaps } from "@/store/persistSettings";
import { setlistsSelectors } from "@/store/setlistsSlice";
import { songsSelectors } from "@/store/songsSlice";
import type { SongManifest } from "@/types/song";
import { colors, glow, radii, spacing } from "@/ui/theme";

const AUTO_SCROLL_STEP_PX = 1;
const AUTO_SCROLL_INTERVAL_MS = 50;

/** Presents every song in a setlist, in order, with quick switching between them. */
export function SetlistPresentationScreen() {
  const { setlistId } = useLocalSearchParams<{ setlistId: string }>();
  const { t } = useTranslation();

  const setlist = useAppSelector((state) => setlistsSelectors.selectById(state.setlists, setlistId));
  const allSongs = useAppSelector((state) => state.songs);
  // Ids that no longer resolve (a song deleted elsewhere) are skipped rather
  // than rendered as blanks - same as the Library tree.
  const songs = (setlist?.songs ?? [])
    .map((id) => songsSelectors.selectById(allSongs, id))
    .filter((song): song is SongManifest => song !== undefined);

  return <PresentationView songs={songs} emptyMessage={t.presentation.empty} />;
}

/** Presents a single song, outside the context of any setlist. */
export function SongPresentationScreen() {
  const { songId } = useLocalSearchParams<{ songId: string }>();
  const { t } = useTranslation();

  const song = useAppSelector((state) => songsSelectors.selectById(state.songs, songId));

  return <PresentationView songs={song ? [song] : []} emptyMessage={t.presentation.emptySong} />;
}

function PresentationView({ songs, emptyMessage }: { songs: SongManifest[]; emptyMessage: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const [index, setIndex] = useState(0);
  const [played, setPlayed] = useState<Set<string>>(new Set());
  // Collapsed by default: the lyrics of the current song should fill the
  // screen when presentation mode starts, not compete with the track list
  // for space. The ☰ button still opens it for quick switching.
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelQuery, setPanelQuery] = useState("");
  // Persisted across sessions - remembered how you last left it, not reset
  // every time you enter presentation mode.
  const allCaps = useAppSelector((state) => state.settings.presentationAllCaps);
  const [autoScroll, setAutoScroll] = useState(false);
  const lyricsScrollRef = useRef<ScrollView>(null);
  const lyricsOffsetRef = useRef(0);

  useEffect(() => {
    lyricsOffsetRef.current = 0;
    lyricsScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [index]);

  useEffect(() => {
    if (!autoScroll) return;
    const interval = setInterval(() => {
      lyricsOffsetRef.current += AUTO_SCROLL_STEP_PX;
      lyricsScrollRef.current?.scrollTo({ y: lyricsOffsetRef.current, animated: false });
    }, AUTO_SCROLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [autoScroll, index]);

  if (songs.length === 0) {
    return (
      <SafeAreaView style={styles.emptyContainer} edges={["top", "bottom"]}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.exitLink}>{t.presentation.exit}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const current = songs[Math.min(index, songs.length - 1)];
  const multipleSongs = songs.length > 1;

  const trimmedQuery = panelQuery.trim().toLowerCase();
  const filteredSongs = trimmedQuery ? songs.filter((song) => song.name.toLowerCase().includes(trimmedQuery)) : songs;

  function goNext() {
    setIndex((i) => Math.min(i + 1, songs.length - 1));
  }

  function goPrev() {
    setIndex((i) => Math.max(i - 1, 0));
  }

  function togglePlayedAndAdvance() {
    setPlayed((prev) => {
      const next = new Set(prev);
      if (next.has(current.id)) next.delete(current.id);
      else next.add(current.id);
      return next;
    });
    if (multipleSongs) goNext();
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={[styles.rail, isPanelOpen && styles.railOpen]}>
        {multipleSongs && (
          <Pressable onPress={() => setIsPanelOpen((open) => !open)} style={styles.railButton}>
            <Text style={styles.railGlyph}>{isPanelOpen ? "‹" : "☰"}</Text>
          </Pressable>
        )}
        <Pressable onPress={() => dispatch(persistPresentationAllCaps(!allCaps))} style={styles.railButton}>
          <Text style={[styles.railText, allCaps && styles.railActive]}>AA</Text>
        </Pressable>
        <Pressable onPress={() => setAutoScroll((v) => !v)} style={styles.railButton}>
          <Text style={[styles.railGlyph, autoScroll && styles.railActive]}>⇩</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.railButton}>
          <Text style={styles.railGlyph}>✕</Text>
        </Pressable>

        {multipleSongs && isPanelOpen && (
          <View style={styles.panel}>
            <TextInput
              value={panelQuery}
              onChangeText={setPanelQuery}
              placeholder={t.presentation.searchPlaceholder}
              placeholderTextColor={colors.textTertiary}
              style={styles.panelSearch}
            />
            <ScrollView style={styles.panelList}>
              {filteredSongs.length === 0 && <Text style={styles.panelEmpty}>{t.presentation.noMatch}</Text>}
              {filteredSongs.map((song) => {
                const songIndex = songs.findIndex((s) => s.id === song.id);
                const isCurrent = songIndex === index;
                const isPlayed = played.has(song.id);
                return (
                  <Pressable
                    key={song.id}
                    onPress={() => {
                      setIndex(songIndex);
                      setPanelQuery("");
                    }}
                    style={[styles.panelRow, isCurrent && styles.panelRowActive]}
                  >
                    <Text style={styles.panelPosition}>{songIndex + 1}</Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.panelSongName,
                        isCurrent ? styles.panelSongNameCurrent : isPlayed && styles.panelSongNamePlayed,
                      ]}
                    >
                      {song.name}
                    </Text>
                    {isPlayed && <Text style={styles.panelCheck}>✓</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      <View style={styles.main}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text numberOfLines={1} style={styles.songTitle}>
              {current.name}
            </Text>
            <Pressable
              onPress={() => router.push({ pathname: "/song/[songId]", params: { songId: current.id } })}
              hitSlop={8}
              style={styles.editButton}
            >
              <Text style={styles.editButtonText}>{t.presentation.edit}</Text>
            </Pressable>
          </View>
          {multipleSongs && (
            <Text style={styles.songMeta}>
              {index + 1} / {songs.length}
            </Text>
          )}
        </View>

        <ScrollView
          ref={lyricsScrollRef}
          onScroll={(event) => {
            lyricsOffsetRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          style={styles.lyricsScroll}
          contentContainerStyle={styles.lyricsContent}
        >
          {current.lyrics ? (
            <Text style={[styles.lyrics, allCaps && styles.lyricsUppercase]}>{current.lyrics}</Text>
          ) : (
            <Text style={styles.lyricsEmpty}>{t.presentation.noLyrics}</Text>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {multipleSongs && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dotsRow}>
              {songs.map((song, i) => {
                const isCurrent = i === index;
                const isPlayed = played.has(song.id);
                return (
                  <Pressable
                    key={song.id}
                    onPress={() => setIndex(i)}
                    style={[styles.dot, isCurrent ? styles.dotCurrent : isPlayed && styles.dotPlayed]}
                  >
                    <Text style={[styles.dotText, isCurrent ? styles.dotTextCurrent : isPlayed && styles.dotTextPlayed]}>
                      {i + 1}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          <View style={styles.transportRow}>
            <Pressable
              onPress={goPrev}
              disabled={!multipleSongs || index === 0}
              style={[styles.transportButton, (!multipleSongs || index === 0) && styles.transportDisabled]}
            >
              <Text style={styles.transportGlyph}>←</Text>
            </Pressable>
            <Pressable
              onPress={togglePlayedAndAdvance}
              style={[styles.transportButton, played.has(current.id) && styles.transportButtonPlayed]}
            >
              <Text style={[styles.transportGlyph, played.has(current.id) && styles.transportGlyphPlayed]}>✓</Text>
            </Pressable>
            <Pressable
              onPress={goNext}
              disabled={!multipleSongs || index === songs.length - 1}
              style={[styles.transportButtonPrimary, (!multipleSongs || index === songs.length - 1) && styles.transportDisabled]}
            >
              <Text style={styles.transportGlyphPrimary}>→</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  exitLink: {
    color: colors.accent,
    fontSize: 14,
  },
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.background,
  },
  rail: {
    width: 48,
    flexShrink: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.borderLight,
  },
  railOpen: {
    width: 220,
  },
  railButton: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  railGlyph: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  railText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  railActive: {
    color: colors.accent,
  },
  panel: {
    flex: 1,
    padding: spacing.sm,
  },
  panelSearch: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  panelList: {
    flex: 1,
  },
  panelEmpty: {
    color: colors.textTertiary,
    fontSize: 12,
    paddingVertical: spacing.sm,
  },
  panelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  panelRowActive: {
    backgroundColor: "rgba(251,191,36,0.1)",
  },
  panelPosition: {
    width: 18,
    color: colors.textTertiary,
    fontSize: 12,
  },
  panelSongName: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
  },
  panelSongNameCurrent: {
    color: colors.accent,
  },
  panelSongNamePlayed: {
    color: colors.success,
  },
  panelCheck: {
    color: colors.success,
    fontSize: 12,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  songTitle: {
    flex: 1,
    minWidth: 0,
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
  },
  editButton: {
    flexShrink: 0,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  editButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  songMeta: {
    marginTop: spacing.xs,
    color: colors.textTertiary,
    fontSize: 14,
    fontWeight: "600",
  },
  lyricsScroll: {
    flex: 1,
  },
  lyricsContent: {
    padding: spacing.lg,
  },
  lyrics: {
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 28,
    fontFamily: "monospace",
  },
  lyricsUppercase: {
    textTransform: "uppercase",
  },
  lyricsEmpty: {
    color: colors.textTertiary,
    fontSize: 14,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  dotsRow: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  dotCurrent: {
    backgroundColor: colors.accent,
    ...glow(colors.accent, 6),
  },
  dotPlayed: {
    backgroundColor: "rgba(52,211,153,0.18)",
  },
  dotText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  dotTextCurrent: {
    color: colors.accentText,
  },
  dotTextPlayed: {
    color: colors.success,
  },
  transportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  transportButton: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  transportButtonPlayed: {
    borderColor: "rgba(52,211,153,0.4)",
    backgroundColor: "rgba(52,211,153,0.1)",
  },
  transportButtonPrimary: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  transportDisabled: {
    opacity: 0.3,
  },
  transportGlyph: {
    fontSize: 18,
    color: colors.textPrimary,
  },
  transportGlyphPlayed: {
    color: colors.success,
  },
  transportGlyphPrimary: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.accentText,
  },
});
