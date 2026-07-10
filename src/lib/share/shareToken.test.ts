// Unit tests for share-token generation and URL building (BRE-43).

import { describe, it, expect } from "vitest";

import {
  SHARE_TOKEN_BYTES,
  base64UrlEncode,
  buildShareUrl,
  generateShareToken,
  shareTokenLength,
} from "@/lib/share/shareToken";

/** A deterministic PRNG that returns a buffer whose i-th byte is `i + 1`. */
function deterministicRandom(size: number): Buffer {
  const out = Buffer.alloc(size);
  for (let i = 0; i < size; i++) {
    out[i] = (i + 1) & 0xff;
  }
  return out;
}

/** Reference buffer: 16 bytes 0x01..0x10 → base64url without padding. */
function referenceBuffer(): Buffer {
  return Buffer.from([
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
  ]);
}

describe("shareToken — shape", () => {
  it("encodes a reference buffer into a known URL-safe string", () => {
    expect(base64UrlEncode(referenceBuffer())).toBe("AQIDBAUGBwgJCgsMDQ4PEA");
  });

  it("strips base64 padding characters", () => {
    // 3 bytes → 4 chars normally; the third byte usually maps to "A==" or "Q=="
    expect(base64UrlEncode(Buffer.from([0x00, 0x00, 0x00]))).toBe("AAAA");
    expect(base64UrlEncode(Buffer.from([0xff, 0xff, 0xff]))).toBe("____");
    expect(base64UrlEncode(Buffer.from([0xfb, 0xff, 0xff]))).toBe("-___");
  });

  it("uses URL-safe characters only (no '+', '/' or '=')", () => {
    // Bytes chosen to provoke the encoded forms that contain + and /.
    const buf = Buffer.from([0xfb, 0xef, 0xff, 0xfe]);
    const encoded = base64UrlEncode(buf);
    expect(encoded).not.toMatch(/[+/=]/);
  });
});

describe("shareToken — length & entropy", () => {
  it("reports the canonical length for the default entropy", () => {
    expect(shareTokenLength()).toBe(22);
    expect(shareTokenLength(SHARE_TOKEN_BYTES)).toBe(22);
  });

  it("computes length as ceil(bytes/3)*4 minus padding", () => {
    // 0-mod groups: no padding.
    expect(shareTokenLength(3)).toBe(4);
    expect(shareTokenLength(6)).toBe(8);
    // 1-byte remainder: 2 chars of padding stripped.
    expect(shareTokenLength(1)).toBe(2);
    expect(shareTokenLength(4)).toBe(6);
    expect(shareTokenLength(7)).toBe(10);
    expect(shareTokenLength(16)).toBe(22);
    // 2-byte remainder: 1 char of padding stripped.
    expect(shareTokenLength(2)).toBe(3);
    expect(shareTokenLength(5)).toBe(7);
  });

  it("produces a token of the expected length with the default entropy", () => {
    const token = generateShareToken(deterministicRandom);
    expect(token.length).toBe(22);
  });

  it("rejects non-positive `bytes`", () => {
    expect(() => generateShareToken(deterministicRandom, 0)).toThrow(RangeError);
    expect(() => generateShareToken(deterministicRandom, -1)).toThrow(RangeError);
    expect(() => generateShareToken(deterministicRandom, 1.5)).toThrow(RangeError);
  });
});

describe("shareToken — randomness contract", () => {
  it("returns the base64url encoding of the supplied bytes (deterministic source)", () => {
    expect(generateShareToken(deterministicRandom)).toBe(
      base64UrlEncode(referenceBuffer()),
    );
  });

  it("emits only URL-safe characters in the produced token", () => {
    const token = generateShareToken(deterministicRandom);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rotates length for non-default byte sizes", () => {
    expect(generateShareToken(deterministicRandom, 1).length).toBe(2);
    expect(generateShareToken(deterministicRandom, 6).length).toBe(8);
  });
});

describe("buildShareUrl", () => {
  it("joins an absolute origin with the share path", () => {
    expect(buildShareUrl("abc123", "https://brew.example.com")).toBe(
      "https://brew.example.com/share/abc123",
    );
  });

  it("strips a single trailing slash from the origin to avoid double-slash joins", () => {
    expect(buildShareUrl("abc123", "https://brew.example.com/")).toBe(
      "https://brew.example.com/share/abc123",
    );
  });

  it("falls back to a relative path when the origin is missing", () => {
    expect(buildShareUrl("abc123", undefined)).toBe("/share/abc123");
    expect(buildShareUrl("abc123", null)).toBe("/share/abc123");
    expect(buildShareUrl("abc123", "")).toBe("/share/abc123");
  });

  it("rejects an empty token", () => {
    expect(() => buildShareUrl("", "https://brew.example.com")).toThrow();
  });
});
