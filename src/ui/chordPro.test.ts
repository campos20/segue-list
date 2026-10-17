import type { SongManifest } from "@/types/song";
import {
  chordProFileName,
  looksLikeChordPro,
  parseChordPro,
  parsePastedChordChart,
  songToChordPro,
  songsToChordPro,
} from "./chordPro";

function makeSong(overrides: Partial<SongManifest> = {}): SongManifest {
  return {
    id: "song-1",
    name: "Amazing Grace",
    lyrics: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("looksLikeChordPro", () => {
  it("recognizes a directive line", () => {
    expect(looksLikeChordPro("{title: Amazing Grace}\nla la")).toBe(true);
    expect(looksLikeChordPro("{soc}\nla la\n{eoc}")).toBe(true);
    expect(looksLikeChordPro("{t:Short form}")).toBe(true);
  });

  it("recognizes inline chords on two or more lines", () => {
    expect(looksLikeChordPro("A[G]mazing grace\nhow [C]sweet")).toBe(true);
  });

  it("doesn't mistake plain lyrics for ChordPro", () => {
    expect(looksLikeChordPro("Amazing grace\nhow sweet the sound")).toBe(false);
    // A single chord-shaped bracket isn't enough evidence.
    expect(looksLikeChordPro("I said [A] word\nand left")).toBe(false);
    // Section markers aren't chords.
    expect(looksLikeChordPro("[Chorus]\nla la\n[Verse 2]\nla")).toBe(false);
    // Neither are unknown brace lines.
    expect(looksLikeChordPro("{whatever}\nla")).toBe(false);
  });

  it("doesn't mistake a chords-above-lyrics chart for ChordPro", () => {
    expect(
      looksLikeChordPro("G        C\nAmazing grace\nD    G\nhow sweet"),
    ).toBe(false);
  });
});

describe("parseChordPro", () => {
  it("places each chord at its column over the lyric", () => {
    const [song] = parseChordPro(
      "{title: Amazing Grace}\nA[G]mazing [G7]grace, how [C]sweet",
    );
    expect(song.title).toBe("Amazing Grace");
    expect(song.lyrics).toBe("Amazing grace, how sweet");
    expect(song.chords).toBe(" G      G7         C");
    expect(song.chords.indexOf("G7")).toBe(song.lyrics.indexOf("grace"));
    expect(song.chords.indexOf("C")).toBe(song.lyrics.indexOf("sweet"));
  });

  it("shifts crowded chords right instead of overlapping, leaving the lyrics untouched", () => {
    const [song] = parseChordPro("[Am][G]la [C]da");
    expect(song.lyrics).toBe("la da");
    expect(song.chords).toBe("Am G C");
  });

  it("keeps a chord-only (instrumental) line as a chord row with a blank lyric", () => {
    // Each chord sits where it falls in the (blank) lyric: C two
    // characters after G's start, D two after C's.
    const [song] = parseChordPro("[G]  [C]  [D]\nsing");
    expect(song.chords.split("\n")[0]).toBe("G C D");
    expect(song.lyrics.split("\n")).toEqual(["", "sing"]);
  });

  it("leaves brackets that aren't chords in the lyrics, so the song stays saveable", () => {
    const [song] = parseChordPro("[G]la [N.C.]stop [Chorus]");
    expect(song.lyrics).toBe("la [N.C.]stop [Chorus]");
    expect(song.chords).toBe("G");
  });

  it("drops # comments and turns {comment} into a visible line", () => {
    const [song] = parseChordPro("# arranged by someone\n{c: Slowly}\n[G]la");
    expect(song.lyrics.split("\n")).toEqual(["Slowly", "la"]);
    expect(song.chords.split("\n")).toEqual(["", "G"]);
  });

  it("keeps a section label as a line, and drops unlabelled section markers", () => {
    const [song] = parseChordPro(
      "{start_of_verse: Verse 1}\nla\n{end_of_verse}\n{soc}\nchorus line\n{eoc}",
    );
    expect(song.lyrics.split("\n")).toEqual(["Verse 1", "la", "chorus line"]);
  });

  it("repeats the last chorus for {chorus}", () => {
    const [song] = parseChordPro("{soc}\n[C]sing it\n{eoc}\nverse\n{chorus}");
    expect(song.lyrics.split("\n")).toEqual(["sing it", "verse", "sing it"]);
    expect(song.chords.split("\n")).toEqual(["C", "", "C"]);
  });

  it("keeps tab blocks verbatim and skips notation blocks", () => {
    const [song] = parseChordPro(
      "{sot}\ne|--[0]--|\n{eot}\n{start_of_abc}\nX:1\nK:G\n{end_of_abc}\n[G]after",
    );
    expect(song.lyrics.split("\n")).toEqual(["e|--[0]--|", "after"]);
    expect(song.chords.split("\n")).toEqual(["", "G"]);
  });

  it("reads duration and transpose, in their various forms", () => {
    expect(parseChordPro("{duration: 3:45}\n[G]la")[0].durationSeconds).toBe(
      225,
    );
    expect(parseChordPro("{duration: 200}\n[G]la")[0].durationSeconds).toBe(
      200,
    );
    expect(
      parseChordPro("{duration: soon}\n[G]la")[0].durationSeconds,
    ).toBeNull();
    expect(parseChordPro("{transpose: -2}\n[G]la")[0].transposeSteps).toBe(-2);
    expect(parseChordPro("{transpose: x}\n[G]la")[0].transposeSteps).toBe(0);
  });

  it("reads the long {meta: ...} form and conditional directive names", () => {
    expect(parseChordPro("{meta: title Long Form}\nla")[0].title).toBe(
      "Long Form",
    );
    expect(parseChordPro("{title-guitar: For Guitar}\nla")[0].title).toBe(
      "For Guitar",
    );
  });

  it("splits several songs on {new_song}", () => {
    const songs = parseChordPro(
      "{title: One}\n[G]first\n{new_song}\n{title: Two}\n[C]second",
    );
    expect(songs.map((song) => song.title)).toEqual(["One", "Two"]);
    expect(songs.map((song) => song.lyrics)).toEqual(["first", "second"]);
  });

  it("leaves chords empty and lyrics intact for a song without any", () => {
    const [song] = parseChordPro("{title: Spoken}\nline one\n\nline two");
    expect(song.chords).toBe("");
    expect(song.lyrics).toBe("line one\n\nline two");
  });

  it("handles Windows line endings", () => {
    const [song] = parseChordPro("{title: X}\r\n[G]la\r\n[C]da");
    expect(song.lyrics).toBe("la\nda");
    expect(song.chords).toBe("G\nC");
  });
});

describe("parsePastedChordChart", () => {
  it("converts ChordPro, keeping its transposition", () => {
    expect(
      parsePastedChordChart("{transpose: 2}\nA[G]mazing\n[C]grace"),
    ).toEqual({ chords: " G\nC", lyrics: "Amazing\ngrace", transposeSteps: 2 });
  });

  it("falls back to the chords-above-lyrics parser for anything else", () => {
    expect(parsePastedChordChart("G\nAmazing\nC\ngrace")).toEqual({
      chords: "G\nC",
      lyrics: "Amazing\ngrace",
      transposeSteps: 0,
    });
  });
});

describe("songToChordPro", () => {
  it("writes the title, duration, and chords inline over their syllables", () => {
    const song = makeSong({
      lyrics: "Amazing grace",
      chords: " G      G7",
      durationSeconds: 225,
    });
    expect(songToChordPro(song)).toBe(
      "{title: Amazing Grace}\n{duration: 3:45}\n\nA[G]mazing [G7]grace",
    );
  });

  it("writes chords at the pitch the song is shown at, positioned by the original line", () => {
    const song = makeSong({
      lyrics: "Amazing grace",
      chords: " C      F",
      transposeSteps: 1,
    });
    expect(songToChordPro(song)).toContain("A[C#]mazing [F#]grace");
  });

  it("pads a lyric so chords past its end (or on a chord-only row) keep their spacing", () => {
    const song = makeSong({ lyrics: "\nla", chords: "G  C\nD" });
    expect(songToChordPro(song).split("\n").slice(2)).toEqual([
      "[G]   [C]",
      "[D]la",
    ]);
    // ...which reads back as the same rows.
    const [parsed] = parseChordPro(songToChordPro(song));
    expect(parsed.chords).toBe("G  C\nD");
    expect(parsed.lyrics).toBe("\nla");
  });

  it("drops lyric colors and writes plain lyrics when there are no chords", () => {
    const song = makeSong({
      lyrics: 'hello <span style="color:#FBBF24;">world</span>\nagain',
    });
    expect(songToChordPro(song)).toBe(
      "{title: Amazing Grace}\n\nhello world\nagain",
    );
  });

  it("round-trips through parseChordPro", () => {
    const song = makeSong({
      lyrics: "Amazing grace, how sweet\n\nthe sound",
      chords: " G      G7         C\n\n    D",
      durationSeconds: 200,
    });
    const [parsed] = parseChordPro(songToChordPro(song));
    expect(parsed).toEqual({
      title: "Amazing Grace",
      lyrics: song.lyrics,
      chords: song.chords,
      durationSeconds: 200,
      transposeSteps: 0,
    });
  });
});

describe("songsToChordPro", () => {
  it("separates songs with {new_song}, and parses back into the same songs", () => {
    const text = songsToChordPro([
      makeSong({ name: "One", lyrics: "first", chords: "G" }),
      makeSong({ name: "Two", lyrics: "second", chords: "C" }),
    ]);
    expect(text).toContain("\n{new_song}\n");
    expect(parseChordPro(text).map((song) => song.title)).toEqual([
      "One",
      "Two",
    ]);
  });
});

describe("chordProFileName", () => {
  it("slugs the label", () => {
    expect(chordProFileName("Friday Night!")).toBe("friday-night.cho");
  });
});
