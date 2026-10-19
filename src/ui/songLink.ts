import { deflateSync, Inflate, strFromU8, strToU8 } from "fflate";
import { generateId } from "@/storage/ids";
import { isSafeId } from "@/storage/manifests";
import type { SongManifest } from "@/types/song";
import { sanitizeLyricsHtml } from "@/ui/lyricsColor";

/**
 * One song packed into a short, URL-safe string, for moving it between
 * devices by QR code: the web version shows a QR for
 * `<site>/import#<payload>`, any phone camera opens that page, and the page
 * hands the same payload to the app as `seguelist://import?d=<payload>`.
 *
 * The payload is compact JSON of just the fields a song needs, deflated
 * (fflate, already used for .docx) and base64url-encoded. It travels in the
 * URL fragment on the web, so it's never sent to the server.
 *
 * Decoding treats the payload as untrusted - anyone can make a link:
 * sizes are capped before and after inflating, every field is type-checked,
 * lyrics go through the same sanitizer as everything else that reaches the
 * editor, and an id is only kept when it has the app's own id shape (it
 * becomes a file name - see isSafeId).
 */

export const SONG_LINK_VERSION = 1;

/**
 * The longest payload worth putting in a QR code. A QR tops out near 3 KB,
 * but the denser it gets the harder it is to scan off a laptop screen; this
 * keeps it to a code a phone camera reads quickly. A typical song (a few KB
 * of lyrics and chords) compresses to well under it.
 */
export const MAX_QR_PAYLOAD_LENGTH = 2000;

// Generous limits for what a link may carry - far above any real song -
// so a hostile one can't make the app inflate or store something huge.
const MAX_ACCEPTED_PAYLOAD_LENGTH = 16_000;
const MAX_INFLATED_BYTES = 256_000;
const MAX_NAME_LENGTH = 300;
const MAX_TAGS = 50;
const MAX_TAG_LENGTH = 100;

/** Why a link was rejected - a code rather than text, so the screen can show it in the user's language. */
export type SongLinkErrorReason = "invalid" | "newerVersion";

export class SongLinkError extends Error {
  constructor(readonly reason: SongLinkErrorReason) {
    super(
      reason === "newerVersion"
        ? "This song was shared from a newer version of the app."
        : "This isn't a valid Segue List song link.",
    );
  }
}

/** The wire format - short keys, since every byte makes the QR code denser. */
interface SongLinkPayload {
  v: number;
  i: string;
  n: string;
  l: string | null;
  c?: string | null;
  d?: number | null;
  t?: number;
  g?: string[];
  a: string;
  u: string;
}

const BASE64URL =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// Hand-rolled rather than btoa/atob: those work on "binary strings", not
// bytes, and aren't guaranteed in every JS engine the app runs on.
function bytesToBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const chunk =
      (bytes[index] << 16) |
      ((bytes[index + 1] ?? 0) << 8) |
      (bytes[index + 2] ?? 0);
    out += BASE64URL[(chunk >> 18) & 63] + BASE64URL[(chunk >> 12) & 63];
    if (index + 1 < bytes.length) out += BASE64URL[(chunk >> 6) & 63];
    if (index + 2 < bytes.length) out += BASE64URL[chunk & 63];
  }
  return out;
}

function base64UrlToBytes(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) {
    throw new SongLinkError("invalid");
  }
  const bytes = new Uint8Array(Math.floor((text.length * 3) / 4));
  let byteIndex = 0;
  for (let index = 0; index < text.length; index += 4) {
    const values = [0, 1, 2, 3].map((offset) =>
      index + offset < text.length
        ? BASE64URL.indexOf(text[index + offset])
        : 0,
    );
    const chunk =
      (values[0] << 18) | (values[1] << 12) | (values[2] << 6) | values[3];
    bytes[byteIndex++] = (chunk >> 16) & 255;
    if (index + 2 < text.length) bytes[byteIndex++] = (chunk >> 8) & 255;
    if (index + 3 < text.length) bytes[byteIndex++] = chunk & 255;
  }
  return bytes;
}

// Compressed input is fed to the decoder this many bytes at a time. Deflate
// expands at most ~1032:1, so one slice can yield at most ~132 KB before the
// size check below gets to run.
const INFLATE_INPUT_SLICE = 128;

/**
 * Inflates `data`, refusing as soon as the output passes `maxBytes` - before
 * the rest is decompressed, not after. A link is untrusted, and deflate can
 * turn a few KB into many MB: inflating it all first and checking the size
 * afterwards (inflateSync) would already have made that allocation, enough
 * to stall or crash a phone. Fed in small slices to fflate's streaming
 * Inflate, which hands each piece of output to the callback and keeps only
 * a 32 KB window, peak memory stays near `maxBytes` + one slice's output.
 *
 * Throws SongLinkError when the limit is hit; a corrupt stream throws
 * whatever fflate throws. Exported for its tests.
 */
export function inflateWithLimit(
  data: Uint8Array,
  maxBytes: number,
): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  let finished = false;
  const inflater = new Inflate((chunk, final) => {
    total += chunk.length;
    // Thrown inside the callback, so it aborts the push that produced it.
    if (total > maxBytes) throw new SongLinkError("invalid");
    chunks.push(chunk);
    if (final) finished = true;
  });
  for (let offset = 0; offset < data.length; offset += INFLATE_INPUT_SLICE) {
    const end = Math.min(offset + INFLATE_INPUT_SLICE, data.length);
    inflater.push(data.subarray(offset, end), end === data.length);
  }
  if (!finished) throw new SongLinkError("invalid");

  const out = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) {
    out.set(chunk, position);
    position += chunk.length;
  }
  return out;
}

/** `song` as a link payload. Lyrics keep their color markup - it's the app's own format at both ends. */
export function encodeSongLink(song: SongManifest): string {
  const payload: SongLinkPayload = {
    v: SONG_LINK_VERSION,
    i: song.id,
    n: song.name,
    l: song.lyrics,
    a: song.createdAt,
    u: song.updatedAt,
  };
  if (song.chords) payload.c = song.chords;
  if (song.durationSeconds) payload.d = song.durationSeconds;
  if (song.transposeSteps) payload.t = song.transposeSteps;
  if (song.tags && song.tags.length > 0) payload.g = song.tags;
  return bytesToBase64Url(
    deflateSync(strToU8(JSON.stringify(payload)), { level: 9 }),
  );
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function invalid(): never {
  throw new SongLinkError("invalid");
}

/**
 * The song a link payload carries, validated. Throws SongLinkError for
 * anything that isn't a well-formed song from this app, including a link
 * made by a newer version of it.
 */
export function decodeSongLink(text: string): SongManifest {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_ACCEPTED_PAYLOAD_LENGTH) {
    invalid();
  }

  let json: unknown;
  try {
    const inflated = inflateWithLimit(
      base64UrlToBytes(trimmed),
      MAX_INFLATED_BYTES,
    );
    json = JSON.parse(strFromU8(inflated));
  } catch (error) {
    if (error instanceof SongLinkError) throw error;
    invalid();
  }

  const payload = json as Partial<SongLinkPayload> | null;
  if (typeof payload !== "object" || payload === null) invalid();
  if (typeof payload.v === "number" && payload.v > SONG_LINK_VERSION) {
    throw new SongLinkError("newerVersion");
  }
  if (payload.v !== SONG_LINK_VERSION) invalid();

  const name = typeof payload.n === "string" ? payload.n.trim() : "";
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) invalid();
  if (payload.l !== null && typeof payload.l !== "string") invalid();
  if (payload.c != null && typeof payload.c !== "string") invalid();
  if (!isIsoDate(payload.a) || !isIsoDate(payload.u)) invalid();

  const duration =
    typeof payload.d === "number" && Number.isFinite(payload.d) && payload.d > 0
      ? Math.round(payload.d)
      : null;
  const transpose =
    typeof payload.t === "number" &&
    Number.isInteger(payload.t) &&
    Math.abs(payload.t) <= 24
      ? payload.t
      : 0;
  const tags = Array.isArray(payload.g)
    ? payload.g
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim().slice(0, MAX_TAG_LENGTH))
        .filter((tag) => tag.length > 0)
        .slice(0, MAX_TAGS)
    : [];

  return {
    // Kept when it's one of the app's own ids, so the phone and the web end
    // up with the same song (and later backups merge it instead of
    // duplicating it). Anything else gets a fresh id.
    id: isSafeId(payload.i) ? payload.i : generateId(name),
    name,
    lyrics: payload.l ? sanitizeLyricsHtml(payload.l) : null,
    chords: payload.c || null,
    transposeSteps: transpose,
    tags,
    ...(duration ? { durationSeconds: duration } : {}),
    createdAt: payload.a,
    updatedAt: payload.u,
  };
}

/** The web page a phone camera opens - the payload rides in the fragment, which browsers never send to the server. */
export function songImportWebUrl(siteBaseUrl: string, payload: string): string {
  return `${siteBaseUrl.replace(/\/+$/, "")}/import#${payload}`;
}

/** The same import, handed to the installed app through its `seguelist://` scheme (app.json `scheme`). */
export function songImportAppUrl(payload: string): string {
  return `seguelist://import?d=${payload}`;
}
