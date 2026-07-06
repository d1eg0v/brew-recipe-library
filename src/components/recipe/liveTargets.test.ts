// Unit tests for the live OG/FG/ABV/IBU/SRM preview helper used by
// the recipe form. Mirrors the calc layer exactly so any divergence is a
// regression we will catch.

import { describe, it, expect } from "vitest";

import {
  blankRecipeFormState,
  emptyFermentable,
  emptyHop,
  emptyYeast,
} from "./recipeFormState";
import { computeLiveTargets } from "./liveTargets";

function withFermentable(seed: ReturnType<typeof blankRecipeFormState>) {
  const f = emptyFermentable();
  f.name = "Pale 2-Row";
  f.type = "grain";
  f.amountKg = 4.5;
  f.colorLovibond = 2;
  f.potentialPpg = 37;
  return { ...seed, fermentables: [f] };
}

function withHop(seed: ReturnType<typeof blankRecipeFormState>) {
  const h = emptyHop();
  h.name = "Cascade";
  h.amountGrams = 28;
  h.alphaAcidPct = 5.5;
  h.timeMinutes = 60;
  h.use = "boil";
  return { ...seed, hops: [h] };
}

function withYeast(seed: ReturnType<typeof blankRecipeFormState>, attenuation = 75) {
  const y = emptyYeast();
  y.name = "US-05";
  y.attenuationPct = attenuation;
  return { ...seed, yeasts: [y] };
}

describe("computeLiveTargets", () => {
  it("returns all-null when batch size is zero or missing", () => {
    const state = withFermentable(blankRecipeFormState());
    state.batchSizeLiters = 0;
    const result = computeLiveTargets(state);
    expect(result).toEqual({
      og: null,
      fg: null,
      abv: null,
      ibu: null,
      srm: null,
    });
  });

  it("returns all-null when no fermentables", () => {
    const state = withHop(blankRecipeFormState());
    expect(computeLiveTargets(state)).toEqual({
      og: null,
      fg: null,
      abv: null,
      ibu: null,
      srm: null,
    });
  });

  it("computes the full target set with fermentables + hops + yeast", () => {
    const state = withFermentable(
      withHop(withYeast(blankRecipeFormState(), 75)),
    );
    const result = computeLiveTargets(state);
    expect(result.og).not.toBeNull();
    expect(result.fg).not.toBeNull();
    expect(result.abv).not.toBeNull();
    expect(result.ibu).not.toBeNull();
    // Pale 2-Row @ 37 ppg, 4.5 kg, 75% efficiency, 20 L → ~OG 1.063
    expect(result.og).toBeGreaterThan(1.05);
    expect(result.og).toBeLessThan(1.075);
    expect(result.fg).toBeLessThan(result.og!);
    expect(result.abv).toBeGreaterThan(4);
    expect(result.abv).toBeLessThan(10);
    expect(result.srm).toBeGreaterThan(0);
  });

  it("matches the calc layer for a known Pale-Ale grain bill", () => {
    const state = withFermentable(blankRecipeFormState());
    state.efficiencyPct = 75;
    const result = computeLiveTargets(state);
    // 4.5 kg Pale 2-Row @ 37 ppg → 9.92 lb, 75% eff, 20 L (5.28 gal).
    // GU = 9.92 × 37 × 0.75 = 275.3 → OG = 1 + 275.3/5280 ≈ 1.0521 → 1.052.
    expect(result.og).toBeCloseTo(1.052, 2);
  });
});
