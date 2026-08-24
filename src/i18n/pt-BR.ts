import type { TranslationDictionary } from "./en";

/**
 * Brazilian Portuguese. Typed against `TranslationDictionary` so a missing
 * key is a compile error, not a silent English fallback at runtime.
 */
export const ptBR: TranslationDictionary = {
  common: {
    cancel: "Cancelar",
    save: "Salvar",
    back: "← Voltar",
  },
  library: {
    eyebrow: "SEGUE LIST",
    title: "Biblioteca",
    newSetlist: "Novo repertório",
    newSong: "Nova música",
    moreOptions: "Mais opções",
    emptyTitle: "Sua biblioteca está vazia",
    emptyMeta: "Adicione uma música ou crie um repertório acima.",
    moveUp: "Mover para cima",
    moveDown: "Mover para baixo",
    importBackup: "Importar backup",
    exportFullLibrary: "Exportar biblioteca completa",
    exportBackup: "Exportar backup",
    exportSetlist: "Exportar repertório",
    importing: "Importando...",
    importAlreadyHere: "Tudo nesse backup já está na sua biblioteca.",
    couldNotCreateSetlist: "Não foi possível criar o repertório.",
    couldNotCreateSong: "Não foi possível criar a música.",
    deleteSetlistTitle: "Excluir repertório",
    deleteSetlistBody: (name: string, songCount: number) =>
      `Excluir "${name}"${songCount > 0 ? ` (${songCount} ${songCount === 1 ? "música" : "músicas"})` : ""}? As músicas continuam na sua biblioteca.`,
    deleteSongTitle: "Excluir música",
    deleteSongBody: (name: string) => `Excluir "${name}"? Ela também será removida de qualquer repertório.`,
  },
  setlist: {
    songsCount: (count: number) => `${count} ${count === 1 ? "música" : "músicas"}`,
    expand: "Expandir",
    collapse: "Recolher",
    rename: "Renomear",
    renamePlaceholder: "Nome do repertório",
    present: "Apresentar",
    export: "Exportar",
    delete: "Excluir",
    empty: "Nenhuma música neste repertório ainda.",
    setlistOptions: "Opções do repertório",
    songOptions: "Opções da música",
    addTo: (name: string) => `Adicionar a "${name}"`,
    removeFrom: "Remover do repertório",
    deleteSong: "Excluir música",
  },
  song: {
    hasLyrics: "Tem letra",
    noLyricsYet: "Sem letra ainda",
    notFound: "Música não encontrada.",
    nameLabel: "Nome da música",
    lyricsLabel: "Letra",
    lyricsPlaceholder: "Digite ou cole a letra...",
    saved: "Salvo.",
  },
  presentation: {
    empty: "Este repertório não tem músicas para apresentar.",
    emptySong: "Esta música não foi encontrada.",
    exit: "Sair",
    searchPlaceholder: "Buscar música...",
    noMatch: "Nenhuma música encontrada.",
    noLyrics: "Sem letra para esta música.",
    edit: "Editar",
  },
  menu: {
    about: "Sobre",
  },
  about: {
    title: "Sobre",
    developedBy: (name: string) => `Desenvolvido por ${name}`,
    version: (version: string) => `Versão ${version}`,
    viewOnGithub: "Ver no GitHub",
    license: "Licença",
    language: "Idioma",
    languageSystem: "Sistema",
    backToLibrary: "Biblioteca",
  },
};
