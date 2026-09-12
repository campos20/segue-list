import {
  digitsFromDuration,
  formatDurationDigits,
  parseDurationDigits,
} from "./duration";

describe("formatDurationDigits", () => {
  it("leaves 1-2 digits as bare seconds", () => {
    expect(formatDurationDigits("3")).toBe("3");
    expect(formatDurationDigits("30")).toBe("30");
  });

  it("positions the colon before the last two digits once there's a minutes part", () => {
    expect(formatDurationDigits("300")).toBe("3:00");
    expect(formatDurationDigits("125")).toBe("1:25");
    expect(formatDurationDigits("9959")).toBe("99:59");
  });

  it("passes through an empty string", () => {
    expect(formatDurationDigits("")).toBe("");
  });
});

describe("parseDurationDigits", () => {
  it("parses 1-2 digits as bare seconds", () => {
    expect(parseDurationDigits("3")).toBe(3);
    expect(parseDurationDigits("30")).toBe(30);
  });

  it("treats the last two digits as seconds once there's a minutes part", () => {
    expect(parseDurationDigits("300")).toBe(180);
    expect(parseDurationDigits("125")).toBe(85);
  });

  it("returns null for an empty field (not set)", () => {
    expect(parseDurationDigits("")).toBeNull();
  });
});

describe("digitsFromDuration", () => {
  it("renders under a minute as bare seconds", () => {
    expect(digitsFromDuration(3)).toBe("3");
    expect(digitsFromDuration(45)).toBe("45");
  });

  it("renders a minutes part with zero-padded seconds", () => {
    expect(digitsFromDuration(180)).toBe("300");
    expect(digitsFromDuration(85)).toBe("125");
    expect(digitsFromDuration(61)).toBe("101");
  });

  it("rounds and clamps negative input to zero", () => {
    expect(digitsFromDuration(4.6)).toBe("5");
    expect(digitsFromDuration(-10)).toBe("0");
  });

  it("round-trips through parseDurationDigits", () => {
    for (const seconds of [3, 30, 45, 61, 85, 180, 225, 5999]) {
      expect(parseDurationDigits(digitsFromDuration(seconds))).toBe(seconds);
    }
  });
});
