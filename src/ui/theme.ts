import { useColorScheme } from "react-native";
import { useAppSelector } from "@/store/hooks";
import type { ThemeOverride } from "@/types/theme";

export interface ThemeColors {
  background: string;
  panel: string;
  panelRaised: string;
  surface: string;
  border: string;
  borderLight: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentText: string;
  danger: string;
  success: string;
}

/** Shared visual language for the app - a stage-friendly look with an amber accent for setlists, in a dark and a light variant. */
export const darkColors: ThemeColors = {
  background: "#000000",
  panel: "#111114",
  panelRaised: "#18181c",
  surface: "#1c1c1f",
  border: "#2c2c2e",
  borderLight: "rgba(255,255,255,0.08)",
  textPrimary: "#ffffff",
  textSecondary: "#9b9b9d",
  textTertiary: "#5f5f63",
  accent: "#fbbf24",
  accentText: "#1c1400",
  danger: "#ff453a",
  success: "#34d399",
};

// Same relationships as darkColors (panel darker than surface, tertiary <
// secondary < primary text emphasis), not a straight color inversion - a
// slightly warm off-white rather than pure white, and a darker amber so
// `accent` still passes as body text, not just as a filled swatch.
export const lightColors: ThemeColors = {
  background: "#faf9f6",
  panel: "#f1efe8",
  panelRaised: "#e8e4da",
  surface: "#ffffff",
  border: "#ddd8cd",
  borderLight: "rgba(0,0,0,0.08)",
  textPrimary: "#1a1a18",
  textSecondary: "#5c5b56",
  textTertiary: "#8f8c84",
  accent: "#a15c00",
  accentText: "#fff6e6",
  danger: "#c81e37",
  success: "#0f8f5a",
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/** Soft elevation shadow for cards/panels floating above the background. */
export const elevation = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.4,
  shadowRadius: 12,
  elevation: 6,
} as const;

/** Colored glow used behind an active/highlighted control. */
export function glow(color: string, radius = 10) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: radius,
    elevation: 8,
  } as const;
}

/**
 * Resolves the persisted theme preference and the device's own color scheme
 * down to a single dark/light decision. Pulled out as a plain function (no
 * hooks) so it's unit-testable without rendering anything - `useThemeColors`
 * below is just this plus the two reactive data sources.
 */
export function resolveIsDark(
  themeOverride: ThemeOverride,
  // Android can report "unspecified" alongside RN's own null/undefined for
  // "the OS has no opinion" - all three fall back to dark, same as an
  // absent preference does, per this app's own default.
  systemScheme: string | null | undefined,
): boolean {
  if (themeOverride === "system") return systemScheme !== "light";
  return themeOverride !== "light";
}

function useIsDark(): boolean {
  const themeOverride = useAppSelector((state) => state.settings.themeOverride);
  const systemScheme = useColorScheme();
  return resolveIsDark(themeOverride, systemScheme);
}

/** The current theme's colors, reactive to the persisted preference and (when set to "system") the device's own light/dark setting. */
export function useThemeColors(): ThemeColors {
  return useIsDark() ? darkColors : lightColors;
}

/** For anything that needs the dark/light decision itself, not the color values - e.g. `<StatusBar style="light" | "dark">`. */
export function useThemeMode(): "dark" | "light" {
  return useIsDark() ? "dark" : "light";
}
