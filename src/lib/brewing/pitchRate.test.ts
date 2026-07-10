import { describe, expect, it } from "vitest";

import {
  ALE_PITCH_RATE,
  computePitchRate,
  DAILY_VIABILITY_LOSS,
  DRY_CELLS_PER_PACK,
  LAGER_PITCH_RATE,
  LIQUID_CELLS_PER_PACK,
  MIN_VIABILITY,
} from "./pitchRate";

describe("gravityToPlato conversion (implied via computePitchRate)", () => {
  // °P = -463.37 + 668.72 × SG − 205.35 × SG²
  //
  // Reference: ASBC polynomial. Hand-verified points:
  //   SG 1.000 → °P ≈ 0.0   (water)
  //   SG 1.050 → °P ≈ 12.4  (typical pale ale)
  //   SG 1.080 → °P ≈ 19.3  (big IPA)
  //   SG 1.100 → °P ≈ 23.8  (barleywine / mead)

  it("computes °P for a typical pale-ale gravity (1.050)", () => {
    const r = computePitchRate({
      og: 1.05,
      batchSizeLiters: 20,
      beerType: "ale",
      yeastForm: "liquid",
    });
    expect(r.degreesPlato).toBeCloseTo(12.4, 1);
  });

  it("computes °P for a big IPA gravity (1.080)", () => {
    const r = computePitchRate({
      og: 1.08,
      batchSizeLiters: 20,
      beerType: "ale",
      yeastForm: "liquid",
    });
    expect(r.degreesPlato).toBeCloseTo(19.3, 1);
  });

  it("computes °P for a strong mead / wine gravity (1.110)", () => {
    // ASBC polynomial gives ~25.9 °P for SG 1.110
    const r = computePitchRate({
      og: 1.11,
      batchSizeLiters: 20,
      beerType: "ale",
      yeastForm: "liquid",
    });
    expect(r.degreesPlato).toBeCloseTo(25.9, 1);
  });
});

describe("computePitchRate — ale pitch rate", () => {
  // Reference: 20 L batch at OG 1.050 (12.4 °P), ale → 0.75 M/mL/°P.
  //
  //   cells (billions) = 0.75 × 20 × 12.4 = 186
  //
  // Fresh liquid pack: 100 B viable → 186 / 100 = 1.86 → 2 packs.
  // Fresh dry pack:    200 B viable → 186 / 200 = 0.93 → 1 pack.
  // Starter recommended for liquid because packs ≥ 2.
  // Starter volume: deficit = 186 - 100 = 86 → ceil(86 / 100) = 1.0 → ~1.0 L.

  it("ale 20L @ 1.050, fresh liquid — 2 packs, 1 L starter", () => {
    const r = computePitchRate({
      og: 1.05,
      batchSizeLiters: 20,
      beerType: "ale",
      yeastForm: "liquid",
    });
    expect(r.recommendedCells).toBeCloseTo(186, -1);
    expect(r.viableCellsPerPack).toBe(100);
    expect(r.packsNeeded).toBe(2);
    expect(r.starterRecommended).toBe(true);
    expect(r.starterVolumeLiters).toBe(1);
  });

  it("ale 20L @ 1.050, fresh dry — 1 pack, no starter", () => {
    const r = computePitchRate({
      og: 1.05,
      batchSizeLiters: 20,
      beerType: "ale",
      yeastForm: "dry",
    });
    expect(r.viableCellsPerPack).toBe(200);
    expect(r.packsNeeded).toBe(1);
    expect(r.starterRecommended).toBe(false);
    expect(r.starterVolumeLiters).toBe(0);
  });

  it("ale 20L @ 1.060, fresh liquid — 2 packs, starter (gravity > 1.060)", () => {
    // °P ≈ 14.7
    // cells = 0.75 × 20 × 14.7 = 220.5
    // packs = ceil(220.5 / 100) = 3
    // starter recommended because packs >= 2
    const r = computePitchRate({
      og: 1.06,
      batchSizeLiters: 20,
      beerType: "ale",
      yeastForm: "liquid",
    });
    expect(r.packsNeeded).toBe(3);
    expect(r.starterRecommended).toBe(true);
    expect(r.starterVolumeLiters).toBeGreaterThan(0);
  });

  it("ale 10L @ 1.040, fresh liquid — 1 pack, no starter", () => {
    // °P ≈ 10.0, cells = 0.75 × 10 × 10.0 = 75
    // 1 pack (100 B viable)
    const r = computePitchRate({
      og: 1.04,
      batchSizeLiters: 10,
      beerType: "ale",
      yeastForm: "liquid",
    });
    expect(r.packsNeeded).toBe(1);
    expect(r.starterRecommended).toBe(false);
    expect(r.starterVolumeLiters).toBe(0);
  });

  it("scales linearly with batch volume", () => {
    // Same OG, same pitch rate, half the volume = half the cells.
    const big = computePitchRate({
      og: 1.05,
      batchSizeLiters: 20,
      beerType: "ale",
      yeastForm: "liquid",
    });
    const small = computePitchRate({
      og: 1.05,
      batchSizeLiters: 10,
      beerType: "ale",
      yeastForm: "liquid",
    });
    expect(small.recommendedCells).toBeCloseTo(big.recommendedCells / 2, 0);
  });
});

describe("computePitchRate — lager pitch rate", () => {
  // Lager rate is 2× ale: 1.5 M/mL/°P.
  //
  // 20 L @ 1.050 (12.4 °P) → 1.5 × 20 × 12.4 = 372 B.
  // Fresh liquid: 372 / 100 = 3.72 → 4 packs.
  // Fresh dry:    372 / 200 = 1.86 → 2 packs.

  it("lager 20L @ 1.050, fresh liquid — 4 packs, starter", () => {
    const r = computePitchRate({
      og: 1.05,
      batchSizeLiters: 20,
      beerType: "lager",
      yeastForm: "liquid",
    });
    expect(r.recommendedCells).toBeCloseTo(372, -1);
    expect(r.packsNeeded).toBe(4);
    expect(r.starterRecommended).toBe(true);
    expect(r.starterVolumeLiters).toBeGreaterThan(0);
  });

  it("lager 20L @ 1.050, fresh dry — 2 packs, no starter (dry)", () => {
    const r = computePitchRate({
      og: 1.05,
      batchSizeLiters: 20,
      beerType: "lager",
      yeastForm: "dry",
    });
    expect(r.packsNeeded).toBe(2);
    expect(r.starterRecommended).toBe(false);
  });

  it("lager needs roughly 2× the cells of ale at the same gravity", () => {
    const ale = computePitchRate({
      og: 1.05,
      batchSizeLiters: 20,
      beerType: "ale",
      yeastForm: "liquid",
    });
    const lager = computePitchRate({
      og: 1.05,
      batchSizeLiters: 20,
      beerType: "lager",
      yeastForm: "liquid",
    });
    expect(lager.recommendedCells).toBeCloseTo(ale.recommendedCells * 2, 0);
  });
});

describe("computePitchRate — viability", () => {
  it("fresh yeast (0 days) has 100 % viability", () => {
    const r = computePitchRate({
      og: 1.05,
      batchSizeLiters: 20,
      beerType: "ale",
      yeastForm: "liquid",
      daysSinceProduction: 0,
    });
    expect(r.viability).toBe(1);
  });

  it("30-day-old liquid yeast has ~79 % viability", () => {
    const r = computePitchRate({
      og: 1.05,
      batchSizeLiters: 20,
      beerType: "ale",
      yeastForm: "liquid",
      daysSinceProduction: 30,
    });
    // 1 - 30 × 0.007 = 0.79
    expect(r.viability).toBeCloseTo(0.79, 2);
  });

  it("very old yeast bottoms out at MIN_VIABILITY", () => {
    const r = computePitchRate({
      og: 1.05,
      batchSizeLiters: 20,
      beerType: "ale",
      yeastForm: "liquid",
      daysSinceProduction: 500,
    });
    expect(r.viability).toBe(MIN_VIABILITY);
  });

  it("viability override takes precedence over daysSinceProduction", () => {
    const r = computePitchRate({
      og: 1.05,
      batchSizeLiters: 20,
      beerType: "ale",
      yeastForm: "liquid",
      daysSinceProduction: 100,
      viabilityOverride: 0.5,
    });
    expect(r.viability).toBe(0.5);
    // Viable cells = 100 × 0.5 = 50
    expect(r.viableCellsPerPack).toBe(50);
  });
});

describe("computePitchRate — cellsPerPackOverride", () => {
  it("override changes viableCellsPerPack", () => {
    const r = computePitchRate({
      og: 1.05,
      batchSizeLiters: 20,
      beerType: "ale",
      yeastForm: "liquid",
      cellsPerPackOverride: 200,
    });
    // 200 × 1.0 viability = 200 viable B per pack
    expect(r.viableCellsPerPack).toBe(200);
  });
});

describe("computePitchRate — edge cases and validation", () => {
  it("OG exactly 1.060 triggers starter recommendation for liquid", () => {
    const r = computePitchRate({
      og: 1.06,
      batchSizeLiters: 10,
      beerType: "ale",
      yeastForm: "liquid",
    });
    // 10L @ 1.060: cells = 0.75 × 10 × 14.7 = 110. 1 pack is enough
    // (100 B viable) but OG > 1.060 so starter is still recommended.
    expect(r.packsNeeded).toBe(2);
    expect(r.starterRecommended).toBe(true);
  });

  it("throws on non-finite OG", () => {
    expect(() =>
      computePitchRate({
        og: Number.NaN,
        batchSizeLiters: 20,
        beerType: "ale",
        yeastForm: "liquid",
      }),
    ).toThrow(/og/);
  });

  it("throws on non-positive batch size", () => {
    expect(() =>
      computePitchRate({
        og: 1.05,
        batchSizeLiters: 0,
        beerType: "ale",
        yeastForm: "liquid",
      }),
    ).toThrow(/batchSizeLiters/);
  });

  it("throws on invalid beerType", () => {
    expect(() =>
      computePitchRate({
        og: 1.05,
        batchSizeLiters: 20,
        beerType: "hybrid" as "ale",
        yeastForm: "liquid",
      }),
    ).toThrow(/beerType/);
  });

  it("throws on invalid yeastForm", () => {
    expect(() =>
      computePitchRate({
        og: 1.05,
        batchSizeLiters: 20,
        beerType: "ale",
        yeastForm: "tablet" as "dry",
      }),
    ).toThrow(/yeastForm/);
  });
});

describe("exposed constants", () => {
  it("ALE_PITCH_RATE is 0.75", () => {
    expect(ALE_PITCH_RATE).toBe(0.75);
  });
  it("LAGER_PITCH_RATE is 1.5", () => {
    expect(LAGER_PITCH_RATE).toBe(1.5);
  });
  it("LIQUID_CELLS_PER_PACK is 100", () => {
    expect(LIQUID_CELLS_PER_PACK).toBe(100);
  });
  it("DRY_CELLS_PER_PACK is 200", () => {
    expect(DRY_CELLS_PER_PACK).toBe(200);
  });
  it("DAILY_VIABILITY_LOSS is 0.007", () => {
    expect(DAILY_VIABILITY_LOSS).toBe(0.007);
  });
  it("MIN_VIABILITY is 0.15", () => {
    expect(MIN_VIABILITY).toBe(0.15);
  });
});
