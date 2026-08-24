import { Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { colors, radii, spacing } from "@/ui/theme";

interface ButtonProps extends PressableProps {
  children: string;
  variant?: "primary" | "secondary";
}

export function Button({ children, disabled, variant = "primary", style, ...rest }: ButtonProps) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      disabled={disabled}
      style={(state) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        disabled && styles.disabled,
        state.pressed && styles.pressed,
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      <Text style={[styles.text, isPrimary ? styles.textPrimary : styles.textSecondary]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexShrink: 0,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
  text: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  textPrimary: {
    color: colors.accentText,
  },
  textSecondary: {
    color: colors.textPrimary,
  },
});
