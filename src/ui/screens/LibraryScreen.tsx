import { useTranslation } from "@/i18n";
import {
  shareBundle,
  shareDocx,
  writeBundleToCache,
  writeSongsAsDocxToCache,
} from "@/storage";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { importBundleIntoLibrary } from "@/store/persistBundle";
import { persistLibraryOrder } from "@/store/persistLibrary";
import {
  addSongToSetlist,
  createSetlist,
  deleteSetlist,
  duplicateSetlist,
  moveSongInSetlist,
  removeSongFromSetlist,
  renameSetlist,
} from "@/store/persistSetlists";
import {
  createSong,
  deleteSong,
  importSongsFromLyricsFiles,
} from "@/store/persistSongs";
import { setlistsSelectors } from "@/store/setlistsSlice";
import { songsSelectors } from "@/store/songsSlice";
import type { SongManifest } from "@/types/song";
import {
  KebabIcon,
  OverflowMenu,
  type OverflowMenuItem,
} from "@/ui/components/OverflowMenu";
import { SetlistRow } from "@/ui/components/SetlistRow";
import { SongRow } from "@/ui/components/SongRow";
import { TextField } from "@/ui/components/TextField";
import { buildLibraryTree, type LibraryItem } from "@/ui/libraryTree";
import { moveItem } from "@/ui/reorder";
import { colors, radii, spacing } from "@/ui/theme";
import Constants from "expo-constants";
import { getDocumentAsync } from "expo-document-picker";
import { File } from "expo-file-system";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function LibraryScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { t } = useTranslation();

  const songs = useAppSelector((state) =>
    songsSelectors.selectAll(state.songs),
  );
  const setlists = useAppSelector((state) =>
    setlistsSelectors.selectAll(state.setlists),
  );
  const libraryOrder = useAppSelector((state) => state.settings.libraryOrder);
  const hydrated = useAppSelector(
    (state) => state.songs.hydrated && state.setlists.hydrated,
  );

  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [renamingSetlistId, setRenamingSetlistId] = useState<string | null>(
    null,
  );
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const items = useMemo(
    () => buildLibraryTree(songs, setlists, libraryOrder),
    [songs, setlists, libraryOrder],
  );

  const trimmedSearch = search.trim().toLowerCase();

  /**
   * While searching, a setlist stays visible if its own name matches (showing
   * every song in it, same as browsing normally) or if any song inside it
   * matches (showing just those). A song not in any matching setlist stays
   * visible on its own name. Reordering during a search would be ambiguous
   * about what "up"/"down" even means, so moves below always look the real
   * position up in `items` rather than trusting the filtered list's index.
   */
  const displayedItems = useMemo((): LibraryItem[] => {
    if (!trimmedSearch) return items;
    return items.flatMap((item): LibraryItem[] => {
      if (item.kind === "song") {
        return item.song.name.toLowerCase().includes(trimmedSearch)
          ? [item]
          : [];
      }
      const nameMatches = item.setlist.name
        .toLowerCase()
        .includes(trimmedSearch);
      if (nameMatches) return [item];
      const matchingSongs = item.songs.filter((song) =>
        song.name.toLowerCase().includes(trimmedSearch),
      );
      return matchingSongs.length > 0
        ? [{ ...item, songs: matchingSongs }]
        : [];
    });
  }, [items, trimmedSearch]);

  function handleMove(item: LibraryItem, direction: "up" | "down") {
    const keys = items.map((candidate) => candidate.key);
    const realIndex = items.findIndex(
      (candidate) => candidate.key === item.key,
    );
    const reordered = moveItem(keys, realIndex, direction);
    if (reordered !== keys) dispatch(persistLibraryOrder(reordered));
  }

  function handleNewSetlist() {
    const setlist = dispatch(createSetlist());
    if (!setlist) {
      setError(t.library.couldNotCreateSetlist);
      return;
    }
    // Straight into rename: a setlist called "New setlist" is never what the
    // user meant, and this saves them hunting for the menu to fix it.
    setRenamingSetlistId(setlist.id);
  }

  function handleRenameSubmit(setlistId: string, name: string) {
    setRenamingSetlistId(null);
    const trimmed = name.trim();
    if (trimmed) dispatch(renameSetlist(setlistId, trimmed));
  }

  function handleDuplicateSetlist(id: string) {
    const source = setlists.find((candidate) => candidate.id === id);
    if (!source) return;
    const copy = dispatch(
      duplicateSetlist(id, t.setlist.duplicateName(source.name)),
    );
    if (!copy) setError(t.library.couldNotDuplicateSetlist);
  }

  function handleDeleteSetlist(id: string, name: string, songCount: number) {
    Alert.alert(
      t.library.deleteSetlistTitle,
      t.library.deleteSetlistBody(name, songCount),
      [
        { text: t.common.cancel, style: "cancel" },
        {
          text: t.setlist.delete,
          style: "destructive",
          onPress: () => dispatch(deleteSetlist(id)),
        },
      ],
    );
  }

  function handleNewSong() {
    const song = dispatch(createSong());
    if (!song) {
      setError(t.library.couldNotCreateSong);
      return;
    }
    router.push({ pathname: "/song/[songId]", params: { songId: song.id } });
  }

  function handleDeleteSong(id: string, name: string) {
    Alert.alert(t.library.deleteSongTitle, t.library.deleteSongBody(name), [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.setlist.delete,
        style: "destructive",
        onPress: () => dispatch(deleteSong(id)),
      },
    ]);
  }

  async function handleExportSetlist(
    setlistId: string,
    name: string,
    setlistSongs: SongManifest[],
  ) {
    setError(null);
    try {
      const setlist = setlists.find((candidate) => candidate.id === setlistId);
      const bundle = writeBundleToCache(
        { songs: setlistSongs, setlists: setlist ? [setlist] : [] },
        name,
        Constants.expoConfig?.version,
      );
      await shareBundle(bundle, t.library.exportSetlist);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleExportAll() {
    setError(null);
    try {
      const bundle = writeBundleToCache(
        { songs, setlists },
        "segue-list-backup",
        Constants.expoConfig?.version,
      );
      await shareBundle(bundle, t.library.exportBackup);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleExportSetlistDocx(
    name: string,
    setlistSongs: SongManifest[],
  ) {
    setError(null);
    try {
      const doc = writeSongsAsDocxToCache(
        setlistSongs,
        name,
        t.song.noLyricsYet,
      );
      await shareDocx(doc, t.library.exportSetlist);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleExportAllDocx() {
    setError(null);
    try {
      const doc = writeSongsAsDocxToCache(
        songs,
        t.library.title,
        t.song.noLyricsYet,
      );
      await shareDocx(doc, t.library.exportFullLibraryDocx);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleImport() {
    setError(null);
    try {
      const picked = await getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets[0]) return;

      setStatus(t.library.importing);
      const result = await dispatch(
        importBundleIntoLibrary(new File(picked.assets[0].uri)),
      );
      setStatus(null);

      const imported = result.songs.length + result.setlists.length;
      const skipped =
        result.skippedSongIds.length + result.skippedSetlistIds.length;
      if (imported === 0 && skipped > 0) {
        setError(t.library.importAlreadyHere);
      }
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleImportLyricsFiles() {
    setError(null);
    try {
      const picked = await getDocumentAsync({
        type: [
          "text/plain",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.oasis.opendocument.text",
        ],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (picked.canceled || picked.assets.length === 0) return;

      setStatus(t.library.importingLyricsFiles);
      const result = await dispatch(
        importSongsFromLyricsFiles(
          picked.assets.map((asset) => ({
            uri: asset.uri,
            fileName: asset.name,
          })),
        ),
      );
      setStatus(null);

      if (result.failed.length > 0) {
        setError(
          t.library.importLyricsFilesFailed(
            result.failed.map((failure) => failure.fileName),
          ),
        );
      }
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  /** A song's menu: which setlists it can be added to, and - when it's shown inside one - a way back out. */
  function songMenuItems(
    song: SongManifest,
    containingSetlistId?: string,
  ): OverflowMenuItem[] {
    const additions: OverflowMenuItem[] = setlists
      .filter((setlist) => !setlist.songs.includes(song.id))
      .map((setlist) => ({
        key: `add-${setlist.id}`,
        label: t.setlist.addTo(setlist.name),
        onPress: () => dispatch(addSongToSetlist(setlist.id, song.id)),
      }));

    const removal: OverflowMenuItem[] = containingSetlistId
      ? [
          {
            key: "remove",
            label: t.setlist.removeFrom,
            onPress: () =>
              dispatch(removeSongFromSetlist(containingSetlistId, song.id)),
          },
        ]
      : [];

    return [
      {
        key: "present",
        label: t.setlist.present,
        onPress: () =>
          router.push({
            pathname: "/song/[songId]/present",
            params: { songId: song.id },
          }),
      },
      ...additions,
      ...removal,
      {
        key: "delete",
        label: t.setlist.deleteSong,
        destructive: true,
        onPress: () => handleDeleteSong(song.id, song.name),
      },
    ];
  }

  const libraryMenuItems: OverflowMenuItem[] = [
    { key: "import", label: t.library.importBackup, onPress: handleImport },
    {
      key: "import-lyrics",
      label: t.library.importLyricsFiles,
      onPress: handleImportLyricsFiles,
    },
    {
      key: "export",
      label: t.library.exportFullLibrary,
      onPress: handleExportAll,
    },
    {
      key: "export-docx",
      label: t.library.exportFullLibraryDocx,
      onPress: handleExportAllDocx,
    },
    { key: "about", label: t.menu.about, onPress: () => router.push("/about") },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>{t.library.eyebrow}</Text>
          <Text style={styles.header}>{t.library.title}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={handleNewSetlist}
            hitSlop={8}
            style={({ pressed }) => [
              styles.newSetlistButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.newSetlistText}>{t.library.newSetlist}</Text>
          </Pressable>
          <Pressable
            onPress={handleNewSong}
            hitSlop={8}
            style={({ pressed }) => [
              styles.newSongButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.newSongText}>{t.library.newSong}</Text>
          </Pressable>
          <OverflowMenu
            items={libraryMenuItems}
            accessibilityLabel={t.library.moreOptions}
          >
            <KebabIcon />
          </OverflowMenu>
        </View>
      </View>

      <View style={styles.searchRow}>
        <TextField
          value={search}
          onChangeText={setSearch}
          placeholder={t.library.searchPlaceholder}
        />
      </View>

      {status && <Text style={styles.status}>{status}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      <ScrollView contentContainerStyle={styles.list}>
        {!hydrated ? (
          <ActivityIndicator color={colors.accent} style={styles.loading} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t.library.emptyTitle}</Text>
            <Text style={styles.emptyMeta}>{t.library.emptyMeta}</Text>
          </View>
        ) : displayedItems.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t.library.noResultsTitle}</Text>
            <Text style={styles.emptyMeta}>{t.library.noResultsMeta}</Text>
          </View>
        ) : (
          displayedItems.map((item) => {
            const realIndex = items.findIndex(
              (candidate) => candidate.key === item.key,
            );
            const canMoveUp = realIndex > 0;
            const canMoveDown = realIndex < items.length - 1;

            if (item.kind === "setlist") {
              const { setlist, songs: setlistSongs } = item;
              // Forced open while searching, so a match inside a setlist you'd
              // otherwise had collapsed isn't hidden from the results.
              const expanded =
                trimmedSearch.length > 0 || !collapsed.includes(setlist.id);
              return (
                <View key={item.key} style={styles.setlistGroup}>
                  <SetlistRow
                    testID={`setlist-row-${setlist.id}`}
                    name={setlist.name}
                    songsLabel={t.setlist.songsCount(setlistSongs.length)}
                    expanded={expanded}
                    onToggle={() =>
                      setCollapsed((current) =>
                        current.includes(setlist.id)
                          ? current.filter((id) => id !== setlist.id)
                          : [...current, setlist.id],
                      )
                    }
                    expandAccessibilityLabel={
                      expanded ? t.setlist.collapse : t.setlist.expand
                    }
                    menuAccessibilityLabel={t.setlist.setlistOptions}
                    menuItems={[
                      {
                        key: "rename",
                        label: t.setlist.rename,
                        onPress: () => setRenamingSetlistId(setlist.id),
                      },
                      {
                        key: "present",
                        label: t.setlist.present,
                        onPress: () =>
                          router.push({
                            pathname: "/setlist/[setlistId]/present",
                            params: { setlistId: setlist.id },
                          }),
                      },
                      {
                        key: "duplicate",
                        label: t.setlist.duplicate,
                        onPress: () => handleDuplicateSetlist(setlist.id),
                      },
                      {
                        key: "export",
                        label: t.setlist.export,
                        onPress: () =>
                          handleExportSetlist(
                            setlist.id,
                            setlist.name,
                            setlistSongs,
                          ),
                      },
                      {
                        key: "export-docx",
                        label: t.setlist.exportDocx,
                        onPress: () =>
                          handleExportSetlistDocx(setlist.name, setlistSongs),
                      },
                      {
                        key: "delete",
                        label: t.setlist.delete,
                        destructive: true,
                        onPress: () =>
                          handleDeleteSetlist(
                            setlist.id,
                            setlist.name,
                            setlistSongs.length,
                          ),
                      },
                    ]}
                    renaming={renamingSetlistId === setlist.id}
                    renamePlaceholder={t.setlist.renamePlaceholder}
                    onRenameSubmit={(name) =>
                      handleRenameSubmit(setlist.id, name)
                    }
                    onRenameCancel={() => setRenamingSetlistId(null)}
                    canMoveUp={canMoveUp}
                    canMoveDown={canMoveDown}
                    onMoveUp={() => handleMove(item, "up")}
                    onMoveDown={() => handleMove(item, "down")}
                    moveUpAccessibilityLabel={t.library.moveUp}
                    moveDownAccessibilityLabel={t.library.moveDown}
                  />
                  {expanded &&
                    (setlistSongs.length === 0 ? (
                      <Text style={styles.setlistEmpty}>{t.setlist.empty}</Text>
                    ) : (
                      setlistSongs.map((song, songIndex) => (
                        <SongRow
                          key={song.id}
                          testID={`song-row-${song.id}`}
                          nested
                          position={songIndex + 1}
                          title={song.name}
                          hasLyrics={Boolean(song.lyrics?.trim())}
                          hasLyricsLabel={t.song.hasLyrics}
                          noLyricsLabel={t.song.noLyricsYet}
                          menuAccessibilityLabel={t.setlist.songOptions}
                          menuItems={songMenuItems(song, setlist.id)}
                          onPress={() =>
                            router.push(
                              Boolean(song.lyrics?.trim())
                                ? {
                                    pathname: "/setlist/[setlistId]/present",
                                    params: {
                                      setlistId: setlist.id,
                                      songId: song.id,
                                    },
                                  }
                                : {
                                    pathname: "/song/[songId]",
                                    params: { songId: song.id },
                                  },
                            )
                          }
                          canMoveUp={songIndex > 0}
                          canMoveDown={songIndex < setlistSongs.length - 1}
                          onMoveUp={() =>
                            dispatch(
                              moveSongInSetlist(setlist.id, songIndex, "up"),
                            )
                          }
                          onMoveDown={() =>
                            dispatch(
                              moveSongInSetlist(setlist.id, songIndex, "down"),
                            )
                          }
                          moveUpAccessibilityLabel={t.library.moveUp}
                          moveDownAccessibilityLabel={t.library.moveDown}
                        />
                      ))
                    ))}
                </View>
              );
            }

            const song = item.song;
            return (
              <SongRow
                key={item.key}
                testID={`song-row-${song.id}`}
                title={song.name}
                hasLyrics={Boolean(song.lyrics?.trim())}
                hasLyricsLabel={t.song.hasLyrics}
                noLyricsLabel={t.song.noLyricsYet}
                menuAccessibilityLabel={t.setlist.songOptions}
                menuItems={songMenuItems(song)}
                onPress={() =>
                  router.push(
                    Boolean(song.lyrics?.trim())
                      ? {
                          pathname: "/song/[songId]/present",
                          params: { songId: song.id },
                        }
                      : {
                          pathname: "/song/[songId]",
                          params: { songId: song.id },
                        },
                  )
                }
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                onMoveUp={() => handleMove(item, "up")}
                onMoveDown={() => handleMove(item, "down")}
                moveUpAccessibilityLabel={t.library.moveUp}
                moveDownAccessibilityLabel={t.library.moveDown}
              />
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  searchRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  eyebrow: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  header: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  newSetlistButton: {
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  newSetlistText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "700",
  },
  newSongButton: {
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  newSongText: {
    color: colors.accentText,
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.8,
  },
  status: {
    color: colors.textSecondary,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  setlistGroup: {
    gap: spacing.sm,
  },
  setlistEmpty: {
    color: colors.textTertiary,
    fontSize: 13,
    marginLeft: spacing.lg,
    marginBottom: spacing.xs,
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 6,
  },
  emptyTitle: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyMeta: {
    color: colors.textTertiary,
    fontSize: 13,
  },
  loading: {
    marginTop: 60,
  },
});
