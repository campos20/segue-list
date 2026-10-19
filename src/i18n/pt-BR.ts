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
    apply: "Aplicar",
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
    importLyricsFiles: "Importar arquivos de letra",
    exportFullLibrary: "Exportar biblioteca completa",
    exportFullLibraryDocx: "Exportar biblioteca completa como .docx",
    exportFullLibraryChordPro: "Exportar biblioteca completa como ChordPro",
    exportBackup: "Exportar backup",
    exportSetlist: "Exportar repertório",
    importing: "Importando...",
    importingLyricsFiles: "Importando arquivos de letra...",
    importAlreadyHere: "Tudo nesse backup já está na sua biblioteca.",
    importNewerTitle: "Substituir por versões mais recentes?",
    importNewerBody: (songCount: number, setlistCount: number) => {
      const parts = [
        songCount > 0
          ? `${songCount} ${songCount === 1 ? "música" : "músicas"}`
          : "",
        setlistCount > 0
          ? `${setlistCount} ${setlistCount === 1 ? "repertório" : "repertórios"}`
          : "",
      ].filter(Boolean);
      return `Este backup tem versões mais recentes de ${parts.join(" e ")} que já estão na sua biblioteca. Suas versões atuais serão substituídas.`;
    },
    importKeepMine: "Manter as minhas",
    importPartlyFailed: (count: number) =>
      `Não foi possível salvar ${count} ${count === 1 ? "item" : "itens"} do backup - todo o resto foi importado.`,
    importReplace: "Substituir",
    importNewerFailed: (count: number) =>
      `Não foi possível atualizar ${count} ${count === 1 ? "item" : "itens"} do backup.`,
    importLyricsFilesFailed: (fileNames: string[]) => {
      const shown = fileNames.slice(0, 3).join(", ");
      const remaining = fileNames.length - 3;
      return `Não foi possível importar: ${shown}${remaining > 0 ? `, e mais ${remaining}` : ""}.`;
    },
    couldNotCreateSetlist: "Não foi possível criar o repertório.",
    couldNotCreateSong: "Não foi possível criar a música.",
    couldNotDuplicateSetlist: "Não foi possível duplicar o repertório.",
    deleteSetlistTitle: "Excluir repertório",
    deleteSetlistBody: (name: string, songCount: number) =>
      `Excluir "${name}"${songCount > 0 ? ` (${songCount} ${songCount === 1 ? "música" : "músicas"})` : ""}? As músicas continuam na sua biblioteca.`,
    deleteSongTitle: "Excluir música",
    deleteSongBody: (name: string) =>
      `Excluir "${name}"? Ela também será removida de qualquer repertório.`,
    searchPlaceholder: "Buscar músicas, repertórios e tags...",
    noResultsTitle: "Nada encontrado",
    noResultsMeta: "Tente outra busca.",
  },
  setlist: {
    songsCount: (count: number) =>
      `${count} ${count === 1 ? "música" : "músicas"}`,
    expand: "Expandir",
    collapse: "Recolher",
    rename: "Renomear",
    renamePlaceholder: "Nome do repertório",
    present: "Apresentar",
    export: "Exportar",
    exportDocx: "Exportar como .docx",
    exportChordPro: "Exportar como ChordPro",
    shareText: "Compartilhar lista de músicas",
    duplicate: "Duplicar",
    duplicateName: (name: string) => `${name} cópia`,
    sort: "Ordenar",
    sortTitle: "Ordenar repertório",
    sortAlphabetical: "Alfabeticamente",
    sortByTag: "Por tag",
    sortNoTags: "Nenhuma música deste repertório tem uma tag ainda.",
    sortTagHint:
      "As músicas com tag vão para o topo, nesta ordem. O resto mantém sua posição.",
    sortConfirm: "Ordenar",
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
    durationLabel: "Duração",
    durationPlaceholder: "300",
    durationDefaultHint:
      "Somente números, ex.: 300 vira 3:00. Deixe em branco para usar 3:00 como padrão.",
    durationHintToggleLabel: (visible: boolean) =>
      visible ? "Ocultar dica de duração" : "Mostrar dica de duração",
    lyricsLabel: "Letra",
    lyricsPlaceholder: "Digite ou cole a letra...",
    tagsLabel: "Tags",
    noTags: "Nenhuma tag ainda",
    tagsToggleLabel: (expanded: boolean) =>
      expanded ? "Recolher tags" : "Expandir tags",
    tagsPlaceholder: "Adicionar uma tag...",
    addTag: "Adicionar",
    removeTag: (tag: string) => `Remover tag "${tag}"`,
    suggestedTags: "Sugeridas",
    colorButton: "Cor",
    colorHint:
      "Selecione o texto acima e toque em Cor para definir a cor da fonte/fundo (ex.: backing vocal).",
    colorTitle: "Cor",
    textColorLabel: "Cor da fonte",
    backgroundColorLabel: "Cor de fundo",
    colorNone: "Nenhuma",
    richTextTab: "Texto",
    chordsTab: "Acordes",
    chordsLabel: "Acordes",
    chordsModeHint:
      "Acordes e letra se alinham por linha - a linha 1 dos acordes corresponde à linha 1 da letra, e assim por diante. Cores não são editáveis aqui; use Texto rico para isso.",
    addLine: "+ Adicionar linha",
    removeLineLabel: (line: number) => `Remover linha ${line}`,
    transposeOriginal: "Tom original",
    transposeLabel: (steps: number) => {
      const sign = steps > 0 ? "+" : "";
      const unit = Math.abs(steps) === 1 ? "semitom" : "semitons";
      return `${sign}${steps} ${unit}`;
    },
    transposeDownLabel: "Transpor meio tom abaixo",
    transposeUpLabel: "Transpor meio tom acima",
    transposeReset: "Redefinir",
    transposeEditHint:
      "Os acordes são exibidos transpostos - redefina para o tom original para editá-los diretamente.",
    pasteChordsButton: "Colar cifra",
    pasteChordsTitle: "Colar cifra + letra",
    pasteChordsHint:
      "Cole uma cifra com uma linha de acordes acima de cada linha da letra, ou no formato ChordPro ([G]assim) - acordes e letra serão separados automaticamente.",
    pasteChordsPlaceholder: "Cole aqui...",
    pasteChordsImport: "Importar",
    pasteChordsOverwriteTitle: "Substituir os acordes e a letra atuais?",
    pasteChordsOverwriteBody:
      "Esta música já tem acordes ou letra preenchidos aqui. Colar vai substituí-los.",
    pasteChordsOverwriteConfirm: "Substituir",
    invalidChordsTitle: "Acordes inválidos",
    invalidChordsBody: (invalid: { line: number; token: string }[]) => {
      const shown = invalid
        .slice(0, 5)
        .map((entry) => `"${entry.token}" (linha ${entry.line})`)
        .join(", ");
      const remaining = invalid.length - 5;
      return `Corrija antes de salvar: ${shown}${remaining > 0 ? `, e mais ${remaining}` : ""}.`;
    },
    saved: "Salvo.",
    saveFailed:
      "Não foi possível salvar - suas edições continuam aqui. Tente novamente.",
    discardTitle: "Descartar alterações?",
    discardBody: "Você tem alterações não salvas nesta música.",
    discardConfirm: "Descartar",
    keepEditing: "Continuar editando",
    themeLink: "Quer alterar entre modo claro e escuro? Vá em configurações.",
  },
  presentation: {
    empty: "Este repertório não tem músicas para apresentar.",
    emptySong: "Esta música não foi encontrada.",
    exit: "Sair",
    searchPlaceholder: "Buscar música...",
    noMatch: "Nenhuma música encontrada.",
    noLyrics: "Sem letra para esta música.",
    edit: "Editar",
    menuToggleLabel: (open: boolean): string =>
      open ? "Fechar menu de músicas" : "Abrir menu de músicas",
    scrollPlayLabel: (playing: boolean): string =>
      playing ? "Pausar rolagem automática" : "Iniciar rolagem automática",
    scrollStopLabel: "Parar rolagem automática",
    noLyricsHint:
      "Adicione a letra desta música para habilitar a rolagem automática.",
  },
  menu: {
    about: "Sobre",
    settings: "Configurações",
  },
  about: {
    title: "Sobre",
    developedBy: (name: string) => `Desenvolvido por ${name}`,
    version: (version: string) => `Versão ${version}`,
    viewOnGithub: "Ver no GitHub",
    license: "Licença",
    backToLibrary: "Biblioteca",
  },
  settings: {
    title: "Configurações",
    language: "Idioma",
    languageSystem: "Sistema",
    theme: "Aparência",
    themeSystem: "Sistema",
    themeLight: "Claro",
    themeDark: "Escuro",
  },
  sendToPhone: {
    menuItem: "Enviar para o celular (QR code)",
    title: "Escaneie com o celular",
    hint: "Aponte a câmera do celular para este código. Ele abre a música no navegador - toque em “Abrir no app Segue List” lá para salvá-la no app.",
    tooLong:
      "Esta música é longa demais para caber em um QR code. Use “Exportar como ChordPro” ou “Exportar biblioteca completa”.",
    close: "Fechar",
  },
  importLink: {
    title: "Importar música",
    invalid: "Este não é um link de música válido do Segue List.",
    newerVersion:
      "Esta música foi compartilhada de uma versão mais nova do app. Atualize o app para abri-la.",
    loading: "Carregando sua biblioteca...",
    withChords: "Com acordes",
    save: "Salvar na biblioteca",
    update: "Atualizar música",
    updateHint:
      "Sua biblioteca tem uma versão mais antiga desta música - atualizar a substitui.",
    upToDate: "Sua biblioteca já tem esta versão da música, ou uma mais nova.",
    openSong: "Abrir música",
    saveFailed: "Não foi possível salvar a música. Tente novamente.",
    openInApp: "Abrir no app Segue List",
    openInAppHint: "Está no celular? Abra a música no app Segue List.",
    orSaveHere: "Ou guarde neste navegador:",
    getApp: "Não tem o app? Baixe no Google Play",
    goToLibrary: "Ir para a biblioteca",
  },
  web: {
    storageNotice:
      "Sua biblioteca está salva apenas neste navegador. Use “Exportar biblioteca completa” para guardar uma cópia ou levá-la para o celular.",
    dismiss: "Fechar",
    changedElsewhere:
      "Esta biblioteca foi alterada em outra aba. Recarregue para continuar editando - nada mais será salvo aqui até lá.",
    reload: "Recarregar",
  },
};
