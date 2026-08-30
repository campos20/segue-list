/**
 * "dark" is the app's default (not "system") because it has only ever been
 * dark until now - a fresh install with no saved preference must look
 * exactly like it always has, not suddenly follow whatever the device's
 * light/dark setting happens to be.
 */
export type ThemeOverride = "system" | "light" | "dark";
