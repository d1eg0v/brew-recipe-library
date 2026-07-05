// Schema validation tests.
//
// Each test exercises the boundary between "invalid input" and "the Prisma
// create payload we'd hand off". We deliberately round-trip known-good seed
// recipes through the validator to confirm the curator's output still parses.

import { describe, it, expect } from "vitest";

import {
  recipeCreateSchema,
  recipeReplaceSchema,
  recipePatchSchema,
  recipeListQuerySchema,
  recipeDetailQuerySchema,
} from "@/lib/api/schemas";

const baseRecipe = {
  title: "Test Bitter",
  category: "beer",
  styleName: "American IPA",
  bjcpCategory: "21A",
  batchSizeLiters: 20,
  boilTimeMinutes: 60,
  efficiencyPct: 75,
  targetOg: 1.06,
  targetFg: 1.012,
  targetAbv: 6.3,
  targetIbu: 60,
  targetSrm: 6,
};

describe("recipeCreateSchema", () => {
  it("accepts a minimal body", () => {
    const r = recipeCreateSchema.safeParse({
      title: "Bare IPA",
      batchSizeLiters: 20,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      // Defaults
      expect(r.data.fermentables).toEqual([]);
      expect(r.data.hops).toEqual([]);
      expect(r.data.yeasts).toEqual([]);
      expect(r.data.mashSteps).toEqual([]);
      expect(r.data.processSteps).toEqual([]);
      expect(r.data.additions).toEqual([]);
    }
  });

  it("rejects a body with no title", () => {
    const r = recipeCreateSchema.safeParse({ batchSizeLiters: 20 });
    expect(r.success).toBe(false);
  });

  it("rejects a body with non-positive batch size", () => {
    const r = recipeCreateSchema.safeParse({ title: "x", batchSizeLiters: -1 });
    expect(r.success).toBe(false);
  });

  it("rejects targetOg less than targetFg (gravity inversion)", () => {
    const r = recipeCreateSchema.safeParse({
      title: "Backward",
      batchSizeLiters: 20,
      targetOg: 1.012,
      targetFg: 1.06,
    });
    expect(r.success).toBe(false);
  });

  it("accepts a complete recipe and exposes ingredient arrays", () => {
    const r = recipeCreateSchema.safeParse({
      ...baseRecipe,
      fermentables: [
        {
          name: "Pale 2-Row",
          type: "grain",
          amountKg: 5.0,
          colorLovibond: 2,
          potentialPpg: 37,
        },
      ],
      hops: [
        {
          name: "Cascade",
          amountGrams: 25,
          alphaAcidPct: 6,
          timeMinutes: 60,
          use: "boil",
          form: "pellet",
        },
      ],
      yeasts: [
        {
          name: "US-05",
          type: "ale",
          form: "dry",
          attenuationPct: 81,
        },
      ],
      mashSteps: [
        {
          name: "Sacc rest",
          type: "infusion",
          stepTempC: 66,
          stepTimeMinutes: 60,
        },
      ],
      additions: [
        { name: "Irish moss", amount: 1, unit: "tsp", timing: "at 15 min" },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.fermentables).toHaveLength(1);
      expect(r.data.hops).toHaveLength(1);
      expect(r.data.yeasts).toHaveLength(1);
      expect(r.data.mashSteps).toHaveLength(1);
      expect(r.data.additions).toHaveLength(1);
    }
  });

  it("rejects a fermentable with neither amountKg nor amountLiters", () => {
    const r = recipeCreateSchema.safeParse({
      title: "Bad Ferm",
      batchSizeLiters: 20,
      fermentables: [{ name: "Mystery", type: "grain" }],
    });
    expect(r.success).toBe(false);
  });

  it("accepts a liquid fermentable (honey, juice)", () => {
    const r = recipeCreateSchema.safeParse({
      title: "Concord Pantry kit wine",
      category: "wine",
      batchSizeLiters: 4,
      fermentables: [
        { name: "Concord grape juice", type: "juice", amountLiters: 3.8 },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects fermentable type outside the enum", () => {
    const r = recipeCreateSchema.safeParse({
      title: "Wrong type",
      batchSizeLiters: 20,
      fermentables: [
        { name: "X", type: "wonder_ingredient", amountKg: 1 },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown root keys (strict mode)", () => {
    const r = recipeCreateSchema.safeParse({
      ...baseRecipe,
      mysteryField: 42,
    });
    expect(r.success).toBe(false);
  });

  it("rejects the same strictness on PUT (replace)", () => {
    const r = recipeReplaceSchema.safeParse({
      ...baseRecipe,
      mystery: 1,
    });
    expect(r.success).toBe(false);
  });
});

describe("recipePatchSchema", () => {
  it("accepts an empty patch object", () => {
    const r = recipePatchSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("accepts a partial update", () => {
    const r = recipePatchSchema.safeParse({ title: "Renamed", targetAbv: 7.2 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.title).toBe("Renamed");
    }
  });
});

describe("recipeListQuerySchema", () => {
  it("coerces numeric query params", () => {
    const r = recipeListQuerySchema.safeParse({
      abvMin: "4",
      abvMax: "8",
      limit: "10",
      offset: "20",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.abvMin).toBe(4);
      expect(r.data.abvMax).toBe(8);
      expect(r.data.limit).toBe(10);
      expect(r.data.offset).toBe(20);
    }
  });

  it("rejects abvMin > abvMax", () => {
    const r = recipeListQuerySchema.safeParse({ abvMin: 10, abvMax: 5 });
    expect(r.success).toBe(false);
  });

  it("rejects unknown category", () => {
    const r = recipeListQuerySchema.safeParse({ category: "whiskey" });
    expect(r.success).toBe(false);
  });

  it("clamps limit implicitly via zod bounds", () => {
    const tooLarge = recipeListQuerySchema.safeParse({ limit: 500 });
    expect(tooLarge.success).toBe(false);
    const tooSmall = recipeListQuerySchema.safeParse({ limit: 0 });
    expect(tooSmall.success).toBe(false);
  });
});

describe("recipeDetailQuerySchema", () => {
  it("accepts a numeric batchSize", () => {
    const r = recipeDetailQuerySchema.safeParse({ batchSize: "10.5" });
    expect(r.success).toBe(true);
  });

  it("rejects negative batchSize", () => {
    const r = recipeDetailQuerySchema.safeParse({ batchSize: "-5" });
    expect(r.success).toBe(false);
  });

  it("rejects unknown units", () => {
    const r = recipeDetailQuerySchema.safeParse({ units: "kelvin" });
    expect(r.success).toBe(false);
  });
});
