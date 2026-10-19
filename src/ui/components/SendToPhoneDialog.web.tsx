import { useTranslation } from "@/i18n";
import type { SongManifest } from "@/types/song";
import { Button } from "@/ui/components/Button";
import {
  encodeSongLink,
  MAX_QR_PAYLOAD_LENGTH,
  songImportWebUrl,
} from "@/ui/songLink";
import { radii, spacing, useThemeColors, type ThemeColors } from "@/ui/theme";
import Constants from "expo-constants";
import createQrCode from "qrcode-generator";
import { useMemo } from "react";
import { Image, Modal, StyleSheet, Text, View } from "react-native";

/**
 * The site's own address (origin + Pages subpath from app.config.js's
 * `experiments.baseUrl`), so a QR made on the deployed site points at the
 * deployed site, and one made on `npm run web` points at localhost.
 */
function siteBaseUrl(): string {
  const baseUrl =
    (Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)
      ?.baseUrl ?? "";
  return `${window.location.origin}${baseUrl}`;
}

/**
 * The QR code as an SVG data URL. qrcode-generator only computes the
 * matrix and serializes it; rendering it as an <img> keeps it out of the
 * DOM as markup. Error correction "L" (the lowest) keeps the code as sparse
 * as possible for the payload - it's read off a clean screen, not a printed
 * page that might get scuffed.
 */
function qrDataUrl(text: string): string {
  const qr = createQrCode(0, "L");
  qr.addData(text, "Byte");
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const SEND_TO_PHONE_SUPPORTED = true;

/**
 * "Send to phone (QR code)" from a song's menu in the Library: shows the
 * song as a QR code that any phone camera can open - see ui/songLink.ts for
 * the link and ImportSongScreen for the other end. Open while `song` is set.
 * The Library only ever holds saved songs, so what arrives on the phone is
 * exactly what's in this library.
 */
export function SendToPhoneDialog({
  song,
  onClose,
}: {
  song: SongManifest | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Built only while the dialog is open (a QR for a long song takes a
  // moment), and again if the song changes.
  const qr = useMemo(() => {
    if (!song) return null;
    const payload = encodeSongLink(song);
    if (payload.length > MAX_QR_PAYLOAD_LENGTH) {
      return { tooLong: true as const };
    }
    const url = songImportWebUrl(siteBaseUrl(), payload);
    return { tooLong: false as const, url, image: qrDataUrl(url) };
  }, [song]);

  return (
    <Modal
      visible={song !== null}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{t.sendToPhone.title}</Text>
          <Text style={styles.songName}>{song?.name}</Text>
          {qr?.tooLong ? (
            <Text style={styles.warning}>{t.sendToPhone.tooLong}</Text>
          ) : qr ? (
            <>
              <View style={styles.codeFrame}>
                <Image
                  source={{ uri: qr.image }}
                  style={styles.code}
                  accessibilityLabel={qr.url}
                  testID="send-to-phone-qr"
                />
              </View>
              <Text style={styles.hint}>{t.sendToPhone.hint}</Text>
            </>
          ) : null}
          <Button variant="secondary" onPress={onClose}>
            {t.sendToPhone.close}
          </Button>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    dialog: {
      width: "100%",
      maxWidth: 420,
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radii.lg,
      backgroundColor: colors.panelRaised,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    songName: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    // Always black on white, whatever the theme: phone cameras read a QR
    // code best (some only) as dark modules on a light background.
    codeFrame: {
      alignSelf: "center",
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: "#ffffff",
    },
    code: {
      width: 280,
      height: 280,
    },
    hint: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    warning: {
      color: colors.danger,
      fontSize: 13,
    },
  });
}
