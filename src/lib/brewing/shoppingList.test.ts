// Pure-function tests for the shopping-list builder.

import { describe, it, expect } from "vitest";

import {
  buildShoppingList,
  sortShoppingItems,
  type ShoppingListInput,
} from "./shoppingList";

function asRec(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

const beerBase: ShoppingListInput = {
  batchSizeLiters: 20,
  fermentables: [
    { name: "Pale 2-Row", amountKg: 4.5 },
    { name: "Crystal 60", amountKg: 0.5 },
    { name: "Pale 2-Row", amountKg: 0.2 },
  ],
  hops: [
    { name: "Cascade", amountGrams: 25, use: "boil" },
    { name: "Cascade", amountGrams: 25, use: "boil" },
    { name: "Cascade", amountGrams: 50, use: "dryHop" },
    { name: "Citra", amountGrams: 20, use: "whirlpool" },
  ],
  yeasts: [
    { name: "US-05", form: "dry" },
    { name: "US-05", form: "dry" },
  ],
  additions: [
    { name: "Irish Moss", amount: 1, unit: "tsp" },
    { name: "Irish Moss", amount: 0.5, unit: "tsp" },
  ],
};

describe("buildShoppingList — aggregation", () => {
  it("sums duplicate fermentables of the same unit, keeps first-seen cased name", () => {
    const list = buildShoppingList(beerBase);
    const fItems = list.items.filter((i) => i.category === "fermentables");
    expect(fItems).toHaveLength(2);

    const pale = fItems.find((i) => i.name === "Pale 2-Row")!;
    expect(pale.unit).toBe("kg");
    expect(pale.amount).toBeCloseTo(4.7, 4);

    const crystal = fItems.find((i) => i.name === "Crystal 60")!;
    expect(crystal.unit).toBe("kg");
    expect(crystal.amount).toBeCloseTo(0.5, 4);
  });

  it("keeps fermentable kg vs L rows separate even when names match", () => {
    const out = buildShoppingList({
      batchSizeLiters: 20,
      fermentables: [
        { name: "Grape Juice", amountLiters: 19 },
        { name: "Grape Juice", amountKg: 2 },
      ],
    });
    const juice = out.items.filter((i) => i.name === "Grape Juice");
    expect(juice).toHaveLength(2);
    expect(juice.find((i) => i.unit === "L")?.amount).toBeCloseTo(19, 4);
    expect(juice.find((i) => i.unit === "kg")?.amount).toBeCloseTo(2, 4);
  });

  it("groups hops by (name, use) and keeps use in detail", () => {
    const out = buildShoppingList(beerBase);
    const hops = out.items.filter((i) => i.category === "hops");
    expect(hops).toHaveLength(3);

    const cascadeBoil = hops.find((i) => i.name === "Cascade" && i.detail === "boil");
    expect(cascadeBoil?.amount).toBeCloseTo(50, 4);
    expect(cascadeBoil?.unit).toBe("g");

    const cascadeDry = hops.find((i) => i.name === "Cascade" && i.detail === "dryhop");
    expect(cascadeDry?.amount).toBeCloseTo(50, 4);

    const citra = hops.find((i) => i.name === "Citra");
    expect(citra?.detail).toBe("whirlpool");
  });

  it("collapses duplicate yeasts and scales packet count with batch size", () => {
    const out = buildShoppingList(beerBase);
    const yeasts = out.items.filter((i) => i.category === "yeast");
    expect(yeasts).toHaveLength(1);
    expect(yeasts[0].name).toBe("US-05");
    expect(yeasts[0].detail).toBe("dry");
    expect(yeasts[0].unit).toBe("packets");
    // 20 L / 20 L = 1 packet, summed over 2 duplicates = 2 packets.
    expect(yeasts[0].amount).toBeCloseTo(2, 4);
  });

  it("does not collapse yeasts with different forms (dry vs liquid)", () => {
    const out = buildShoppingList({
      batchSizeLiters: 20,
      yeasts: [
        { name: "WLP001", form: "liquid" },
        { name: "US-05", form: "dry" },
      ],
    });
    const yeasts = out.items.filter((i) => i.category === "yeast");
    expect(yeasts).toHaveLength(2);
    expect(yeasts.map((y) => y.detail).sort()).toEqual(["dry", "liquid"]);
  });

  it("scales yeast packets with ceil(batchL/20) for larger batches", () => {
    const out = buildShoppingList({
      batchSizeLiters: 41, // ceil(41/20) = 3
      yeasts: [{ name: "US-05", form: "dry" }],
    });
    const y = out.items.find((i) => i.category === "yeast");
    expect(y?.amount).toBe(3);
  });

  it("gives at least one packet for any batch size", () => {
    const out = buildShoppingList({
      batchSizeLiters: 5,
      yeasts: [{ name: "US-05", form: "dry" }],
    });
    const y = out.items.find((i) => i.category === "yeast");
    expect(y?.amount).toBe(1);
  });

  it("sums additions sharing a name AND unit", () => {
    const out = buildShoppingList({
      batchSizeLiters: 20,
      additions: [
        { name: "Irish Moss", amount: 1, unit: "tsp" },
        { name: "Irish Moss", amount: 0.5, unit: "tsp" },
      ],
    });
    const ad = out.items.filter((i) => i.category === "additions");
    expect(ad).toHaveLength(1);
    expect(ad[0].amount).toBeCloseTo(1.5, 4);
    expect(ad[0].unit).toBe("tsp");
  });

  it("keeps additions with the same name but different units separate", () => {
    const out = buildShoppingList({
      batchSizeLiters: 20,
      additions: [
        { name: "Acid Blend", amount: 1, unit: "tsp" },
        { name: "Acid Blend", amount: 4, unit: "g" },
      ],
    });
    const ad = out.items.filter((i) => i.category === "additions");
    expect(ad).toHaveLength(2);
    expect(ad.find((a) => a.unit === "tsp")!.amount).toBeCloseTo(1, 4);
    expect(ad.find((a) => a.unit === "g")!.amount).toBeCloseTo(4, 4);
  });

  it("ignores empty addition amounts (rows with amount=null/missing)", () => {
    const out = buildShoppingList({
      batchSizeLiters: 20,
      additions: [
        { name: "Campden", unit: "tablet" }, // no amount
        { name: "Campden", amount: 1, unit: "tablet" },
      ],
    });
    const ad = out.items.filter((i) => i.category === "additions");
    expect(ad).toHaveLength(1);
    expect(ad[0].amount).toBe(1);
  });
});

describe("buildShoppingList — scaling interaction", () => {
  it("consumes the presented (already-scaled) recipe, not raw seed amounts", () => {
    // A 20 L recipe scaled to 40 L has doubled amounts. Builder simply
    // aggregates whatever it is handed.
    const out = buildShoppingList({
      batchSizeLiters: 40,
      fermentables: [
        { name: "Pale 2-Row", amountKg: 9 }, // already 2x
        { name: "Munich", amountKg: 0.8 },
        { name: "Pale 2-Row", amountKg: 1 }, // already 2x of 0.5
      ],
      yeasts: [{ name: "US-05", form: "dry" }],
    });
    const pale = out.items.find((i) => i.name === "Pale 2-Row")!;
    expect(pale.amount).toBeCloseTo(10, 4);
    const yeast = out.items.find((i) => i.category === "yeast")!;
    expect(yeast.amount).toBe(2); // ceil(40/20) = 2 packets
  });
});

describe("buildShoppingList — counts and totals", () => {
  it("returns per-category counts and a total", () => {
    const out = buildShoppingList(beerBase);
    expect(out.counts.fermentables).toBe(2);
    expect(out.counts.hops).toBe(3);
    expect(out.counts.yeast).toBe(1);
    expect(out.counts.additions).toBe(1);
    expect(out.counts.total).toBe(7);
  });

  it("returns the input batchSizeLiters as recipeBatchSizeLiters", () => {
    const out = buildShoppingList({ batchSizeLiters: 40, yeasts: [{ name: "US-05", form: "dry" }] });
    expect(out.recipeBatchSizeLiters).toBe(40);
  });
});

describe("buildShoppingList — domain smoke recipes", () => {
  it("handles a mead (honey + nutrients + campden) end to end", () => {
    const out = buildShoppingList({
      batchSizeLiters: 20,
      fermentables: [
        { name: "Wildflower Honey", amountKg: 5 },
        { name: "Wildflower Honey", amountKg: 0.2 },
      ],
      yeasts: [{ name: "Lalvin D-47", form: "dry" }],
      additions: [
        { name: "Fermaid-O", amount: 9, unit: "g" },
        { name: "Fermaid-O", amount: 5, unit: "g" },
        { name: "Campden tablet", amount: 1, unit: "tablet" },
        { name: "Pectic enzyme", amount: 1, unit: "tsp" },
      ],
    });
    expect(out.items.find((i) => i.name === "Wildflower Honey")!.amount).toBeCloseTo(5.2, 4);
    expect(out.items.find((i) => i.name === "Fermaid-O")!.amount).toBeCloseTo(14, 4);
    expect(out.items.find((i) => i.name === "Campden tablet")!.amount).toBe(1);
    expect(out.items.find((i) => i.name === "Pectic enzyme")!.unit).toBe("tsp");
    const yeast = out.items.find((i) => i.category === "yeast")!;
    expect(yeast.amount).toBe(1);
  });

  it("handles a wine (kit-style: juice concentrate + bentonite) end to end", () => {
    const out = buildShoppingList({
      batchSizeLiters: 20,
      fermentables: [{ name: "Concord Grape Concentrate", amountLiters: 12 }],
      yeasts: [{ name: "Lalvin EC-1118", form: "dry" }],
      additions: [
        { name: "Bentonite", amount: 2, unit: "tsp" },
        { name: "Campden tablet", amount: 2, unit: "tablet" },
      ],
    });
    expect(out.items.find((i) => i.name === "Concord Grape Concentrate")!.unit).toBe("L");
    expect(out.items.find((i) => i.name === "Concord Grape Concentrate")!.amount).toBe(12);
    expect(out.counts.additions).toBe(2);
    expect(out.counts.total).toBe(4);
  });
});

describe("buildShoppingList — empty input", () => {
  it("returns an empty list when the recipe has no ingredients", () => {
    const out = buildShoppingList({ batchSizeLiters: 20 });
    expect(out.items).toEqual([]);
    expect(out.counts).toEqual({
      fermentables: 0,
      hops: 0,
      yeast: 0,
      additions: 0,
      total: 0,
    });
    expect(out.recipeBatchSizeLiters).toBe(20);
  });
});

describe("sortShoppingItems", () => {
  it("sorts alphabetically by name, then detail", () => {
    const out = buildShoppingList({
      batchSizeLiters: 20,
      hops: [
        { name: "Zythos", amountGrams: 10, use: "boil" },
        { name: "Cascade", amountGrams: 20, use: "boil" },
        { name: "Cascade", amountGrams: 30, use: "whirlpool" },
      ],
    });
    const sorted = sortShoppingItems(out.items);
    const namesAndDetail = sorted.map((i) => `${i.name}|${i.detail}`);
    expect(namesAndDetail).toEqual([
      "Cascade|boil",
      "Cascade|whirlpool",
      "Zythos|boil",
    ]);
  });
});

describe("buildShoppingList — input shape checks", () => {
  it("returns plain JS objects the API can pass through", () => {
    const out = buildShoppingList({
      batchSizeLiters: 20,
      fermentables: [{ name: "Pale", amountKg: 4 }],
      hops: [{ name: "Cascade", amountGrams: 25, use: "boil" }],
      yeasts: [{ name: "US-05", form: "dry" }],
      additions: [{ name: "Irish Moss", amount: 1, unit: "tsp" }],
    });
    for (const item of out.items) {
      expect(typeof asRec(item).amount).toBe("number");
      expect(typeof item.name).toBe("string");
      expect(typeof item.unit).toBe("string");
      expect(typeof item.category).toBe("string");
    }
  });
});
