import { isValidChordToken, sanitizeChordsText } from "./chordValidation";

describe("isValidChordToken", () => {
  it.each([
    "C",
    "Am",
    "F#dim7",
    "Bbmaj7",
    "G7",
    "Csus4",
    "D/F#",
    "C6/9",
    "Am7b5",
  ])("accepts a recognized chord %p", (token) => {
    expect(isValidChordToken(token)).toBe(true);
  });

  it.each(["", "Chorus", "Verse", "Capo", "N.C.", "1", "Hz", "Xyz"])(
    "rejects a non-chord token %p",
    (token) => {
      expect(isValidChordToken(token)).toBe(false);
    },
  );

  it("rejects a slash chord whose bass note doesn't parse", () => {
    expect(isValidChordToken("D/Verse")).toBe(false);
  });

  it("rejects a slash chord whose root doesn't parse", () => {
    expect(isValidChordToken("Verse/F#")).toBe(false);
  });
});

describe("sanitizeChordsText", () => {
  it("leaves a line of only valid chords untouched", () => {
    const line = "Am          C";
    expect(sanitizeChordsText(line)).toBe(line);
  });

  it("strips an invalid word but keeps surrounding spacing intact", () => {
    const line = "Am    Chorus    C";
    expect(sanitizeChordsText(line)).toBe("Am        C");
  });

  it("preserves blank lines and processes each line independently", () => {
    const text = "Am    C\n\nInvalid    G";
    expect(sanitizeChordsText(text)).toBe("Am    C\n\n    G");
  });

  it("preserves leading indentation", () => {
    expect(sanitizeChordsText("   Am   Nope")).toBe("   Am   ");
  });
});
