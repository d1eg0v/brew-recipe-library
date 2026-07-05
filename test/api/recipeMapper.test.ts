// Recipe mapper tests — verify that validated requests translate into the
// shape Prisma's `uncheckedCreateInput` accepts for nested-create payloads.

import { describe, it, expect } from "vitest";

import {
  recipeToCreateInput,
  recipePatchToUpdateInput,
} from "@/lib/api/recipeMapper";
import type { RecipeCreateBody, RecipePatchBody } from "@/lib/api/schemas";

// Generic cast helper for assertions on Prisma-shaped input objects.
function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

const sample: RecipeCreateBody = {
  title: "Mapper Test",
  category: "beer",
  batchSizeLiters: 20,
  fermentables: [
    { name: "Pale", type: "grain", amountKg: 4 },
    { name: "Crystal", type: "grain", amountKg: 0.5 },
  ],
  hops: [{ name: "Cascade", amountGrams: 20, timeMinutes: 60 }],
  yeasts: [{ name: "US-05", form: "dry" }],
  mashSteps: [
    { name: "Sacc rest", type: "infusion", stepTempC: 66, stepTimeMinutes: 60 },
  ],
  processSteps: [],
  additions: [{ name: "Irish moss", amount: 1, unit: "tsp" }],
};

describe("recipeToCreateInput", () => {
  it("produces nested create payloads for all child lists", () => {
    const out = asRecord(recipeToCreateInput(sample));
    expect(out.title).toBe("Mapper Test");
    expect(out.batchSizeLiters).toBe(20);
    const ferm = asRecord(out.fermentables);
    expect(ferm.create).toEqual([
      { name: "Pale", type: "grain", amountKg: 4, position: 0 },
      { name: "Crystal", type: "grain", amountKg: 0.5, position: 1 },
    ]);
    const hops = asRecord(out.hops);
    const hopRows = hops.create as Array<Record<string, unknown>>;
    expect(hopRows[0]).toMatchObject({
      name: "Cascade",
      amountGrams: 20,
      timeMinutes: 60,
      position: 0,
    });
    const yeasts = asRecord(out.yeasts);
    const yeastRows = yeasts.create as Array<Record<string, unknown>>;
    expect(yeastRows[0]).toMatchObject({ name: "US-05", position: 0 });
    const mash = asRecord(out.mashSteps);
    const mashRows = mash.create as Array<Record<string, unknown>>;
    expect(mashRows[0]).toMatchObject({ name: "Sacc rest", position: 0 });
    const adds = asRecord(out.additions);
    const addRows = adds.create as Array<Record<string, unknown>>;
    expect(addRows[0]).toMatchObject({
      name: "Irish moss",
      position: 0,
    });
  });

  it("fills missing position with the array index", () => {
    const out = asRecord(
      recipeToCreateInput({
        title: "x",
        batchSizeLiters: 1,
        hops: [
          { name: "A", amountGrams: 10, timeMinutes: 60, position: 5 },
          { name: "B", amountGrams: 20, timeMinutes: 30 },
        ],
      } as RecipeCreateBody),
    );
    const hopRows = (asRecord(out.hops).create) as Array<Record<string, unknown>>;
    expect(hopRows[1].position).toBe(1);
    expect(hopRows[0].position).toBe(5);
  });

  it("strips undefined scalar fields", () => {
    const out = asRecord(recipeToCreateInput({ title: "x", batchSizeLiters: 1 }));
    expect("targetAbv" in out).toBe(false);
  });
});

describe("recipePatchToUpdateInput", () => {
  it("returns null when no fields are provided", () => {
    const out = recipePatchToUpdateInput({});
    expect(out).toBeNull();
  });

  it("updates only scalar fields when children not provided", () => {
    const out = asRecord(recipePatchToUpdateInput({ title: "Renamed" }));
    expect(out.title).toBe("Renamed");
    expect(out.fermentables).toBeUndefined();
    expect(out.hops).toBeUndefined();
  });

  it("replaces a child list with deleteMany + create when provided", () => {
    const patch: RecipePatchBody = {
      hops: [{ name: "New", amountGrams: 30, timeMinutes: 30 }],
    };
    const out = asRecord(recipePatchToUpdateInput(patch));
    expect(out.hops).toEqual({
      deleteMany: {},
      create: [{ name: "New", amountGrams: 30, timeMinutes: 30, position: 0 }],
    });
  });
});
