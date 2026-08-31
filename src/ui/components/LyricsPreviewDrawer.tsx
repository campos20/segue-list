import { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "@/i18n";
import { useAppSelector } from "@/store/hooks";
import { parseLyricsColors } from "@/ui/lyricsColor";
import {
  elevation,
  radii,
  spacing,
  useThemeColors,
  type ThemeColors,
} from "@/ui/theme";

const DRAWER_WIDTH = Math.min(360, Dimensions.get("window").width * 0.86);
const SLIDE_IN_MS = 220;

const LYRICS_FONT_FAMILY = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

interface LyricsPreviewDrawerProps {
  visible: boolean;
  lyrics: string;
  onClose: () => void;
}

/**
 * A read-only "what this looks like on stage" view of the lyrics, opened on
 * demand from the edge tab rather than shown inline. An inline WYSIWYG
 * overlay (styled text rendered directly in the editable field) was tried
 * first and turned out hard to read - dimmed {{ }} markers sitting inline
 * with the lyrics cluttered the editor - so the plain editor stays plain,
 * and this is the only place the bold/highlighted rendering shows.
 */
export function LyricsPreviewDrawer({
  visible,
  lyrics,
  onClose,
}: LyricsPreviewDrawerProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Same preference presentation mode uses (the "AA" toggle) - a preview of
  // the stage view should honor it too, not just the raw lyrics text.
  const allCaps = useAppSelector((state) => state.settings.presentationAllCaps);
  // Not useRef: reading `.current` during render trips this project's
  // react-hooks/refs rule. useState's lazy initializer gives the same
  // effect - a single stable Animated.Value instance, mutated in place by
  // Animated.timing rather than replaced - without a render-time ref read.
  const [translateX] = useState(() => new Animated.Value(DRAWER_WIDTH));

  // Slides in from off-screen-right each time it opens. Closing relies on
  // the Modal's own fade rather than animating this back out first: RN's
  // `visible` prop unmounts the Modal immediately, with no way to delay
  // that for a matching slide-out, so fade is the reliable way to close.
  useEffect(() => {
    if (visible) {
      translateX.setValue(DRAWER_WIDTH);
      Animated.timing(translateX, {
        toValue: 0,
        duration: SLIDE_IN_MS,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateX]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t.common.cancel}
        />
        <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{t.song.lyricsPreviewLabel}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel={t.common.cancel}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {lyrics ? (
              <Text
                style={[styles.lyricsText, allCaps && styles.lyricsUppercase]}
              >
                {parseLyricsColors(lyrics).map((segment, index) =>
                  segment.span ? (
                    <Text
                      key={index}
                      style={{
                        ...(segment.span.background && {
                          backgroundColor: `#${segment.span.background}`,
                        }),
                        ...(segment.span.color && {
                          color: `#${segment.span.color}`,
                        }),
                      }}
                    >
                      {segment.text}
                    </Text>
                  ) : (
                    segment.text
                  ),
                )}
              </Text>
            ) : (
              <Text style={styles.empty}>{t.song.lyricsPlaceholder}</Text>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    drawer: {
      width: DRAWER_WIDTH,
      height: "100%",
      backgroundColor: colors.background,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.border,
      ...elevation,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "800",
    },
    closeButton: {
      width: 28,
      height: 28,
      borderRadius: radii.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.borderLight,
    },
    closeButtonText: {
      color: colors.textSecondary,
      fontSize: 18,
      lineHeight: 20,
    },
    pressed: {
      opacity: 0.7,
    },
    content: {
      padding: spacing.lg,
    },
    lyricsText: {
      color: colors.textPrimary,
      fontSize: 16,
      lineHeight: 25,
      fontFamily: LYRICS_FONT_FAMILY,
    },
    lyricsUppercase: {
      textTransform: "uppercase",
    },
    empty: {
      color: colors.textTertiary,
      fontSize: 14,
    },
  });
}
