import { strFromU8, unzipSync } from "fflate";
import type { SongManifest } from "@/types/song";
import { buildSongsDocx, docxFileName } from "./docxExport";

function makeSong(overrides: Partial<SongManifest> = {}): SongManifest {
  return {
    id: "song-1",
    name: "Test song",
    lyrics: "line one\nline two",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildSongsDocx", () => {
  it("produces a zip with the parts a .docx reader requires", () => {
    const zip = unzipSync(buildSongsDocx([makeSong()], "Friday", "No lyrics"));

    expect(Object.keys(zip).sort()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "word/document.xml",
    ]);
  });

  it("includes the title, song names and lyrics, escaped", () => {
    const zip = unzipSync(
      buildSongsDocx(
        [makeSong({ name: "Rock & Roll", lyrics: "a < b" })],
        "Friday",
        "No lyrics",
      ),
    );
    const xml = strFromU8(zip["word/document.xml"]);

    expect(xml).toContain("Friday");
    expect(xml).toContain("Rock &amp; Roll");
    expect(xml).toContain("a &lt; b");
  });

  it("uses the no-lyrics label for a song without lyrics", () => {
    const zip = unzipSync(
      buildSongsDocx([makeSong({ lyrics: null })], "Friday", "No lyrics yet"),
    );
    expect(strFromU8(zip["word/document.xml"])).toContain("No lyrics yet");
  });
});

describe("docxFileName", () => {
  it("slugs the label", () => {
    expect(docxFileName("Friday Night!")).toBe("friday-night.docx");
  });
});
