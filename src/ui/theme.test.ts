import { resolveIsDark } from "./theme";

describe("resolveIsDark", () => {
  it("is dark when the override is explicitly dark", () => {
    expect(resolveIsDark("dark", "light")).toBe(true);
  });

  it("is light when the override is explicitly light", () => {
    expect(resolveIsDark("light", "dark")).toBe(false);
  });

  it("follows the system scheme when set to system", () => {
    expect(resolveIsDark("system", "light")).toBe(false);
    expect(resolveIsDark("system", "dark")).toBe(true);
  });

  it("falls back to dark when system is set but the OS has no opinion", () => {
    expect(resolveIsDark("system", null)).toBe(true);
    expect(resolveIsDark("system", undefined)).toBe(true);
    expect(resolveIsDark("system", "unspecified")).toBe(true);
  });
});
