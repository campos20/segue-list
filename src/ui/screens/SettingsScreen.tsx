import { useMemo } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { type Locale, useTranslation } from "@/i18n";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  persistLanguageOverride,
  persistThemeOverride,
} from "@/store/persistSettings";
import type { ThemeOverride } from "@/types/theme";
import { OverflowMenu } from "@/ui/components/OverflowMenu";
import { radii, spacing, useThemeColors, type ThemeColors } from "@/ui/theme";

type LanguageKey = "system" | Locale;

const LANGUAGE_FLAGS: Record<LanguageKey, string> = {
  system: "🌐",
  en: "🇺🇸",
  "pt-BR": "🇧🇷",
};

// Named in their own language, regardless of the app's current language - the
// standard convention (iOS/Android system pickers, most apps) is that
// "Português (Brasil)" reads the same whether browsing from English or
// Portuguese, so a reader can always find their own language.
const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  "pt-BR": "Português (Brasil)",
};

const THEME_ICONS: Record<ThemeOverride, string> = {
  system: "🌐",
  light: "☀️",
  dark: "🌙",
};

export function SettingsScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const languageOverride = useAppSelector(
    (state) => state.settings.languageOverride,
  );
  const themeOverride = useAppSelector((state) => state.settings.themeOverride);

  const currentLanguageKey: LanguageKey = languageOverride ?? "system";
  const currentLanguageLabel =
    currentLanguageKey === "system"
      ? t.settings.languageSystem
      : LANGUAGE_NAMES[currentLanguageKey];

  const languageMenuItems = (["system", "en", "pt-BR"] as const).map((key) => ({
    key,
    label: `${LANGUAGE_FLAGS[key]} ${key === "system" ? t.settings.languageSystem : LANGUAGE_NAMES[key]}`,
    onPress: () =>
      dispatch(persistLanguageOverride(key === "system" ? null : key)),
    testID: `language-option-${key}`,
  }));

  const THEME_LABELS: Record<ThemeOverride, string> = {
    system: t.settings.themeSystem,
    light: t.settings.themeLight,
    dark: t.settings.themeDark,
  };

  const themeMenuItems = (["system", "light", "dark"] as const).map((key) => ({
    key,
    label: `${THEME_ICONS[key]} ${THEME_LABELS[key]}`,
    onPress: () => dispatch(persistThemeOverride(key)),
    testID: `theme-option-${key}`,
  }));

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          testID="settings-back-button"
        >
          <Text style={styles.back}>{t.common.back}</Text>
        </Pressable>
        <Text style={styles.title}>{t.settings.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>{t.settings.language}</Text>
          <OverflowMenu
            items={languageMenuItems}
            align="start"
            accessibilityLabel={t.settings.language}
            testID="settings-language-menu"
          >
            <View style={styles.trigger}>
              <Text style={styles.triggerValue}>
                {LANGUAGE_FLAGS[currentLanguageKey]} {currentLanguageLabel}
              </Text>
              <Text style={styles.triggerChevron}>›</Text>
            </View>
          </OverflowMenu>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>{t.settings.theme}</Text>
          <OverflowMenu
            items={themeMenuItems}
            align="start"
            accessibilityLabel={t.settings.theme}
            testID="settings-theme-menu"
          >
            <View style={styles.trigger}>
              <Text style={styles.triggerValue}>
                {THEME_ICONS[themeOverride]} {THEME_LABELS[themeOverride]}
              </Text>
              <Text style={styles.triggerChevron}>›</Text>
            </View>
          </OverflowMenu>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      gap: spacing.xs,
    },
    back: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 26,
      fontWeight: "800",
      letterSpacing: -0.3,
      marginTop: spacing.xs,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: 80,
      gap: spacing.xl,
    },
    section: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    sectionHeading: {
      color: colors.textTertiary,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
    },
    trigger: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
    },
    triggerValue: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    triggerChevron: {
      color: colors.textTertiary,
      fontSize: 20,
      fontWeight: "600",
    },
  });
}
