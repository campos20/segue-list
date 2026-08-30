/**
 * "dark" is the app's default (not "system") because it has only ever been
 * dark until now - a fresh install with no saved preference must look
 * exactly like it always has, not suddenly follow whatever the device's
 * light/dark setting happens to be.
 */
export type ThemeOverride = "system" | "light" | "dark";

const THEME_OVERRIDES: readonly ThemeOverride[] = ["system", "light", "dark"];

/** Guards a value read off disk (`JSON.parse` gives no compile-time guarantee) before it's trusted as a ThemeOverride - a hand-edited or corrupted settings.json must not flow an arbitrary string into state. */
export function isThemeOverride(value: unknown): value is ThemeOverride {
  return (
    typeof value === "string" &&
    (THEME_OVERRIDES as readonly string[]).includes(value)
  );
}
