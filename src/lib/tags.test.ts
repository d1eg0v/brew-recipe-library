// Tests for the pure tag-name normalisation helpers (BRE-29).

import { describe, it, expect } from "vitest";

import { normalizeTagName, normalizeTagNames } from "@/lib/tags";

describe("normalizeTagName", () => {
  it("trims surrounding whitespace and lowercases", () => {
    expect(normalizeTagName("  Summer  ")).toBe("summer");
  });

  it("collapses runs of internal whitespace to a single space", () => {
    expect(normalizeTagName("Session\tIPA")).toBe("session ipa");
  });

  it("returns null for empty / whitespace-only input", () => {
    expect(normalizeTagName("")).toBeNull();
    expect(normalizeTagName("   ")).toBeNull();
  });

  it("returns null for non-string input", () => {
    // @ts-expect-error intentionally wrong type for runtime check
    expect(normalizeTagName(null)).toBeNull();
    // @ts-expect-error intentionally wrong type for runtime check
    expect(normalizeTagName(undefined)).toBeNull();
  });

  it("truncates inputs longer than 50 chars", () => {
    const long = "a".repeat(80);
    const out = normalizeTagName(long);
    expect(out).not.toBeNull();
    expect((out ?? "").length).toBe(50);
  });
});

describe("normalizeTagNames", () => {
  it("dedupes case-insensitively and preserves first-seen order", () => {
    expect(normalizeTagNames(["Summer", "summer", "  Session "])).toEqual([
      "summer",
      "session",
    ]);
  });

  it("drops empty / nullish entries", () => {
    expect(
      normalizeTagNames(["", "  ", "ok", null, undefined] as unknown as string[]),
    ).toEqual(["ok"]);
  });

  it("returns [] for an undefined / empty input", () => {
    expect(normalizeTagNames(undefined)).toEqual([]);
    expect(normalizeTagNames(null)).toEqual([]);
    expect(normalizeTagNames([])).toEqual([]);
  });
});
