import { strToU8, zipSync } from "fflate";
import { extractSongsFromFile, type ReadableFile } from "./lyricsImport";
import { LyricsImportError } from "./lyricsImportError";

function textFile(text: string): ReadableFile {
  return {
    text: async () => text,
    bytes: async () => strToU8(text),
  };
}

function docxFile(paragraphs: string[]): ReadableFile {
  const body = paragraphs
    .map((text) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`)
    .join("");
  const bytes = zipSync({
    "word/document.xml": strToU8(
      `<?xml version="1.0"?><w:document><w:body>${body}</w:body></w:document>`,
    ),
  });
  return { text: async () => "", bytes: async () => bytes };
}

const CHORDPRO = [
  "{title: Amazing Grace}",
  "{duration: 3:45}",
  "A[G]mazing [G7]grace",
  "how [C]sweet the sound",
].join("\n");

describe("extractSongsFromFile", () => {
  it("imports a plain lyrics .txt as one song named after the file, without chords", async () => {
    expect(
      await extractSongsFromFile(textFile("line one\nline two"), "My Song.txt"),
    ).toEqual([
      {
        name: "My Song",
        lyrics: "line one\nline two",
        chords: null,
        durationSeconds: null,
        transposeSteps: 0,
      },
    ]);
  });

  it("imports a .cho file with its title, chords and duration", async () => {
    const [song] = await extractSongsFromFile(textFile(CHORDPRO), "grace.cho");
    expect(song.name).toBe("Amazing Grace");
    expect(song.lyrics).toBe("Amazing grace\nhow sweet the sound");
    expect(song.chords).toBe(" G      G7\n    C");
    expect(song.durationSeconds).toBe(225);
  });

  it.each(["chordpro", "chopro", "crd", "pro", "CHO"])(
    "accepts the .%s extension",
    async (extension) => {
      const [song] = await extractSongsFromFile(
        textFile(CHORDPRO),
        `grace.${extension}`,
      );
      expect(song.chords).not.toBeNull();
    },
  );

  it("detects ChordPro inside a .txt - nothing for the user to choose", async () => {
    const [song] = await extractSongsFromFile(textFile(CHORDPRO), "grace.txt");
    expect(song.name).toBe("Amazing Grace");
    expect(song.chords).toBe(" G      G7\n    C");
  });

  it("detects ChordPro inside a .docx too", async () => {
    const [song] = await extractSongsFromFile(
      docxFile(CHORDPRO.split("\n")),
      "grace.docx",
    );
    expect(song.name).toBe("Amazing Grace");
    expect(song.chords).toBe(" G      G7\n    C");
  });

  it("imports every song of a multi-song file, numbering untitled ones after the file", async () => {
    const songs = await extractSongsFromFile(
      textFile("[G]one\n[C]uno\n{new_song}\n[D]two\n[A]dos"),
      "Set.cho",
    );
    expect(songs.map((song) => song.name)).toEqual(["Set (1)", "Set (2)"]);
  });

  it("names an untitled single ChordPro song after the file", async () => {
    const [song] = await extractSongsFromFile(
      textFile("[G]one\n[C]two"),
      "Untitled.cho",
    );
    expect(song.name).toBe("Untitled");
  });

  it("rejects an unsupported extension by name", async () => {
    await expect(
      extractSongsFromFile(textFile("x"), "photo.jpg"),
    ).rejects.toThrow(LyricsImportError);
    await expect(
      extractSongsFromFile(textFile("x"), "photo.jpg"),
    ).rejects.toThrow(/ChordPro/);
  });
});
