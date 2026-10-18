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

/**
 * The raw value this tab last read or wrote at each key (null: saw it
 * absent). The `storage` event alone can't protect a write: it reaches this
 * tab asynchronously, so if another tab saves the same song a moment before
 * this one does, this tab would still write its stale copy over the other
 * tab's edit before ever hearing about it. So every write first checks
 * that the key still holds what this tab last saw (see assertUnchanged).
 *
 * A key this tab never read or wrote isn't in here; it's only expected to be
 * absent (a brand-new song or setlist id).
 */
const lastSeen = new Map<string, string | null>();

function readRaw(store: Storage, key: string): string | null {
  const raw = store.getItem(key);
  lastSeen.set(key, raw);
  return raw;
}

/**
 * Refuses a write when another tab changed `key` since this tab last saw
 * it - and marks the library as changed elsewhere right away, so the reload
 * banner shows without waiting for the `storage` event.
 *
 * localStorage has no cross-tab transaction, so this narrows the window to
 * the instant between this check and the write rather than closing it
 * outright; the `storage` event still catches anything that slips through
 * for every later write.
 */
function assertUnchanged(store: Storage, key: string): void {
  if (changedElsewhere) throw new LibraryChangedElsewhereError();
  const expected = lastSeen.has(key) ? lastSeen.get(key) : null;
  if (store.getItem(key) !== expected) {
    markChangedElsewhere();
    throw new LibraryChangedElsewhereError();
  }
}

/** Parsed JSON at `key`, or null when it's missing or unreadable. */
export function readJson(key: string): unknown {
  try {
    const store = storage();
    const raw = store ? readRaw(store, key) : null;
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
  assertUnchanged(store, key);
  const raw = JSON.stringify(value);
  store.setItem(key, raw);
  lastSeen.set(key, raw);
}

export function removeKey(key: string): void {
  if (changedElsewhere) throw new LibraryChangedElsewhereError();
  const store = storage();
  if (!store) throw new Error("This browser isn't allowing the app to save.");
  assertUnchanged(store, key);
  store.removeItem(key);
  lastSeen.set(key, null);
}
