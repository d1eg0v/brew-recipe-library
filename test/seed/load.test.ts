// Seed loader tests — verify the JSON parsing + normalization against a
// representative subset of recipes (the full seed is large and identical to
// what a separate integration test consumes directly).

import { describe, it, expect } from "vitest";

import {
  loadSeedRecipes,
  loadSeedRecipesFromJsonText,
  isSeedRecipe,
  normalizeSeedRecipe,
} from "@/lib/seed/load";

describe("isSeedRecipe", () => {
  it("returns true for objects with a non-empty string title", () => {
    expect(isSeedRecipe({ title: "IPA", batchSizeLiters: 20 })).toBe(true);
  });

  it("returns false for missing or blank titles", () => {
    expect(isSeedRecipe({ title: "" })).toBe(false);
    expect(isSeedRecipe({ title: "   " })).toBe(false);
    expect(isSeedRecipe({})).toBe(false);
    expect(isSeedRecipe(null)).toBe(false);
  });
});

describe("loadSeedRecipes", () => {
  it("throws when root is not an array", () => {
    expect(() => loadSeedRecipes({})).toThrow(/array/);
  });

  it("throws when an entry lacks a title", () => {
    expect(() => loadSeedRecipes([{ batchSizeLiters: 1 }])).toThrow(/title/);
  });

  it("keeps well-formed entries and strips ids", () => {
    const out = loadSeedRecipes([
      {
        id: "should-vanish",
        title: "Test IPA",
        category: "beer",
        batchSizeLiters: 20,
        hops: [{ id: "h1", name: "Cascade", amountGrams: 20, timeMinutes: 60 }],
      },
    ]);
    expect(out).toHaveLength(1);
    expect((out[0] as unknown as { id?: unknown }).id).toBeUndefined();
    expect((out[0].hops![0] as unknown as { id?: unknown }).id).toBeUndefined();
  });
});

describe("loadSeedRecipesFromJsonText", () => {
  it("parses JSON text and returns recipes", () => {
    const text = JSON.stringify([
      { title: "Pale Ale", batchSizeLiters: 19 },
    ]);
    const out = loadSeedRecipesFromJsonText(text);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Pale Ale");
  });

  it("propagates JSON parse errors", () => {
    expect(() => loadSeedRecipesFromJsonText("not json")).toThrow();
  });
});

describe("normalizeSeedRecipe", () => {
  it("returns the same object after stripping ids", () => {
    const out = normalizeSeedRecipe({
      id: "db-id",
      title: "Test",
      batchSizeLiters: 20,
    });
    expect((out as unknown as { id?: unknown }).id).toBeUndefined();
    expect(out.title).toBe("Test");
  });
});
