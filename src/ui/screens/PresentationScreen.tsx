import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppSelector } from "@/store/hooks";
import { setlistsSelectors } from "@/store/setlistsSlice";
import { songsSelectors } from "@/store/songsSlice";
import { colors, glow, radii, spacing } from "@/ui/theme";

const AUTO_SCROLL_STEP_PX = 1;
const AUTO_SCROLL_INTERVAL_MS = 50;

export function PresentationScreen() {
  const { setlistId } = useLocalSearchParams<{ setlistId: string }>();
  const router = useRouter();

  const setlist = useAppSelector((state) => setlistsSelectors.selectById(state.setlists, setlistId));
  const allSongs = useAppSelector((state) => state.songs);
  // Ids that no longer resolve (a song deleted elsewhere) are skipped rather
  // than rendered as blanks - same as the Library tree.
  const songs = (setlist?.songs ?? [])
    .map((id) => songsSelectors.selectById(allSongs, id))
    .filter((song): song is NonNullable<typeof song> => song !== undefined);

  const [index, setIndex] = useState(0);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelQuery, setPanelQuery] = useState("");
  const [allCaps, setAllCaps] = useState(false);
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

  if (!setlist || songs.length === 0) {
    return (
      <SafeAreaView style={styles.emptyContainer} edges={["top", "bottom"]}>
        <Text style={styles.emptyText}>This setlist has no songs to present.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.exitLink}>Exit</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const current = songs[Math.min(index, songs.length - 1)];

  const trimmedQuery = panelQuery.trim().toLowerCase();
  const filteredSongs = trimmedQuery ? songs.filter((song) => song.name.toLowerCase().includes(trimmedQuery)) : songs;

  function goNext() {
    setIndex((i) => Math.min(i + 1, songs.length - 1));
  }

  function goPrev() {
    setIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={[styles.rail, isPanelOpen && styles.railOpen]}>
        <Pressable onPress={() => setIsPanelOpen((open) => !open)} style={styles.railButton}>
          <Text style={styles.railGlyph}>{isPanelOpen ? "‹" : "☰"}</Text>
        </Pressable>
        <Pressable onPress={() => setAllCaps((v) => !v)} style={styles.railButton}>
          <Text style={[styles.railText, allCaps && styles.railActive]}>AA</Text>
        </Pressable>
        <Pressable onPress={() => setAutoScroll((v) => !v)} style={styles.railButton}>
          <Text style={[styles.railGlyph, autoScroll && styles.railActive]}>⇩</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.railButton}>
          <Text style={styles.railGlyph}>✕</Text>
        </Pressable>

        {isPanelOpen && (
          <View style={styles.panel}>
            <TextInput
              value={panelQuery}
              onChangeText={setPanelQuery}
              placeholder="Search song..."
              placeholderTextColor={colors.textTertiary}
              style={styles.panelSearch}
            />
            <ScrollView style={styles.panelList}>
              {filteredSongs.length === 0 && <Text style={styles.panelEmpty}>No matching song.</Text>}
              {filteredSongs.map((song) => {
                const songIndex = songs.findIndex((s) => s.id === song.id);
                const isCurrent = songIndex === index;
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
                    <Text numberOfLines={1} style={[styles.panelSongName, isCurrent && styles.panelSongNameCurrent]}>
                      {song.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      <View style={styles.main}>
        <View style={styles.header}>
          <Text numberOfLines={1} style={styles.songTitle}>
            {current.name}
          </Text>
          <Text style={styles.songMeta}>
            {index + 1} / {songs.length}
          </Text>
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
            <Text style={styles.lyricsEmpty}>No lyrics for this song.</Text>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dotsRow}>
            {songs.map((song, i) => {
              const isCurrent = i === index;
              return (
                <Pressable key={song.id} onPress={() => setIndex(i)} style={[styles.dot, isCurrent && styles.dotCurrent]}>
                  <Text style={[styles.dotText, isCurrent && styles.dotTextCurrent]}>{i + 1}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.transportRow}>
            <Pressable onPress={goPrev} disabled={index === 0} style={[styles.transportButton, index === 0 && styles.transportDisabled]}>
              <Text style={styles.transportGlyph}>← Prev</Text>
            </Pressable>
            <Pressable
              onPress={goNext}
              disabled={index === songs.length - 1}
              style={[styles.transportButtonPrimary, index === songs.length - 1 && styles.transportDisabled]}
            >
              <Text style={styles.transportGlyphPrimary}>Next →</Text>
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
  songTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
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
  dotText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  dotTextCurrent: {
    color: colors.accentText,
  },
  transportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  transportButton: {
    flex: 1,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  transportButtonPrimary: {
    flex: 1,
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
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  transportGlyphPrimary: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.accentText,
  },
});
