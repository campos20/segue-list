/**
 * Used whenever a song has no duration entered - Presentation mode falls
 * back to this so auto-scroll is always available instead of needing a
 * duration set first. Three minutes is a reasonable guess for a song no one
 * has timed yet; the scroll speed self-corrects moment to moment against
 * whatever's actually still on screen (see PresentationScreen's auto-scroll
 * effect), so a wrong guess just means the wrong pace, not a broken feature.
 */
export const DEFAULT_DURATION_SECONDS = 180;

/**
 * The duration field takes plain digits, no typed colon - the last two
 * digits typed are always seconds, anything before them is minutes. This
 * formats a raw digit string (as typed, digits only) for display: "3" stays
 * "3" (3s), "30" stays "30" (30s), "300" becomes "3:00" - the colon is
 * positioned automatically once there's a minutes part to show. A seconds
 * part of 60 or more (e.g. "160") is carried into minutes so the result is
 * always a valid mm:ss - never a display like "1:60".
 */
export function formatDurationDigits(digits: string): string {
  if (digits.length <= 2) return digits;
  const rawMinutes = Number(digits.slice(0, -2));
  const rawSeconds = Number(digits.slice(-2));
  const minutes = rawMinutes + Math.floor(rawSeconds / 60);
  const seconds = rawSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Parses the raw digits typed into the duration field into a total number of
 * seconds, using the same last-two-digits-are-seconds rule as
 * formatDurationDigits. Returns null for an empty field, meaning "not set".
 */
export function parseDurationDigits(digits: string): number | null {
  if (!digits) return null;
  if (digits.length <= 2) return Number(digits);
  const minutes = Number(digits.slice(0, -2));
  const seconds = Number(digits.slice(-2));
  return minutes * 60 + seconds;
}

/**
 * The inverse of parseDurationDigits - turns a stored duration back into the
 * raw digit string the field would show, so re-opening a song with a saved
 * duration re-populates the field in the same "300" → "3:00" shape it was
 * (probably) entered in.
 */
export function digitsFromDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return String(remainder);
  return `${minutes}${String(remainder).padStart(2, "0")}`;
}
