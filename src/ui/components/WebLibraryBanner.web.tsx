import { useTranslation } from "@/i18n";
import {
  isChangedElsewhere,
  isLibraryKey,
  markChangedElsewhere,
  onChangedElsewhere,
} from "@/storage/browserStorage";
import { Button } from "@/ui/components/Button";
import { spacing, useThemeColors, type ThemeColors } from "@/ui/theme";
import { usePathname } from "expo-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { StyleSheet, Text, View } from "react-native";

/**
 * The web build's one piece of UI the phone doesn't have, covering what's
 * different about keeping a library in a browser (see
 * storage/browserStorage.ts):
 *
 * - It can be lost. Clearing site data wipes it, and Safari deletes it
 *   outright after about a week without a visit. So a notice says where the
 *   library lives and points at the backup export, which is also how it
 *   reaches the phone. It can be dismissed for the session, and stays out
 *   of Presentation mode, where the screen belongs to the lyrics.
 * - Two tabs can edit it at once. When another tab writes, this one's
 *   store may be stale, so browserStorage starts refusing writes and this
 *   shows a warning with a Reload button. That one can't be dismissed: it's
 *   the explanation for why saving stopped working.
 *
 * It also asks the browser to treat this site's storage as persistent
 * (`navigator.storage.persist()`), which makes eviction under storage
 * pressure much less likely where the browser honors it.
 */
function useChangedElsewhere(): boolean {
  return useSyncExternalStore(onChangedElsewhere, isChangedElsewhere);
}

export function WebLibraryBanner() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pathname = usePathname();
  const changedElsewhere = useChangedElsewhere();
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  useEffect(() => {
    // The `storage` event fires only in *other* tabs of the same origin, so
    // this tab's own writes never trip it.
    function handleStorage(event: StorageEvent) {
      // `key === null` means localStorage.clear() - also a change.
      if (event.key === null || isLibraryKey(event.key)) markChangedElsewhere();
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {
      // Not granting it is the browser's call; the notice already covers it.
    });
  }, []);

  if (changedElsewhere) {
    return (
      <View style={[styles.banner, styles.warning]} accessibilityRole="alert">
        <Text style={[styles.text, styles.warningText]}>
          {t.web.changedElsewhere}
        </Text>
        <Button onPress={() => window.location.reload()}>{t.web.reload}</Button>
      </View>
    );
  }

  const isPresenting = pathname.endsWith("/present");
  if (noticeDismissed || isPresenting) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{t.web.storageNotice}</Text>
      <Button variant="secondary" onPress={() => setNoticeDismissed(true)}>
        {t.web.dismiss}
      </Button>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.panelRaised,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    warning: {
      borderBottomColor: colors.danger,
    },
    text: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 13,
    },
    warningText: {
      color: colors.textPrimary,
    },
  });
}
