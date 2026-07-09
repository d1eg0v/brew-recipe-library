// BRE-43 — share-link token generation.
//
// A share token is an opaque, URL-safe string of ~22 characters derived from
// 16 bytes of CSPRNG output (128 bits of entropy). That length is short enough
// to read in a URL without truncation risk and long enough that brute-forcing
// one of the (recipe, token) pairs is infeasible.

import { randomBytes } from "node:crypto";

/** Number of raw random bytes mixed into a token. 16 bytes → 128 bits. */
export const SHARE_TOKEN_BYTES = 16;

/** Returns the unpadded base64url length for `bytes` of raw random input.
 *  Base64 encodes 3 bytes → 4 chars; an incomplete last group has 1 or 2
 *  padding chars that we strip. Equivalent to `ceil(bytes/3)*4 - padding`,
 *  where padding is `bytes % 3 == 1 ? 2 : bytes % 3 == 2 ? 1 : 0`. */
export function shareTokenLength(bytes: number = SHARE_TOKEN_BYTES): number {
  const remainder = bytes % 3;
  const padding = remainder === 1 ? 2 : remainder === 2 ? 1 : 0;
  return Math.ceil(bytes / 3) * 4 - padding;
}

/**
 * Encode a Buffer of bytes as a URL-safe base64 string with `=` padding
 * stripped. Pure; depends only on the input — easy to unit test.
 *
 * Visible for testing so reference encodings can be pinned.
 */
export function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/** Source of randomness — accepts a function compatible with
 *  `crypto.randomBytes`. Tests inject a deterministic source. */
export type RandomBytes = (size: number) => Buffer;

const defaultRandom: RandomBytes = (size) => randomBytes(size);

/**
 * Generate a fresh share token. Default source is `node:crypto.randomBytes`;
 * tests inject a deterministic source via the second argument.
 *
 * Returns a lowercase, URL-safe string of `shareTokenLength()` characters.
 */
export function generateShareToken(
  random: RandomBytes = defaultRandom,
  bytes: number = SHARE_TOKEN_BYTES,
): string {
  if (!Number.isInteger(bytes) || bytes <= 0) {
    throw new RangeError("bytes must be a positive integer");
  }
  return base64UrlEncode(random(bytes));
}

/**
 * The URL-shape used to share a recipe. Pure: takes a token and an origin
 * (e.g. "https://brew.example.com") and returns the absolute share URL.
 *
 * Origin stripping rules: a falsy or non-string origin falls back to "" so the
 * caller can still construct a relative path (`/share/<token>`). A non-empty
 * origin is normalised to remove a single trailing slash so we never emit
 * double slashes in the join.
 */
export function buildShareUrl(token: string, origin: string | null | undefined): string {
  if (!token) {
    throw new Error("share token is required");
  }
  if (typeof origin !== "string" || origin.length === 0) {
    return `/share/${token}`;
  }
  const base = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  return `${base}/share/${token}`;
}
