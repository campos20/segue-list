import { Alert } from "react-native";

/**
 * The app's confirmation and message dialogs. On iOS/Android this is
 * exactly the `Alert.alert` call each screen used to make inline.
 *
 * It's its own module because `Alert.alert` is a documented no-op in
 * react-native-web: dialogs.web.ts provides the same exports through the
 * browser's own `window.confirm`/`window.alert`, so a delete or a "Discard
 * changes?" works there too instead of silently doing nothing. Metro picks
 * one file per platform - nothing in the web file ships to a phone.
 */

export interface ConfirmDestructiveOptions {
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
}

/** Cancel/confirm dialog where confirming is the destructive choice. Cancelling (or dismissing) does nothing. */
export function confirmDestructive({
  title,
  message,
  cancelLabel,
  confirmLabel,
  onConfirm,
}: ConfirmDestructiveOptions): void {
  Alert.alert(title, message, [
    { text: cancelLabel, style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}

/** A message with a single dismiss button. */
export function showMessage(title: string, message: string): void {
  Alert.alert(title, message);
}
