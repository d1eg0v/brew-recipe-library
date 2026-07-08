// Unit tests for the client-side form validator.
//
// Validates that `validateRecipeForm` reproduces the server-side Zod errors
// for known-bad state and lets fully-valid state pass.

import { describe, it, expect } from "vitest";

import {
  blankRecipeFormState,
  emptyFermentable,
  emptyHop,
  emptyMashStep,
  emptyYeast,
} from "./recipeFormState";
import { toCreateBody, validateRecipeForm } from "./validation";

function filledBase() {
  const state = blankRecipeFormState();
  state.title = "Cascade SMaSH";
  state.category = "beer";
  state.styleName = "American IPA";
  state.bjcpCategory = "21A";
  state.batchSizeLiters = 20;
  state.boilTimeMinutes = 60;
  state.efficiencyPct = 75;
  const ferm = emptyFermentable();
  ferm.name = "Pale 2-Row";
  ferm.type = "grain";
  ferm.amountKg = 4.5;
  state.fermentables = [ferm];
  const hop = emptyHop();
  hop.name = "Cascade";
  hop.amountGrams = 28;
  hop.timeMinutes = 60;
  hop.use = "boil";
  state.hops = [hop];
  const yeast = emptyYeast();
  yeast.name = "US-05";
  yeast.form = "dry";
  yeast.attenuationPct = 75;
  state.yeasts = [yeast];
  const mash = emptyMashStep();
  mash.name = "Sacc rest";
  mash.type = "infusion";
  mash.stepTempC = 66;
  mash.stepTimeMinutes = 60;
  state.mashSteps = [mash];
  return state;
}

describe("validateRecipeForm", () => {
  it("passes a complete, valid form", () => {
    const result = validateRecipeForm(filledBase());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.body).toBeDefined();
  });

  it("rejects an empty title with a friendly message", () => {
    const state = filledBase();
    state.title = "   ";
    const result = validateRecipeForm(state);
    expect(result.ok).toBe(false);
    expect(result.errors["title"]).toMatch(/required/i);
  });

  it("flags a category that is not in RECIPE_CATEGORIES", () => {
    const state = filledBase();
    // @ts-expect-error - intentionally bad
    state.category = "whisky";
    const result = validateRecipeForm(state);
    expect(result.ok).toBe(false);
    expect(result.errors["category"]).toMatch(/one of/i);
  });

  it("rejects a hop with missing amountGrams", () => {
    const state = filledBase();
    state.hops[0].amountGrams = null;
    const result = validateRecipeForm(state);
    expect(result.ok).toBe(false);
    expect(result.errors["hops.0.amountGrams"]).toBeDefined();
  });

  it("rejects a fermentable with neither amountKg nor amountLiters", () => {
    const state = filledBase();
    state.fermentables[0].amountKg = null;
    state.fermentables[0].amountLiters = null;
    const result = validateRecipeForm(state);
    expect(result.ok).toBe(false);
    // The Zod `.refine()` lives on the row, so the issue path is the row
    // itself (no specific field), not the inner amount fields.
    expect(result.errors["fermentables.0"]).toBeDefined();
  });

  it("rejects a mash step with step temp out of bounds", () => {
    const state = filledBase();
    state.mashSteps[0].stepTempC = 999;
    const result = validateRecipeForm(state);
    expect(result.ok).toBe(false);
    expect(result.errors["mashSteps.0.stepTempC"]).toBeDefined();
  });
});

describe("toCreateBody", () => {
  it("strips local row keys and rounds numeric fields", () => {
    const state = filledBase();
    const body = toCreateBody(state);
    expect(body.title).toBe("Cascade SMaSH");
    expect(body.batchSizeLiters).toBe(20);
    expect(body.fermentables).toHaveLength(1);
    const ferm = body.fermentables?.[0] as Record<string, unknown>;
    expect(ferm.name).toBe("Pale 2-Row");
    expect(ferm.amountKg).toBe(4.5);
    expect(ferm.notes).toBeUndefined();
  });

  it("omits empty string optional fields and null numerics", () => {
    const state = filledBase();
    state.author = "  ";
    state.targetAbv = null;
    state.styleName = "";
    const body = toCreateBody(state);
    expect(body.author).toBeUndefined();
    expect(body.targetAbv).toBeUndefined();
    expect(body.styleName).toBeUndefined();
  });
});
