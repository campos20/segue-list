import { useTranslation } from "@/i18n";
import { Button } from "@/ui/components/Button";
import { songImportAppUrl } from "@/ui/songLink";
import { spacing, useThemeColors, type ThemeColors } from "@/ui/theme";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.github.campos20.seguelist";

/**
 * The web import page's hand-off to the installed app, shown before the
 * "save in this browser" actions: someone who scanned the code with a
 * phone almost always wants the song in the app. A phone camera opens
 * a QR link as a web page (an https link is the only kind every camera app
 * reliably opens); this button passes the same payload to the app through
 * its `seguelist://` scheme. If the app isn't installed, the tap does
 * nothing - hence the store link right under it.
 */
export function OpenInAppLink({ payload }: { payload: string }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>{t.importLink.openInAppHint}</Text>
      <Button
        onPress={() => {
          window.location.href = songImportAppUrl(payload);
        }}
      >
        {t.importLink.openInApp}
      </Button>
      <Pressable
        accessibilityRole="link"
        onPress={() => {
          window.open(PLAY_STORE_URL, "_blank", "noopener");
        }}
        style={({ pressed }) => [styles.storeLink, pressed && styles.pressed]}
      >
        <Text style={styles.storeLinkText}>{t.importLink.getApp}</Text>
      </Pressable>
      <Text style={styles.orHere}>{t.importLink.orSaveHere}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    orHere: {
      marginTop: spacing.sm,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      color: colors.textSecondary,
      fontSize: 13,
    },
    hint: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    storeLink: {
      alignSelf: "flex-start",
      paddingVertical: spacing.xs,
    },
    storeLinkText: {
      color: colors.accent,
      fontSize: 13,
    },
    pressed: {
      opacity: 0.6,
    },
  });
}
