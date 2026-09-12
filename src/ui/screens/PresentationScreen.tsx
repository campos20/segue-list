import { useTranslation } from "@/i18n";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  persistPresentationAllCaps,
  persistPresentationFontSize,
} from "@/store/persistSettings";
import { setlistsSelectors } from "@/store/setlistsSlice";
import { songsSelectors } from "@/store/songsSlice";
import type { SongManifest } from "@/types/song";
import { DEFAULT_DURATION_SECONDS } from "@/ui/duration";
import { parseLyricsColors } from "@/ui/lyricsColor";
import {
  glow,
  radii,
  spacing,
  useThemeColors,
  type ThemeColors,
} from "@/ui/theme";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const AUTO_SCROLL_INTERVAL_MS = 50;

const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 48;
const FONT_SIZE_STEP = 2;
/** Keeps line spacing proportional to size, matching the default 18/28 ratio. */
const LYRICS_LINE_HEIGHT_RATIO = 28 / 18;

/** Presents every song in a setlist, in order, with quick switching between them. */
export function SetlistPresentationScreen() {
  // songId is optional - set when a specific song within the setlist was
  // tapped, so presentation opens on that song instead of always the first.
  const { setlistId, songId } = useLocalSearchParams<{
    setlistId: string;
    songId?: string;
  }>();
  const { t } = useTranslation();

  const setlist = useAppSelector((state) =>
    setlistsSelectors.selectById(state.setlists, setlistId),
  );
  const allSongs = useAppSelector((state) => state.songs);
  // Ids that no longer resolve (a song deleted elsewhere) are skipped rather
  // than rendered as blanks - same as the Library tree.
  const songs = (setlist?.songs ?? [])
    .map((id) => songsSelectors.selectById(allSongs, id))
    .filter((song): song is SongManifest => song !== undefined);

  return (
    <PresentationView
      songs={songs}
      emptyMessage={t.presentation.empty}
      initialSongId={songId}
    />
  );
}

/** Presents a single song, outside the context of any setlist. */
export function SongPresentationScreen() {
  const { songId } = useLocalSearchParams<{ songId: string }>();
  const { t } = useTranslation();

  const song = useAppSelector((state) =>
    songsSelectors.selectById(state.songs, songId),
  );

  return (
    <PresentationView
      songs={song ? [song] : []}
      emptyMessage={t.presentation.emptySong}
    />
  );
}

function PresentationView({
  songs,
  emptyMessage,
  initialSongId,
}: {
  songs: SongManifest[];
  emptyMessage: string;
  initialSongId?: string;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // The floating song-switcher panel is absolutely positioned, so it doesn't
  // inherit the outer SafeAreaView's padding the way normal-flow content
  // does - RN positions an absolute child from its parent's border box, not
  // its padding box. Its own top/bottom offsets need the insets added
  // explicitly or the ✕ button ends up under a notch/punch-hole camera.
  const insets = useSafeAreaInsets();

  // The screen must never lock mid-song - there's no "wake it back up and
  // find your place" during a live show. `suppressDeactivateWarnings`
  // swallows a harmless race on web, where deactivating on unmount can
  // fire before the wake lock finishes activating if the screen is exited
  // right after being entered.
  useKeepAwake(undefined, { suppressDeactivateWarnings: true });

  const [index, setIndex] = useState(0);
  // LibraryGate hydrates songs/setlists asynchronously after this screen can
  // already be mounted (a cold start restoring this route, or a deep link) -
  // see LibraryGate.tsx. `songs` can therefore still be empty on the first
  // render even when `initialSongId` is set, so the jump-to-song can't be a
  // one-time useState initializer: it has to keep retrying at render time
  // until `songs` actually contains it, then latch so it never fights
  // manual next/prev navigation afterward.
  const [appliedInitialSongId, setAppliedInitialSongId] = useState<
    string | undefined
  >(undefined);
  if (initialSongId && initialSongId !== appliedInitialSongId) {
    const targetIndex = songs.findIndex((song) => song.id === initialSongId);
    if (targetIndex !== -1) {
      setAppliedInitialSongId(initialSongId);
      setIndex(targetIndex);
    }
  }
  const [played, setPlayed] = useState<Set<string>>(new Set());
  // Collapsed by default: the lyrics of the current song should fill the
  // screen when presentation mode starts. The floating ☰ button opens an
  // overlay (song switcher + controls) on top of the lyrics rather than
  // reserving permanent width for it.
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelQuery, setPanelQuery] = useState("");
  // Persisted across sessions - remembered how you last left it, not reset
  // every time you enter presentation mode.
  const allCaps = useAppSelector((state) => state.settings.presentationAllCaps);
  const fontSize = useAppSelector(
    (state) => state.settings.presentationFontSize,
  );
  const lyricsScrollRef = useRef<ScrollView>(null);
  const lyricsOffsetRef = useRef(0);
  // Measured live off the ScrollView itself (onLayout / onContentSizeChange)
  // rather than derived from the song, since the same lyrics render at a
  // different pixel height depending on font size and all-caps.
  const lyricsViewportHeightRef = useRef(0);
  const lyricsContentHeightRef = useRef(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  // Adjusted during render (same pattern as `syncedSongId` elsewhere) rather
  // than in an effect, so switching songs stops auto-scroll without an extra
  // render - see AGENTS.md.
  const [autoScrollSyncedIndex, setAutoScrollSyncedIndex] = useState<
    number | null
  >(null);
  if (autoScrollSyncedIndex !== index) {
    setAutoScrollSyncedIndex(index);
    if (isAutoScrolling) setIsAutoScrolling(false);
  }

  // `current` is needed by the auto-scroll effect below, so it's computed
  // here rather than after the empty-songs early return further down. It can
  // be undefined for a single render when `songs` is empty - every use below
  // is optional-chained or guarded by that same early return.
  const current = songs[Math.min(index, songs.length - 1)];

  useEffect(() => {
    lyricsOffsetRef.current = 0;
    lyricsScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [index]);

  useEffect(() => {
    if (!isAutoScrolling) return;
    // A song with no duration entered still auto-scrolls, paced by
    // DEFAULT_DURATION_SECONDS - see canAutoScroll below, which only checks
    // for lyrics now, not for an explicit duration.
    const durationSeconds =
      current?.durationSeconds && current.durationSeconds > 0
        ? current.durationSeconds
        : DEFAULT_DURATION_SECONDS;

    // Re-measured every tick, not once when the interval is set up: the
    // height refs can still be 0 at the instant Play is pressed (layout
    // hasn't reported yet), and font size / all-caps can change the content
    // height while already scrolling (via the still-open panel). Recomputing
    // keeps the rate honest to "cover the current distance in the song's
    // duration" instead of freezing a stale distance from effect-start.
    const interval = setInterval(() => {
      const totalDistance = Math.max(
        0,
        lyricsContentHeightRef.current - lyricsViewportHeightRef.current,
      );
      if (totalDistance <= 0) return;

      const pxPerMs = totalDistance / (durationSeconds * 1000);
      const next = Math.min(
        lyricsOffsetRef.current + pxPerMs * AUTO_SCROLL_INTERVAL_MS,
        totalDistance,
      );
      lyricsOffsetRef.current = next;
      lyricsScrollRef.current?.scrollTo({ y: next, animated: false });
      if (next >= totalDistance) setIsAutoScrolling(false);
    }, AUTO_SCROLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAutoScrolling, index, current?.durationSeconds]);

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

  const multipleSongs = songs.length > 1;

  const trimmedQuery = panelQuery.trim().toLowerCase();
  const filteredSongs = trimmedQuery
    ? songs.filter((song) => song.name.toLowerCase().includes(trimmedQuery))
    : songs;
  // Computed once per render rather than with a `findIndex` inside the list
  // below, which would re-scan `songs` for every row (O(n²) for the panel).
  const songIndexById = new Map(songs.map((song, i) => [song.id, i]));

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

  // Every song can auto-scroll, timed or not - an untimed one just uses
  // DEFAULT_DURATION_SECONDS (see the effect above). Only missing lyrics
  // (nothing to scroll through) disables it.
  const canAutoScroll = Boolean(current.lyrics);

  function toggleAutoScroll() {
    setIsAutoScrolling((playing) => !playing);
  }

  function stopAutoScroll() {
    setIsAutoScrolling(false);
    lyricsOffsetRef.current = 0;
    lyricsScrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.main}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Pressable
              onPress={() => setIsPanelOpen((open) => !open)}
              style={styles.headerHamburgerButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t.presentation.menuToggleLabel(isPanelOpen)}
              accessibilityState={{ expanded: isPanelOpen }}
            >
              <Text style={styles.railGlyph}>{isPanelOpen ? "‹" : "☰"}</Text>
            </Pressable>
            <Text numberOfLines={1} style={styles.songTitle}>
              {current.name}
            </Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/song/[songId]",
                  params: { songId: current.id },
                })
              }
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
          onLayout={(event) => {
            lyricsViewportHeightRef.current = event.nativeEvent.layout.height;
          }}
          onContentSizeChange={(_width, height) => {
            lyricsContentHeightRef.current = height;
          }}
          scrollEventThrottle={16}
          style={styles.lyricsScroll}
          contentContainerStyle={styles.lyricsContent}
        >
          {current.lyrics ? (
            <Text
              style={[
                styles.lyrics,
                allCaps && styles.lyricsUppercase,
                {
                  fontSize,
                  lineHeight: Math.round(fontSize * LYRICS_LINE_HEIGHT_RATIO),
                },
              ]}
            >
              {parseLyricsColors(current.lyrics).map((segment, index) =>
                segment.span ? (
                  <Text
                    key={index}
                    style={{
                      ...(segment.span.background && {
                        backgroundColor: `#${segment.span.background}`,
                      }),
                      ...(segment.span.color && {
                        color: `#${segment.span.color}`,
                      }),
                    }}
                  >
                    {segment.text}
                  </Text>
                ) : (
                  segment.text
                ),
              )}
            </Text>
          ) : (
            <Text style={styles.lyricsEmpty}>{t.presentation.noLyrics}</Text>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.transportRow}>
            <View style={styles.navControlGroup}>
              <Pressable
                onPress={goPrev}
                disabled={!multipleSongs || index === 0}
                style={[
                  styles.transportButton,
                  (!multipleSongs || index === 0) && styles.transportDisabled,
                ]}
              >
                <Text style={styles.transportGlyph}>←</Text>
              </Pressable>
              <Pressable
                onPress={togglePlayedAndAdvance}
                style={[
                  styles.transportButton,
                  played.has(current.id) && styles.transportButtonPlayed,
                ]}
              >
                <Text
                  style={[
                    styles.transportGlyph,
                    played.has(current.id) && styles.transportGlyphPlayed,
                  ]}
                >
                  ✓
                </Text>
              </Pressable>
              <Pressable
                onPress={goNext}
                disabled={!multipleSongs || index === songs.length - 1}
                style={[
                  styles.transportButtonPrimary,
                  (!multipleSongs || index === songs.length - 1) &&
                    styles.transportDisabled,
                ]}
              >
                <Text style={styles.transportGlyphPrimary}>→</Text>
              </Pressable>
            </View>
            <View style={styles.scrollControlGroup}>
              <Pressable
                onPress={stopAutoScroll}
                disabled={!canAutoScroll}
                accessibilityRole="button"
                accessibilityLabel={t.presentation.scrollStopLabel}
                accessibilityHint={
                  canAutoScroll ? undefined : t.presentation.noLyricsHint
                }
                style={[
                  styles.transportButton,
                  !canAutoScroll && styles.transportDisabled,
                ]}
              >
                <Text style={styles.transportGlyph}>⏹</Text>
              </Pressable>
              <Pressable
                onPress={toggleAutoScroll}
                disabled={!canAutoScroll}
                accessibilityRole="button"
                accessibilityLabel={t.presentation.scrollPlayLabel(
                  isAutoScrolling,
                )}
                accessibilityHint={
                  canAutoScroll ? undefined : t.presentation.noLyricsHint
                }
                style={[
                  styles.transportButton,
                  isAutoScrolling && styles.transportButtonPlayed,
                  !canAutoScroll && styles.transportDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.transportGlyph,
                    isAutoScrolling && styles.transportGlyphPlayed,
                  ]}
                >
                  {isAutoScrolling ? "⏸" : "▶"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      {isPanelOpen && (
        <Pressable
          style={styles.backdrop}
          onPress={() => setIsPanelOpen(false)}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}

      {isPanelOpen && (
        <View
          style={[
            styles.panel,
            {
              top: spacing.sm + insets.top,
              bottom: spacing.lg + insets.bottom,
            },
          ]}
        >
          <View style={styles.panelControlsRow}>
            <Pressable
              onPress={() => dispatch(persistPresentationAllCaps(!allCaps))}
              style={styles.railButton}
            >
              <Text style={[styles.railText, allCaps && styles.railActive]}>
                AA
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                dispatch(
                  persistPresentationFontSize(
                    Math.min(fontSize + FONT_SIZE_STEP, MAX_FONT_SIZE),
                  ),
                )
              }
              disabled={fontSize >= MAX_FONT_SIZE}
              style={styles.railButton}
            >
              <Text
                style={[
                  styles.railText,
                  fontSize >= MAX_FONT_SIZE && styles.railDisabled,
                ]}
              >
                A+
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                dispatch(
                  persistPresentationFontSize(
                    Math.max(fontSize - FONT_SIZE_STEP, MIN_FONT_SIZE),
                  ),
                )
              }
              disabled={fontSize <= MIN_FONT_SIZE}
              style={styles.railButton}
            >
              <Text
                style={[
                  styles.railText,
                  fontSize <= MIN_FONT_SIZE && styles.railDisabled,
                ]}
              >
                A−
              </Text>
            </Pressable>
            <Pressable onPress={() => router.back()} style={styles.railButton}>
              <Text style={styles.railGlyph}>✕</Text>
            </Pressable>
          </View>

          {multipleSongs && (
            <>
              <TextInput
                value={panelQuery}
                onChangeText={setPanelQuery}
                placeholder={t.presentation.searchPlaceholder}
                placeholderTextColor={colors.textTertiary}
                style={styles.panelSearch}
              />
              <ScrollView style={styles.panelList}>
                {filteredSongs.length === 0 && (
                  <Text style={styles.panelEmpty}>
                    {t.presentation.noMatch}
                  </Text>
                )}
                {filteredSongs.map((song) => {
                  const songIndex = songIndexById.get(song.id)!;
                  const isCurrent = songIndex === index;
                  const isPlayed = played.has(song.id);
                  return (
                    <Pressable
                      key={song.id}
                      onPress={() => {
                        setIndex(songIndex);
                        setPanelQuery("");
                        setIsPanelOpen(false);
                      }}
                      style={[
                        styles.panelRow,
                        isCurrent && styles.panelRowActive,
                      ]}
                    >
                      <Text style={styles.panelPosition}>{songIndex + 1}</Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.panelSongName,
                          isCurrent
                            ? styles.panelSongNameCurrent
                            : isPlayed && styles.panelSongNamePlayed,
                        ]}
                      >
                        {song.name}
                      </Text>
                      {isPlayed && <Text style={styles.panelCheck}>✓</Text>}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
      backgroundColor: colors.background,
    },
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.35)",
      zIndex: 10,
    },
    headerHamburgerButton: {
      flexShrink: 0,
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    railButton: {
      height: 48,
      alignItems: "center",
      justifyContent: "center",
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
    railDisabled: {
      opacity: 0.3,
    },
    panel: {
      position: "absolute",
      // top/bottom are set inline per-render with the safe-area insets
      // added in - see the panel's JSX.
      left: spacing.sm,
      width: 240,
      maxWidth: "80%",
      padding: spacing.sm,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      zIndex: 15,
      elevation: 6,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    panelControlsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
      marginBottom: spacing.sm,
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
      backgroundColor: colors.borderLight,
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
    scrollControlGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    navControlGroup: {
      flexDirection: "row",
      alignItems: "center",
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
}
