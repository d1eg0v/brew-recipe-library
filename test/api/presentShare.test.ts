// Presentation tests for the BRE-43 share-link shape on the recipe payload.
//
// `presentRecipe` is what threads `shareToken` (DB-only) into the public
// `shareable` + `shareUrl` fields and strips the raw token from the output.

import { describe, it, expect } from "vitest";

import { presentRecipe } from "@/lib/api/present";

const baseRecipe = {
  batchSizeLiters: 20,
  fermentables: [],
  hops: [],
  yeasts: [],
  mashSteps: [],
  processSteps: [],
  additions: [],
};

describe("presentRecipe — share link shape (BRE-43)", () => {
  it("marks the recipe non-shareable and emits no URL when there is no token", () => {
    const result = presentRecipe({ ...baseRecipe, shareToken: null });
    expect(result.shareable).toBe(false);
    expect(result.shareUrl).toBeNull();
    expect((result as Record<string, unknown>).shareToken).toBeUndefined();
  });

  it("marks shareable=true and emits an absolute URL when an origin is supplied", () => {
    const result = presentRecipe(
      { ...baseRecipe, shareToken: "abc123def456" },
      { origin: "https://brew.example.com" },
    );
    expect(result.shareable).toBe(true);
    expect(result.shareUrl).toBe("https://brew.example.com/share/abc123def456");
    expect((result as Record<string, unknown>).shareToken).toBeUndefined();
  });

  it("falls back to a relative share URL when no origin is supplied", () => {
    const result = presentRecipe(
      { ...baseRecipe, shareToken: "abc123" },
    );
    expect(result.shareable).toBe(true);
    expect(result.shareUrl).toBe("/share/abc123");
  });

  it("strips the raw token even when shareable is true", () => {
    const result = presentRecipe(
      { ...baseRecipe, shareToken: "supersecret" },
      { origin: "https://brew.example.com" },
    );
    expect("shareToken" in result).toBe(false);
  });
});
