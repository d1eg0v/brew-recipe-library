import { describe, expect, it } from "vitest";
import { scaleFactor, scaleIngredient, scaleRecipe } from "./scaling";
import { computeTargets } from "./index";

describe("scaleFactor", () => {
  it("computes the ratio of volumes", () => {
    expect(scaleFactor(20, 40)).toBe(2);
    expect(scaleFactor(20, 10)).toBe(0.5);
  });

  it("throws on non-positive volumes", () => {
    expect(() => scaleFactor(0, 20)).toThrow();
    expect(() => scaleFactor(20, 0)).toThrow();
  });
});

describe("scaleIngredient", () => {
  it("scales known amount fields and leaves others untouched", () => {
    const hop = { name: "Cascade", amountGrams: 30, alphaAcidPct: 5.5, timeMinutes: 60 };
    const scaled = scaleIngredient(hop, 2);
    expect(scaled.amountGrams).toBe(60);
    expect(scaled.alphaAcidPct).toBe(5.5); // % is a concentration, not scaled
    expect(scaled.timeMinutes).toBe(60);
    expect(scaled.name).toBe("Cascade");
  });

  it("does not mutate the input", () => {
    const grain = { name: "2-row", amountKg: 5 };
    scaleIngredient(grain, 3);
    expect(grain.amountKg).toBe(5);
  });
});

describe("scaleRecipe", () => {
  const recipe = {
    batchSizeLiters: 20,
    fermentables: [{ name: "2-row", amountKg: 5, colorLovibond: 2, potentialPpg: 37, type: "grain" }],
    hops: [{ name: "Cascade", amountGrams: 40, alphaAcidPct: 6, timeMinutes: 60, use: "boil" }],
    yeasts: [{ name: "US-05", attenuationPct: 78 }],
    mashSteps: [{ name: "Sacch", stepTempC: 67, stepTimeMinutes: 60, infuseAmountLiters: 15 }],
  };

  it("doubles ingredient amounts when doubling the batch", () => {
    const scaled = scaleRecipe(recipe, 40);
    expect(scaled.batchSizeLiters).toBe(40);
    expect(scaled.fermentables[0].amountKg).toBe(10);
    expect(scaled.hops[0].amountGrams).toBe(80);
    expect(scaled.mashSteps[0].infuseAmountLiters).toBe(30);
    // concentration-independent fields stay the same
    expect(scaled.hops[0].alphaAcidPct).toBe(6);
    expect(scaled.mashSteps[0].stepTempC).toBe(67);
  });

  it("does not mutate the original recipe", () => {
    scaleRecipe(recipe, 100);
    expect(recipe.batchSizeLiters).toBe(20);
    expect(recipe.fermentables[0].amountKg).toBe(5);
  });

  it("keeps the computed targets essentially unchanged after scaling", () => {
    const before = computeTargets(recipe);
    const scaled = scaleRecipe(recipe, 55);
    const after = computeTargets(scaled);
    expect(after.og).toBeCloseTo(before.og, 3);
    expect(after.fg).toBeCloseTo(before.fg, 3);
    expect(after.abv).toBeCloseTo(before.abv, 2);
    expect(after.ibu).toBeCloseTo(before.ibu, 0);
    expect(after.srm).toBeCloseTo(before.srm, 0);
  });

  it("handles extreme scale factors", () => {
    const tiny = scaleRecipe(recipe, 0.5);
    expect(tiny.fermentables[0].amountKg).toBeCloseTo(0.125, 6);
    const huge = scaleRecipe(recipe, 2000);
    expect(huge.hops[0].amountGrams).toBe(4000);
  });
});
