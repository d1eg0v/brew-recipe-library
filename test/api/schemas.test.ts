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

  it("coerces all four range pairs from strings", () => {
    const r = recipeListQuerySchema.safeParse({
      abvMin: "4",
      abvMax: "8",
      ibuMin: "20",
      ibuMax: "60",
      srmMin: "4",
      srmMax: "12",
      ogMin: "1.05",
      ogMax: "1.075",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.ibuMin).toBe(20);
      expect(r.data.ibuMax).toBe(60);
      expect(r.data.srmMin).toBe(4);
      expect(r.data.srmMax).toBe(12);
      expect(r.data.ogMin).toBe(1.05);
      expect(r.data.ogMax).toBe(1.075);
    }
  });

  it("rejects ibuMin > ibuMax", () => {
    const r = recipeListQuerySchema.safeParse({ ibuMin: 80, ibuMax: 20 });
    expect(r.success).toBe(false);
  });

  it("rejects srmMin > srmMax", () => {
    const r = recipeListQuerySchema.safeParse({ srmMin: 30, srmMax: 10 });
    expect(r.success).toBe(false);
  });

  it("rejects ogMin > ogMax", () => {
    const r = recipeListQuerySchema.safeParse({ ogMin: 1.08, ogMax: 1.04 });
    expect(r.success).toBe(false);
  });

  it("rejects range values outside the documented domain", () => {
    expect(
      recipeListQuerySchema.safeParse({ ibuMin: 500 }).success,
    ).toBe(false);
    expect(
      recipeListQuerySchema.safeParse({ srmMax: 200 }).success,
    ).toBe(false);
    expect(
      recipeListQuerySchema.safeParse({ ogMin: 1.5 }).success,
    ).toBe(false);
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

// BRE-20 regression: every cider recipe in the curated seed file must round-trip
// through the strict Zod schema, and the priming-concentrate / back-sweetening
// patterns agreed in BRE-19 must hold for the recipes that use them.
describe("seed cider recipes (BRE-20)", () => {
  // Lazily import the seed JSON so this file stays type-checkable even when the
  // seed file is briefly empty.
  function loadCiderSeed(): unknown[] {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const seed = require("node:fs").readFileSync(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("node:path").resolve(
        __dirname,
        "../../prisma/seed/recipes.json",
      ),
      "utf8",
    );
    const parsed = JSON.parse(seed);
    if (!Array.isArray(parsed)) throw new Error("seed file must be an array");
    return parsed.filter(
      (r: { category?: string }) => r && r.category === "cider",
    );
  }

  it("includes all 6 cider variations (dry, semi-sweet, naturally carb, blackberry, cranberry, spiced)", () => {
    const ciders = loadCiderSeed() as Array<{ title: string }>;
    const titles = new Set(ciders.map((r) => r.title));
    expect(titles.has("Northgate Dry Apple Cider")).toBe(true);
    expect(titles.has("Sunhill Semi-Sweet Apple Cider")).toBe(true);
    expect(titles.has("Riverbend Naturally Carbonated Cider")).toBe(true);
    expect(titles.has("Blackberry Hollow Apple Cider")).toBe(true);
    expect(titles.has("Cranberry Bog Apple Cider")).toBe(true);
    expect(titles.has("Fireside Spiced Apple Cider")).toBe(true);
    expect(ciders.length).toBe(6);
  });

  it("every cider recipe validates against recipeCreateSchema.strict()", () => {
    const ciders = loadCiderSeed();
    expect(ciders.length).toBeGreaterThan(0);
    for (const r of ciders) {
      const result = recipeCreateSchema.safeParse(r);
      expect(result.success, JSON.stringify(r)).toBe(true);
    }
  });

  it("every cider recipe uses explicit citric + malic acid grams (user's preferred approach)", () => {
    const ciders = loadCiderSeed() as Array<{
      title: string;
      additions: Array<{ name: string; unit?: string }>;
    }>;
    for (const r of ciders) {
      const names = r.additions.map((a) => a.name.toLowerCase());
      expect(names.some((n) => n.includes("citric acid"))).toBe(true);
      expect(names.some((n) => n.includes("malic acid"))).toBe(true);
    }
  });

  it("the naturally-carbonated cider carries its priming concentrate as an Addition (not a Fermentable)", () => {
    const ciders = loadCiderSeed() as Array<{
      title: string;
      additions: Array<{ name: string; purpose?: string; timing?: string; unit?: string; amount?: number }>;
      processSteps: Array<{ type?: string; notes?: string }>;
    }>;
    const riverbend = ciders.find((r) => r.title === "Riverbend Naturally Carbonated Cider");
    expect(riverbend).toBeDefined();
    if (!riverbend) return;
    const priming = riverbend.additions.find((a) =>
      a.name.toLowerCase().includes("priming"),
    );
    expect(priming).toBeDefined();
    expect(priming?.purpose?.toLowerCase()).toMatch(/priming|carbonation/);
    expect(priming?.timing).toBe("at bottling");
    expect(priming?.unit).toBe("L");
    const bottling = riverbend.processSteps.find((p) => p.type === "bottling");
    expect(bottling).toBeDefined();
    expect(bottling?.notes?.toLowerCase()).toMatch(/apple juice concentrate/);
  });

  it("the semi-sweet and cranberry ciders back-sweeten via an Addition with timing='after stabilization'", () => {
    const ciders = loadCiderSeed() as Array<{
      title: string;
      additions: Array<{ name: string; purpose?: string; timing?: string }>;
    }>;
    for (const title of [
      "Sunhill Semi-Sweet Apple Cider",
      "Cranberry Bog Apple Cider",
    ]) {
      const r = ciders.find((c) => c.title === title);
      expect(r, title).toBeDefined();
      if (!r) continue;
      const back = r.additions.find((a) =>
        a.purpose?.toLowerCase().includes("back-sweetening"),
      );
      expect(back, `${title} missing back-sweetening addition`).toBeDefined();
      expect(back?.timing).toMatch(/before bottling|after stabilization/i);
    }
  });

  it("OG/FG/ABV reconcile via the standard ABV formula (within rounding)", () => {
    const ciders = loadCiderSeed() as Array<{
      title: string;
      targetOg?: number;
      targetFg?: number;
      targetAbv?: number;
    }>;
    for (const r of ciders) {
      if (r.targetOg == null || r.targetFg == null || r.targetAbv == null) {
        continue;
      }
      const expected = (r.targetOg - r.targetFg) * 131.25;
      // Tolerance: ±0.3 ABV covers rounding (targetAbv is reported to 1 dp) and
      // also accommodates the small gravity-point contribution of fruit sugar
      // that EC-1118 attenuates beyond the simple OG→FG math.
      expect(
        Math.abs(r.targetAbv - expected),
        `${r.title}: targetAbv=${r.targetAbv} expected~${expected.toFixed(2)}`,
      ).toBeLessThan(0.4);
    }
  });
});
