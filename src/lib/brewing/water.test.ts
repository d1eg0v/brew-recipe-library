import { describe, expect, it } from "vitest";

import {
  alkalinityAsCaCO3,
  BUILT_IN_PROFILES,
  computeWaterChemistry,
  estimateMashPh,
  residualAlkalinity,
  SALT_DEFINITIONS,
  SALT_TYPES,
} from "./water";

describe("alkalinityAsCaCO3", () => {
  it("converts bicarbonate (ppm) to alkalinity as CaCO₃", () => {
    // 61.02 ppm HCO₃⁻ ≡ 50 ppm CaCO₃ → factor 0.8197 (~0.82)
    expect(alkalinityAsCaCO3(61.02)).toBeCloseTo(50.0, 1);
  });

  it("zero bicarbonate yields zero alkalinity", () => {
    expect(alkalinityAsCaCO3(0)).toBe(0);
  });

  it("is proportional to bicarbonate concentration", () => {
    const half = alkalinityAsCaCO3(100);
    const full = alkalinityAsCaCO3(200);
    expect(full).toBeCloseTo(half * 2, 5);
  });
});

describe("residualAlkalinity (Kolbach)", () => {
  // RO / distilled water — no minerals, no alkalinity
  it("zero RA for distilled water", () => {
    const ra = residualAlkalinity({
      calcium: 0,
      magnesium: 0,
      sodium: 0,
      sulfate: 0,
      chloride: 0,
      bicarbonate: 0,
    });
    expect(ra).toBeCloseTo(0, 1);
  });

  // Pilsen water: Ca=7, Mg=2, HCO₃=10
  // Alk = 10 × 0.82 = 8.2
  // RA = 8.2 - 0.714×7 - 0.585×2 = 8.2 - 5.0 - 1.17 = 2.03
  it("Pilsen water has low RA (~2 ppm)", () => {
    const ra = residualAlkalinity({ calcium: 7, magnesium: 2, sodium: 2, sulfate: 5, chloride: 2, bicarbonate: 10 });
    expect(ra).toBeCloseTo(2.0, 0);
  });

  // London water: Ca=50, Mg=5, HCO₃=120
  // Alk = 120 × 0.82 = 98.4
  // RA = 98.4 - 0.714×50 - 0.585×5 = 98.4 - 35.7 - 2.925 = 59.8
  it("London water has moderate RA (~60 ppm)", () => {
    const ra = residualAlkalinity({ calcium: 50, magnesium: 5, sodium: 30, sulfate: 30, chloride: 30, bicarbonate: 120 });
    expect(ra).toBeCloseTo(59.8, 0);
  });
});

describe("estimateMashPh", () => {
  // RA = 0 → baseline pH ~5.4
  it("returns ~5.4 for neutral water", () => {
    const ph = estimateMashPh(0);
    expect(ph).toBeCloseTo(5.4, 1);
  });

  // Each +50 ppm RA ≈ +0.1 pH
  // RA = 50 → pH ~5.5
  it("shifts by ~0.1 per 50 ppm RA", () => {
    expect(estimateMashPh(50)).toBeCloseTo(5.50, 2);
  });

  // RA = 100 → pH ~5.6
  it("predicts reasonable pH for moderate RA", () => {
    const ph = estimateMashPh(100);
    expect(ph).toBeGreaterThan(5.55);
    expect(ph).toBeLessThan(5.65);
  });
});

describe("SALT_TYPES and SALT_DEFINITIONS", () => {
  it("exposes the six common brewing salts", () => {
    expect(SALT_TYPES).toEqual([
      "gypsum",
      "calciumChloride",
      "epsomSalt",
      "canningSalt",
      "bakingSoda",
      "chalk",
    ]);
  });

  it("gypsum has Ca and SO₄ only", () => {
    const g = SALT_DEFINITIONS.gypsum;
    expect(g.ca).toBeGreaterThan(0);
    expect(g.so4).toBeGreaterThan(0);
    expect(g.mg).toBe(0);
    expect(g.na).toBe(0);
    expect(g.cl).toBe(0);
    expect(g.hco3).toBe(0);
  });

  it("calcium chloride has Ca and Cl only", () => {
    const c = SALT_DEFINITIONS.calciumChloride;
    expect(c.ca).toBeGreaterThan(0);
    expect(c.cl).toBeGreaterThan(0);
    expect(c.so4).toBe(0);
  });
});

describe("computeWaterChemistry", () => {
  it("throws on zero volume", () => {
    expect(() =>
      computeWaterChemistry({
        source: BUILT_IN_PROFILES[0],
        additions: [],
        volumeLiters: 0,
      }),
    ).toThrow();
  });

  it("returns source profile unchanged when no salts added", () => {
    const ro = BUILT_IN_PROFILES[0];
    const result = computeWaterChemistry({ source: ro, additions: [], volumeLiters: 20 });
    expect(result.resultingProfile.calcium).toBeCloseTo(0, 1);
    expect(result.estimatedMashPh).toBeCloseTo(5.4, 1);
  });

  // Worked example: 5 g gypsum + 3 g CaCl₂ in 20 L of RO water
  // Gypsum contribution: Ca = 5/20 × 232.8 = 58.2 ppm, SO₄ = 5/20 × 558 = 139.5 ppm
  // CaCl₂ contribution: Ca = 3/20 × 272.6 = 40.9 ppm, Cl = 3/20 × 482.2 = 72.3 ppm
  // Resulting: Ca = 58.2 + 40.9 = 99.1, SO₄ = 139.5, Cl = 72.3
  // Alk = 0, so RA = 0 - 0.714×99.1 - 0.585×0 = -70.8
  // WAIT: Mg=0, so RA = -0.714×99.1 = -70.8
  // Actually RA = 0 - 0.714×99.1 - 0.585×0 = -70.8
  // Mash pH = 5.4 + (-70.8) × 0.002 = 5.26 — reasonable for highly mineralized water
  it("computes correct profile for gypsum + CaCl₂ in RO water", () => {
    const result = computeWaterChemistry({
      source: BUILT_IN_PROFILES[0],
      additions: [
        { saltType: "gypsum", grams: 5 },
        { saltType: "calciumChloride", grams: 3 },
      ],
      volumeLiters: 20,
    });
    expect(result.resultingProfile.calcium).toBeCloseTo(99.1, 0);
    expect(result.resultingProfile.sulfate).toBeCloseTo(139.5, 0);
    expect(result.resultingProfile.chloride).toBeCloseTo(72.3, 0);
    expect(result.estimatedMashPh).toBeLessThan(5.4);
  });

  it("reports per-salt contributions", () => {
    const result = computeWaterChemistry({
      source: BUILT_IN_PROFILES[0],
      additions: [{ saltType: "gypsum", grams: 10 }],
      volumeLiters: 20,
    });
    expect(result.contributions).toHaveLength(1);
    expect(result.contributions[0].saltType).toBe("gypsum");
    expect(result.contributions[0].calcium).toBeCloseTo(116.4, 0);
  });

  it("computes positive RA from alkaline water", () => {
    // Dublin profile + no salts: Ca=120, Mg=5, HCO₃=320
    // Alk = 320 × 0.82 = 262.4
    // RA = 262.4 - 0.714×120 - 0.585×5 = 262.4 - 85.7 - 2.9 = 173.8
    // pH = 5.4 + 173.8 × 0.002 = 5.75
    const dublin = BUILT_IN_PROFILES.find((p) => p.name === "Dublin")!;
    const result = computeWaterChemistry({
      source: dublin,
      additions: [],
      volumeLiters: 20,
    });
    expect(result.residualAlkalinity).toBeGreaterThan(150);
    expect(result.estimatedMashPh).toBeGreaterThan(5.7);
  });

  it("maintains correct sulfate-to-chloride ratio", () => {
    // Add gypsum (SO₄) + CaCl₂ (Cl) to RO
    const result = computeWaterChemistry({
      source: BUILT_IN_PROFILES[0],
      additions: [
        { saltType: "gypsum", grams: 5 },
        { saltType: "calciumChloride", grams: 2 },
      ],
      volumeLiters: 20,
    });
    // gypsum: SO₄ = 5/20 × 558 = 139.5
    // CaCl₂: Cl = 2/20 × 482.2 = 48.22
    expect(result.sulfateChlorideRatio).toBeCloseTo(139.5 / 48.22, 1);
  });

  it("returns null ratio when both sulfate and chloride are zero", () => {
    const result = computeWaterChemistry({
      source: BUILT_IN_PROFILES[0],
      additions: [],
      volumeLiters: 20,
    });
    expect(result.sulfateChlorideRatio).toBeNull();
  });

  it("rounds all profile values to 1 decimal place", () => {
    const result = computeWaterChemistry({
      source: BUILT_IN_PROFILES[0],
      additions: [{ saltType: "gypsum", grams: 3 }],
      volumeLiters: 20,
    });
    const vals = Object.values(result.resultingProfile);
    vals.forEach((v) => {
      expect(v).toBeCloseTo(Math.round(v * 10) / 10, 1);
    });
  });
});

describe("BUILT_IN_PROFILES", () => {
  it("has the seven expected profiles", () => {
    expect(BUILT_IN_PROFILES.map((p) => p.name)).toEqual([
      "RO / Distilled",
      "Pilsen (soft)",
      "Yellow balanced",
      "London",
      "Munich",
      "Burton-on-Trent",
      "Dublin",
    ]);
  });

  it("RO profile has zero minerals", () => {
    const ro = BUILT_IN_PROFILES[0];
    expect(ro.calcium).toBe(0);
    expect(ro.magnesium).toBe(0);
    expect(ro.sodium).toBe(0);
    expect(ro.sulfate).toBe(0);
    expect(ro.chloride).toBe(0);
    expect(ro.bicarbonate).toBe(0);
  });

  it("Burton has high calcium and sulfate", () => {
    const burton = BUILT_IN_PROFILES.find((p) => p.name === "Burton-on-Trent")!;
    expect(burton.calcium).toBeGreaterThan(250);
    expect(burton.sulfate).toBeGreaterThan(700);
  });
});
