/**
 * The web build's equivalent of the phone's documents directory: every
 * song, setlist and the settings live in `localStorage`, one JSON value per
 * key. Only ever imported by the `*.web.ts` storage files, so none of this
 * ships to iOS/Android.
 *
 * Why `localStorage` and not IndexedDB: the storage API the rest of the app
 * is written against is synchronous (`writeSong`, `readAppSettings`, ...),
 * and so is `localStorage`. That keeps the AGENTS.md contract intact without
 * touching any shared code - a write either lands before the store hears
 * about it or throws (`QuotaExceededError` when the browser is out of
 * space), in which case the persist* thunks never dispatch. A library is
 * text; the ~5 MB per-origin budget is thousands of songs.
 *
 * Keys are prefixed because GitHub Pages serves every project page of an
 * account from the same origin (`<user>.github.io`), which therefore all
 * share one `localStorage`. The `v1` leaves room for a future layout change
 * without guessing what an old key means.
 */
const PREFIX = "segue-list:v1:";

export const SONG_KEY_PREFIX = `${PREFIX}song:`;
export const SETLIST_KEY_PREFIX = `${PREFIX}setlist:`;
export const SETTINGS_KEY = `${PREFIX}settings`;

/** True when a key belongs to this app's library (song, setlist or settings). */
export function isLibraryKey(key: string | null): boolean {
  return key !== null && key.startsWith(PREFIX);
}

export class LibraryChangedElsewhereError extends Error {
  constructor() {
    super(
      "This library was changed in another tab. Reload the page before making more changes.",
    );
  }
}

/**
 * Set once another tab writes to the library (see markChangedElsewhere).
 * From then on, this tab's Redux store - a cache of what was in storage at
 * load time - may be stale, and saving from it could silently overwrite the
 * other tab's newer edit with an older copy. So every write is refused until
 * a reload re-reads storage; refusing is safe, because the persist* thunks
 * then leave the store untouched exactly as for any other failed write.
 */
let changedElsewhere = false;
const changedElsewhereListeners = new Set<() => void>();

export function markChangedElsewhere(): void {
  if (changedElsewhere) return;
  changedElsewhere = true;
  for (const listener of changedElsewhereListeners) listener();
}

export function isChangedElsewhere(): boolean {
  return changedElsewhere;
}

export function onChangedElsewhere(listener: () => void): () => void {
  changedElsewhereListeners.add(listener);
  return () => changedElsewhereListeners.delete(listener);
}

/**
 * `localStorage` itself, or null when the browser won't give us one (some
 * privacy modes throw on mere access). Reads then come back empty rather
 * than crashing at boot, and writes throw, so nothing appears saved.
 */
function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Parsed JSON at `key`, or null when it's missing or unreadable. */
export function readJson(key: string): unknown {
  try {
    const raw = storage()?.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Every value whose key starts with `prefix`, parsed; unreadable ones are skipped. */
export function readAllJson(prefix: string): unknown[] {
  const store = storage();
  if (!store) return [];
  const values: unknown[] = [];
  for (let index = 0; index < store.length; index++) {
    const key = store.key(index);
    if (key === null || !key.startsWith(prefix)) continue;
    const value = readJson(key);
    if (value !== null) values.push(value);
  }
  return values;
}

/** Throws (never swallows) so a failed write can't look like a saved one. */
export function writeJson(key: string, value: unknown): void {
  if (changedElsewhere) throw new LibraryChangedElsewhereError();
  const store = storage();
  if (!store) throw new Error("This browser isn't allowing the app to save.");
  store.setItem(key, JSON.stringify(value));
}

export function removeKey(key: string): void {
  if (changedElsewhere) throw new LibraryChangedElsewhereError();
  const store = storage();
  if (!store) throw new Error("This browser isn't allowing the app to save.");
  store.removeItem(key);
}
