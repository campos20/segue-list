/** Shared visual language for the app - a dark, stage-friendly look with an amber accent for setlists. */
export const colors = {
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
} as const;

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
