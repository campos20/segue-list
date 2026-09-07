import { formatDuration, parseDurationInput } from "./duration";

describe("parseDurationInput", () => {
  it("parses m:ss", () => {
    expect(parseDurationInput("3:45")).toBe(225);
  });

  it("parses a single-digit seconds part", () => {
    expect(parseDurationInput("3:5")).toBe(185);
  });

  it("parses a bare number of seconds", () => {
    expect(parseDurationInput("90")).toBe(90);
  });

  it("trims surrounding whitespace", () => {
    expect(parseDurationInput("  3:45  ")).toBe(225);
  });

  it("returns null for a blank field", () => {
    expect(parseDurationInput("")).toBeNull();
    expect(parseDurationInput("   ")).toBeNull();
  });

  it("returns null for text that isn't a duration", () => {
    expect(parseDurationInput("abc")).toBeNull();
    expect(parseDurationInput("3:60")).toBeNull();
    expect(parseDurationInput("3:456")).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formats seconds as m:ss with padded seconds", () => {
    expect(formatDuration(225)).toBe("3:45");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(5)).toBe("0:05");
  });

  it("rounds and clamps negative input to zero", () => {
    expect(formatDuration(4.6)).toBe("0:05");
    expect(formatDuration(-10)).toBe("0:00");
  });
});
