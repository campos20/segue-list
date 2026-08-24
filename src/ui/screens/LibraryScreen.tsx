import Constants from "expo-constants";
import { getDocumentAsync } from "expo-document-picker";
import { File } from "expo-file-system";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { SongManifest } from "@/types/song";
import { shareBundle, writeBundleToCache } from "@/storage";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { importBundleIntoLibrary } from "@/store/persistBundle";
import { persistLibraryOrder } from "@/store/persistLibrary";
import {
  addSongToSetlist,
  createSetlist,
  deleteSetlist,
  moveSongInSetlist,
  removeSongFromSetlist,
  renameSetlist,
} from "@/store/persistSetlists";
import { createSong, deleteSong } from "@/store/persistSongs";
import { setlistsSelectors } from "@/store/setlistsSlice";
import { songsSelectors } from "@/store/songsSlice";
import { buildLibraryTree } from "@/ui/libraryTree";
import { moveItem } from "@/ui/reorder";
import { KebabIcon, OverflowMenu, type OverflowMenuItem } from "@/ui/components/OverflowMenu";
import { SetlistRow } from "@/ui/components/SetlistRow";
import { SongRow } from "@/ui/components/SongRow";
import { colors, radii, spacing } from "@/ui/theme";

export function LibraryScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const songs = useAppSelector((state) => songsSelectors.selectAll(state.songs));
  const setlists = useAppSelector((state) => setlistsSelectors.selectAll(state.setlists));
  const libraryOrder = useAppSelector((state) => state.settings.libraryOrder);
  const hydrated = useAppSelector((state) => state.songs.hydrated && state.setlists.hydrated);

  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [renamingSetlistId, setRenamingSetlistId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => buildLibraryTree(songs, setlists, libraryOrder), [songs, setlists, libraryOrder]);

  function handleMove(index: number, direction: "up" | "down") {
    const keys = items.map((item) => item.key);
    const reordered = moveItem(keys, index, direction);
    if (reordered !== keys) dispatch(persistLibraryOrder(reordered));
  }

  function handleNewSetlist() {
    const setlist = dispatch(createSetlist());
    if (!setlist) {
      setError("Couldn't create the setlist.");
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

  function handleDeleteSetlist(id: string, name: string, songCount: number) {
    Alert.alert(
      "Delete setlist",
      `Delete "${name}"${songCount > 0 ? ` (${songCount} song${songCount === 1 ? "" : "s"})` : ""}? Songs stay in your library.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => dispatch(deleteSetlist(id)) },
      ],
    );
  }

  function handleNewSong() {
    const song = dispatch(createSong());
    if (!song) {
      setError("Couldn't create the song.");
      return;
    }
    router.push({ pathname: "/song/[songId]", params: { songId: song.id } });
  }

  function handleDeleteSong(id: string, name: string) {
    Alert.alert("Delete song", `Delete "${name}"? It will be removed from any setlist too.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => dispatch(deleteSong(id)) },
    ]);
  }

  async function handleExportSetlist(setlistId: string, name: string, setlistSongs: SongManifest[]) {
    setError(null);
    try {
      const setlist = setlists.find((candidate) => candidate.id === setlistId);
      const bundle = writeBundleToCache(
        { songs: setlistSongs, setlists: setlist ? [setlist] : [] },
        name,
        Constants.expoConfig?.version,
      );
      await shareBundle(bundle, "Export setlist");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleExportAll() {
    setError(null);
    try {
      const bundle = writeBundleToCache({ songs, setlists }, "segue-list-backup", Constants.expoConfig?.version);
      await shareBundle(bundle, "Export backup");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleImport() {
    setError(null);
    try {
      const picked = await getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets[0]) return;

      setStatus("Importing...");
      const result = await dispatch(importBundleIntoLibrary(new File(picked.assets[0].uri)));
      setStatus(null);

      const imported = result.songs.length + result.setlists.length;
      const skipped = result.skippedSongIds.length + result.skippedSetlistIds.length;
      if (imported === 0 && skipped > 0) {
        setError("Everything in that backup is already in your library.");
      }
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  /** A song's menu: which setlists it can be added to, and - when it's shown inside one - a way back out. */
  function songMenuItems(song: SongManifest, containingSetlistId?: string): OverflowMenuItem[] {
    const additions: OverflowMenuItem[] = setlists
      .filter((setlist) => !setlist.songs.includes(song.id))
      .map((setlist) => ({
        key: `add-${setlist.id}`,
        label: `Add to "${setlist.name}"`,
        onPress: () => dispatch(addSongToSetlist(setlist.id, song.id)),
      }));

    const removal: OverflowMenuItem[] = containingSetlistId
      ? [
          {
            key: "remove",
            label: "Remove from setlist",
            onPress: () => dispatch(removeSongFromSetlist(containingSetlistId, song.id)),
          },
        ]
      : [];

    return [
      ...additions,
      ...removal,
      { key: "delete", label: "Delete song", destructive: true, onPress: () => handleDeleteSong(song.id, song.name) },
    ];
  }

  const libraryMenuItems: OverflowMenuItem[] = [
    { key: "import", label: "Import backup", onPress: handleImport },
    { key: "export", label: "Export full library", onPress: handleExportAll },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>SEGUE LIST</Text>
          <Text style={styles.header}>Library</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={handleNewSetlist}
            hitSlop={8}
            style={({ pressed }) => [styles.newSetlistButton, pressed && styles.pressed]}
          >
            <Text style={styles.newSetlistText}>New setlist</Text>
          </Pressable>
          <Pressable onPress={handleNewSong} hitSlop={8} style={({ pressed }) => [styles.newSongButton, pressed && styles.pressed]}>
            <Text style={styles.newSongText}>New song</Text>
          </Pressable>
          <OverflowMenu items={libraryMenuItems} accessibilityLabel="More options">
            <KebabIcon />
          </OverflowMenu>
        </View>
      </View>

      {status && <Text style={styles.status}>{status}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      <ScrollView contentContainerStyle={styles.list}>
        {!hydrated ? (
          <ActivityIndicator color={colors.accent} style={styles.loading} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Your library is empty</Text>
            <Text style={styles.emptyMeta}>Add a song or start a setlist above.</Text>
          </View>
        ) : (
          items.map((item, index) => {
            const canMoveUp = index > 0;
            const canMoveDown = index < items.length - 1;

            if (item.kind === "setlist") {
              const { setlist, songs: setlistSongs } = item;
              const expanded = !collapsed.includes(setlist.id);
              return (
                <View key={item.key} style={styles.setlistGroup}>
                  <SetlistRow
                    testID={`setlist-row-${setlist.id}`}
                    name={setlist.name}
                    songsLabel={`${setlistSongs.length} song${setlistSongs.length === 1 ? "" : "s"}`}
                    expanded={expanded}
                    onToggle={() =>
                      setCollapsed((current) =>
                        current.includes(setlist.id) ? current.filter((id) => id !== setlist.id) : [...current, setlist.id],
                      )
                    }
                    expandAccessibilityLabel={expanded ? "Collapse" : "Expand"}
                    menuAccessibilityLabel="Setlist options"
                    menuItems={[
                      { key: "rename", label: "Rename", onPress: () => setRenamingSetlistId(setlist.id) },
                      {
                        key: "present",
                        label: "Present",
                        onPress: () => router.push({ pathname: "/setlist/[setlistId]/present", params: { setlistId: setlist.id } }),
                      },
                      { key: "export", label: "Export", onPress: () => handleExportSetlist(setlist.id, setlist.name, setlistSongs) },
                      {
                        key: "delete",
                        label: "Delete",
                        destructive: true,
                        onPress: () => handleDeleteSetlist(setlist.id, setlist.name, setlistSongs.length),
                      },
                    ]}
                    renaming={renamingSetlistId === setlist.id}
                    renamePlaceholder="Setlist name"
                    onRenameSubmit={(name) => handleRenameSubmit(setlist.id, name)}
                    onRenameCancel={() => setRenamingSetlistId(null)}
                    canMoveUp={canMoveUp}
                    canMoveDown={canMoveDown}
                    onMoveUp={() => handleMove(index, "up")}
                    onMoveDown={() => handleMove(index, "down")}
                    moveUpAccessibilityLabel="Move up"
                    moveDownAccessibilityLabel="Move down"
                  />
                  {expanded &&
                    (setlistSongs.length === 0 ? (
                      <Text style={styles.setlistEmpty}>No songs in this setlist yet.</Text>
                    ) : (
                      setlistSongs.map((song, songIndex) => (
                        <SongRow
                          key={song.id}
                          testID={`song-row-${song.id}`}
                          nested
                          position={songIndex + 1}
                          title={song.name}
                          hasLyrics={Boolean(song.lyrics?.trim())}
                          menuAccessibilityLabel="Song options"
                          menuItems={songMenuItems(song, setlist.id)}
                          onPress={() => router.push({ pathname: "/song/[songId]", params: { songId: song.id } })}
                          canMoveUp={songIndex > 0}
                          canMoveDown={songIndex < setlistSongs.length - 1}
                          onMoveUp={() => dispatch(moveSongInSetlist(setlist.id, songIndex, "up"))}
                          onMoveDown={() => dispatch(moveSongInSetlist(setlist.id, songIndex, "down"))}
                          moveUpAccessibilityLabel="Move up"
                          moveDownAccessibilityLabel="Move down"
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
                menuAccessibilityLabel="Song options"
                menuItems={songMenuItems(song)}
                onPress={() => router.push({ pathname: "/song/[songId]", params: { songId: song.id } })}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                onMoveUp={() => handleMove(index, "up")}
                onMoveDown={() => handleMove(index, "down")}
                moveUpAccessibilityLabel="Move up"
                moveDownAccessibilityLabel="Move down"
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
