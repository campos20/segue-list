/**
 * Canonical English strings - the shape every other locale is checked
 * against (see pt-BR.ts).
 */
export const en = {
  common: {
    cancel: "Cancel",
    save: "Save",
    back: "← Back",
  },
  library: {
    eyebrow: "SEGUE LIST",
    title: "Library",
    newSetlist: "New setlist",
    newSong: "New song",
    moreOptions: "More options",
    emptyTitle: "Your library is empty",
    emptyMeta: "Add a song or start a setlist above.",
    moveUp: "Move up",
    moveDown: "Move down",
    importBackup: "Import backup",
    exportFullLibrary: "Export full library",
    exportBackup: "Export backup",
    exportSetlist: "Export setlist",
    importing: "Importing...",
    importAlreadyHere: "Everything in that backup is already in your library.",
    couldNotCreateSetlist: "Couldn't create the setlist.",
    couldNotCreateSong: "Couldn't create the song.",
    deleteSetlistTitle: "Delete setlist",
    deleteSetlistBody: (name: string, songCount: number) =>
      `Delete "${name}"${songCount > 0 ? ` (${songCount} song${songCount === 1 ? "" : "s"})` : ""}? Songs stay in your library.`,
    deleteSongTitle: "Delete song",
    deleteSongBody: (name: string) => `Delete "${name}"? It will be removed from any setlist too.`,
  },
  setlist: {
    songsCount: (count: number) => `${count} song${count === 1 ? "" : "s"}`,
    expand: "Expand",
    collapse: "Collapse",
    rename: "Rename",
    renamePlaceholder: "Setlist name",
    present: "Present",
    export: "Export",
    delete: "Delete",
    empty: "No songs in this setlist yet.",
    setlistOptions: "Setlist options",
    songOptions: "Song options",
    addTo: (name: string) => `Add to "${name}"`,
    removeFrom: "Remove from setlist",
    deleteSong: "Delete song",
  },
  song: {
    hasLyrics: "Has lyrics",
    noLyricsYet: "No lyrics yet",
    notFound: "Song not found.",
    nameLabel: "Song name",
    lyricsLabel: "Lyrics",
    lyricsPlaceholder: "Type or paste the lyrics...",
    saved: "Saved.",
  },
  presentation: {
    empty: "This setlist has no songs to present.",
    emptySong: "This song could not be found.",
    exit: "Exit",
    searchPlaceholder: "Search song...",
    noMatch: "No matching song.",
    noLyrics: "No lyrics for this song.",
    edit: "Edit",
  },
  menu: {
    about: "About",
  },
  about: {
    title: "About",
    developedBy: (name: string) => `Developed by ${name}`,
    version: (version: string) => `Version ${version}`,
    viewOnGithub: "View on GitHub",
    license: "License",
    language: "Language",
    languageSystem: "System",
    backToLibrary: "Library",
  },
};

export type TranslationDictionary = typeof en;
