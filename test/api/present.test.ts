// Presentation tests — scaling + unit conversion produce expected output and
// never mutate the input.

import { describe, it, expect } from "vitest";

import {
  presentRecipe,
  scaleAmountFields,
  scaleChildren,
} from "@/lib/api/present";
import {
  kgToPounds,
  litersToGallons,
  celsiusToFahrenheit,
  roundTo,
} from "@/lib/brewing/units";

function asRec(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

const fixture = {
  batchSizeLiters: 20,
  fermentables: [
    { name: "Pale", type: "grain", amountKg: 4, position: 0 },
    { name: "Juice", type: "juice", amountLiters: 2, position: 1 },
  ],
  hops: [{ name: "Cascade", amountGrams: 30, timeMinutes: 30, position: 0 }],
  yeasts: [{ name: "US-05", form: "dry", position: 0 }],
  mashSteps: [
    {
      name: "Sacc",
      type: "infusion",
      stepTempC: 66,
      stepTimeMinutes: 60,
      infuseAmountLiters: 12,
      position: 0,
    },
  ],
};

describe("scaleAmountFields", () => {
  it("multiplies known amount fields and leaves others alone", () => {
    const out = scaleAmountFields(
      { name: "Pale", amountKg: 4, alphaAcidPct: 6 },
      0.5,
    );
    expect(out).toEqual({ name: "Pale", amountKg: 2, alphaAcidPct: 6 });
  });

  it("does not mutate the input", () => {
    const input = { name: "Pale", amountKg: 4 };
    scaleAmountFields(input, 2);
    expect(input).toEqual({ name: "Pale", amountKg: 4 });
  });
});

describe("scaleChildren", () => {
  it("scales each item in a list", () => {
    const out = scaleChildren(
      [
        { name: "Pale", amountKg: 4 },
        { name: "Crystal", amountKg: 1 },
      ],
      0.5,
    );
    expect(out).toEqual([
      { name: "Pale", amountKg: 2 },
      { name: "Crystal", amountKg: 0.5 },
    ]);
  });

  it("returns undefined input unchanged", () => {
    expect(scaleChildren(undefined, 2)).toBeUndefined();
  });
});

describe("presentRecipe", () => {
  it("returns the recipe unchanged when no options are passed", () => {
    const out = presentRecipe(fixture);
    expect(out.batchSizeLiters).toBe(20);
    expect(out.fermentables).toEqual(fixture.fermentables);
    expect(out.hops).toEqual(fixture.hops);
  });

  it("scales ingredient amounts and batch size when batchSize is given", () => {
    const out = presentRecipe(fixture, { batchSize: 10 });
    expect(out.batchSizeLiters).toBe(10);
    expect(asRec(out.fermentables![0]).amountKg).toBe(2);
    expect(asRec(out.fermentables![1]).amountLiters).toBe(1);
    expect(asRec(out.hops![0]).amountGrams).toBe(15);
    expect(asRec(out.mashSteps![0]).infuseAmountLiters).toBe(6);
    expect(asRec(out.fermentables![0]).amountLbs).toBeUndefined();
  });

  it("adds imperial fields alongside metric when units=imperial", () => {
    const out = presentRecipe(fixture, { units: "imperial" });
    expect(asRec(out.fermentables![0]).amountKg).toBe(4);
    expect(asRec(out.fermentables![0]).amountLbs).toBe(
      roundTo(kgToPounds(4), 3),
    );
    expect(asRec(out.fermentables![1]).amountGallons).toBe(
      roundTo(litersToGallons(2), 3),
    );
    expect(out.batchSizeGallons).toBe(roundTo(litersToGallons(20), 3));
    expect(asRec(out.mashSteps![0]).stepTempF).toBe(
      roundTo(celsiusToFahrenheit(66), 1),
    );
  });

  it("combines scaling + imperial conversion correctly", () => {
    const out = presentRecipe(fixture, {
      batchSize: 10,
      units: "imperial",
    });
    expect(out.batchSizeLiters).toBe(10);
    expect(out.batchSizeGallons).toBe(roundTo(litersToGallons(10), 3));
    expect(asRec(out.fermentables![0]).amountKg).toBe(2);
    expect(asRec(out.fermentables![0]).amountLbs).toBe(
      roundTo(kgToPounds(2), 3),
    );
  });

  it("removes imperial field on metric pass", () => {
    const imperial = presentRecipe(fixture, { units: "imperial" });
    const back = presentRecipe(imperial, { units: "metric" });
    expect(asRec(back.fermentables![0]).amountLbs).toBeUndefined();
    expect(back.batchSizeGallons).toBeUndefined();
  });
});
