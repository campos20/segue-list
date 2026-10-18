import type { ConfirmDestructiveOptions } from "./dialogs";

/**
 * The browser's counterpart to dialogs.ts. react-native-web's
 * `Alert.alert` is a no-op, so a delete or a "Discard changes?" there would
 * silently never happen; the browser's own blocking `confirm`/`alert`
 * dialogs are plain, but they're synchronous and impossible to miss.
 * `confirm` only has OK/Cancel buttons, so every title/message passed here
 * is worded so that OK is unambiguous ("Delete song" / "Delete X?").
 */

export type { ConfirmDestructiveOptions } from "./dialogs";

export function confirmDestructive({
  title,
  message,
  onConfirm,
}: ConfirmDestructiveOptions): void {
  if (window.confirm(`${title}\n\n${message}`)) {
    onConfirm();
  }
}

export function showMessage(title: string, message: string): void {
  window.alert(`${title}\n\n${message}`);
}
