import { isThemeOverride } from "./theme";

describe("isThemeOverride", () => {
  it("accepts each valid value", () => {
    expect(isThemeOverride("system")).toBe(true);
    expect(isThemeOverride("light")).toBe(true);
    expect(isThemeOverride("dark")).toBe(true);
  });

  it("rejects a corrupted or unrecognized value", () => {
    expect(isThemeOverride("auto")).toBe(false);
    expect(isThemeOverride("")).toBe(false);
    expect(isThemeOverride(undefined)).toBe(false);
    expect(isThemeOverride(null)).toBe(false);
    expect(isThemeOverride(42)).toBe(false);
    expect(isThemeOverride({ theme: "dark" })).toBe(false);
  });
});
