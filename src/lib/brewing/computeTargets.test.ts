import { describe, expect, it } from "vitest";
import { computeTargets } from "./index";
import type { RecipeCalcInput } from "./types";

describe("computeTargets", () => {
  // A representative American IPA-ish recipe.
  const ipa: RecipeCalcInput = {
    batchSizeLiters: 20,
    efficiencyPct: 72,
    fermentables: [
      { type: "grain", amountKg: 5.0, potentialPpg: 37, colorLovibond: 2 },
      { type: "grain", amountKg: 0.4, potentialPpg: 34, colorLovibond: 40 },
    ],
    hops: [
      { amountGrams: 28, alphaAcidPct: 12, timeMinutes: 60, use: "boil" },
      { amountGrams: 28, alphaAcidPct: 12, timeMinutes: 15, use: "boil" },
      { amountGrams: 56, alphaAcidPct: 12, timeMinutes: 0, use: "dryHop" },
    ],
    yeasts: [{ attenuationPct: 78 }],
  };

  it("produces target values in sane brewing ranges for an IPA", () => {
    const t = computeTargets(ipa);
    expect(t.og).toBeGreaterThan(1.05);
    expect(t.og).toBeLessThan(1.075);
    expect(t.fg).toBeGreaterThan(1.008);
    expect(t.fg).toBeLessThan(1.018);
    expect(t.fg).toBeLessThan(t.og);
    expect(t.abv).toBeGreaterThan(5);
    expect(t.abv).toBeLessThan(8);
    expect(t.ibu).toBeGreaterThan(20);
    expect(t.ibu).toBeLessThan(70);
    expect(t.srm).toBeGreaterThan(3);
    expect(t.srm).toBeLessThan(12);
  });

  it("is internally consistent: ABV derived from its own OG/FG", () => {
    const t = computeTargets(ipa);
    expect(t.abv).toBeCloseTo((t.og - t.fg) * 131.25, 2);
  });

  it("defaults efficiency to 75% when omitted", () => {
    const { efficiencyPct: _omit, ...noEff } = ipa;
    void _omit;
    const t = computeTargets(noEff);
    expect(t.og).toBeGreaterThan(1.05);
  });

  it("handles an all-defaults minimal recipe without throwing", () => {
    const t = computeTargets({
      batchSizeLiters: 20,
      fermentables: [{ amountKg: 4 }],
      hops: [],
    });
    expect(t.og).toBeGreaterThan(1);
    expect(t.ibu).toBe(0);
    expect(t.srm).toBe(0);
  });

  it("handles a very small (1 L) and very large (1000 L) batch without blowing up", () => {
    const small = computeTargets({ ...ipa, batchSizeLiters: 1 });
    const large = computeTargets({ ...ipa, batchSizeLiters: 1000 });
    // Concentrating the same grain into less water raises OG; diluting lowers it.
    expect(small.og).toBeGreaterThan(large.og);
    for (const v of [...Object.values(small), ...Object.values(large)]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it("IBU falls as the batch is diluted at a realistic gravity", () => {
    const strong = computeTargets({ ...ipa, batchSizeLiters: 15 });
    const weak = computeTargets({ ...ipa, batchSizeLiters: 30 });
    expect(strong.ibu).toBeGreaterThan(weak.ibu);
  });
});
