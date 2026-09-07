/**
 * Parses a song duration typed as "m:ss" or a bare number of seconds.
 * Returns null for a blank field (meaning "not set") or anything that
 * doesn't confidently parse as one of those two shapes - never a guess.
 */
export function parseDurationInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const minutesSeconds = trimmed.match(/^(\d+):([0-5]?\d)$/);
  if (minutesSeconds) {
    const minutes = Number(minutesSeconds[1]);
    const seconds = Number(minutesSeconds[2]);
    return minutes * 60 + seconds;
  }

  if (/^\d+$/.test(trimmed)) return Number(trimmed);

  return null;
}

/** Formats a duration in seconds as "m:ss" for display and editing. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}
