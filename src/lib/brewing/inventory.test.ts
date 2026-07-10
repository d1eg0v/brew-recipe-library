// Pure-function tests for the inventory cross-reference (BRE-40).

import { describe, it, expect } from "vitest";

import {
  crossReferenceShoppingList,
  indexInventoryByKey,
  inventoryKeyForInventoryRow,
  inventoryKeyForShoppingItem,
  inventoryKeyToString,
  type InventoryRow,
  type ShoppingListRowWithInventory,
} from "./inventory";
import type { ShoppingListItem } from "./shoppingList";

function shoppingItem(
  partial: Partial<ShoppingListItem> & Pick<ShoppingListItem, "category" | "name" | "amount" | "unit">,
): ShoppingListItem {
  return {
    detail: "",
    ...partial,
  } as ShoppingListItem;
}

function row(item: ShoppingListItem): ShoppingListRowWithInventory {
  return {
    ...item,
    onHand: 0,
    stillNeed: item.amount,
    status: "missing",
    matchedInventoryIds: [],
  };
}

describe("inventoryKeyForShoppingItem", () => {
  it("normalises name, detail, and unit to trimmed lowercase", () => {
    const key = inventoryKeyForShoppingItem({
      category: "hops",
      name: "  Cascade ",
      detail: "Boil",
      unit: "G",
    });
    expect(key).toEqual({
      category: "hops",
      nameNormalized: "cascade",
      detailNormalized: "boil",
      unitNormalized: "g",
    });
  });

  it("treats missing/empty detail and unit as empty strings", () => {
    const key = inventoryKeyForShoppingItem({
      category: "fermentables",
      name: "Pale 2-Row",
      detail: "",
      unit: "",
    });
    expect(key.detailNormalized).toBe("");
    expect(key.unitNormalized).toBe("");
  });
});

describe("inventoryKeyForInventoryRow", () => {
  it("uses the same normalisation as the shopping-list key", () => {
    const a = inventoryKeyForShoppingItem({
      category: "yeast",
      name: "US-05",
      detail: "Dry",
      unit: "packets",
    });
    const b = inventoryKeyForInventoryRow({
      category: "yeast",
      name: "US-05",
      detail: "dry",
      unit: "packets",
      amountOnHand: 1,
    });
    expect(a).toEqual(b);
  });
});

describe("indexInventoryByKey", () => {
  it("groups rows sharing the same key into a list", () => {
    const inventory: InventoryRow[] = [
      { category: "fermentables", name: "Pale", detail: "", unit: "kg", amountOnHand: 4 },
      { category: "fermentables", name: "PALE", detail: "", unit: "kg", amountOnHand: 1 },
      { category: "hops", name: "Cascade", detail: "boil", unit: "g", amountOnHand: 25 },
    ];
    const idx = indexInventoryByKey(inventory);
    expect(idx.size).toBe(2);
    expect(idx.get("fermentables\u0001pale\u0001\u0001kg")).toHaveLength(2);
  });
});

describe("crossReferenceShoppingList", () => {
  const items: ShoppingListItem[] = [
    shoppingItem({
      category: "fermentables",
      name: "Pale 2-Row",
      amount: 4.5,
      unit: "kg",
      detail: "",
    }),
    shoppingItem({
      category: "hops",
      name: "Cascade",
      amount: 50,
      unit: "g",
      detail: "boil",
    }),
    shoppingItem({
      category: "yeast",
      name: "US-05",
      amount: 1,
      unit: "packets",
      detail: "dry",
    }),
    shoppingItem({
      category: "additions",
      name: "Irish Moss",
      amount: 1.5,
      unit: "tsp",
      detail: "",
    }),
  ];

  it("marks every row missing when inventory is empty", () => {
    const out = crossReferenceShoppingList(items, []);
    expect(out.rows).toHaveLength(4);
    expect(out.rows.every((r) => r.status === "missing")).toBe(true);
    expect(out.rows.every((r) => r.onHand === 0)).toBe(true);
    expect(out.rows.every((r) => r.stillNeed === r.amount)).toBe(true);
    expect(out.counts).toEqual({
      total: 4,
      full: 0,
      partial: 0,
      missing: 4,
      toBuy: 4,
    });
  });

  it("marks a row full when onHand >= required", () => {
    const out = crossReferenceShoppingList(items, [
      { category: "fermentables", name: "Pale 2-Row", detail: "", unit: "kg", amountOnHand: 5 },
      { category: "hops", name: "Cascade", detail: "boil", unit: "g", amountOnHand: 50 },
      { category: "yeast", name: "US-05", detail: "dry", unit: "packets", amountOnHand: 2 },
      { category: "additions", name: "Irish Moss", detail: "", unit: "tsp", amountOnHand: 1.5 },
    ]);
    expect(out.rows.map((r) => r.status)).toEqual([
      "full",
      "full",
      "full",
      "full",
    ]);
    expect(out.counts).toEqual({
      total: 4,
      full: 4,
      partial: 0,
      missing: 0,
      toBuy: 0,
    });
  });

  it("clamps stillNeed to zero when onHand overshoots required", () => {
    const out = crossReferenceShoppingList(items.slice(0, 1), [
      { category: "fermentables", name: "Pale 2-Row", detail: "", unit: "kg", amountOnHand: 9.2 },
    ]);
    expect(out.rows[0].onHand).toBeCloseTo(9.2, 4);
    expect(out.rows[0].stillNeed).toBe(0);
    expect(out.rows[0].status).toBe("full");
  });

  it("reports partial when onHand covers some but not all", () => {
    const out = crossReferenceShoppingList(items, [
      { category: "fermentables", name: "Pale 2-Row", detail: "", unit: "kg", amountOnHand: 2 },
      { category: "hops", name: "Cascade", detail: "boil", unit: "g", amountOnHand: 25 },
      { category: "yeast", name: "US-05", detail: "dry", unit: "packets", amountOnHand: 0 },
      { category: "additions", name: "Irish Moss", detail: "", unit: "tsp", amountOnHand: 1.5 },
    ]);
    expect(out.rows[0]).toMatchObject({ status: "partial", onHand: 2, stillNeed: 2.5 });
    expect(out.rows[1]).toMatchObject({ status: "partial", onHand: 25, stillNeed: 25 });
    expect(out.rows[2]).toMatchObject({ status: "missing", onHand: 0, stillNeed: 1 });
    expect(out.rows[3]).toMatchObject({ status: "full", onHand: 1.5, stillNeed: 0 });
    expect(out.counts).toEqual({
      total: 4,
      full: 1,
      partial: 2,
      missing: 1,
      toBuy: 3,
    });
  });

  it("treats case-insensitive matches as the same key", () => {
    const out = crossReferenceShoppingList(items.slice(0, 2), [
      { category: "fermentables", name: "  PALE 2-ROW  ", detail: "", unit: "KG", amountOnHand: 10 },
      { category: "hops", name: "cascade", detail: "BOIL", unit: "G", amountOnHand: 50 },
    ]);
    expect(out.rows[0].status).toBe("full");
    expect(out.rows[1].status).toBe("full");
  });

  it("does not cross-match different detail or unit", () => {
    const out = crossReferenceShoppingList(items.slice(1, 3), [
      // Cascade DRY-HOP should not count toward Cascade BOIL.
      { category: "hops", name: "Cascade", detail: "dryHop", unit: "g", amountOnHand: 100 },
      // Cascade pellet form only (no such unit in the shopping list).
      { category: "hops", name: "Cascade", detail: "boil", unit: "oz", amountOnHand: 100 },
    ]);
    expect(out.rows[0]).toMatchObject({ status: "missing", onHand: 0, stillNeed: 50 });
    expect(out.rows[1]).toMatchObject({ status: "missing", onHand: 0, stillNeed: 1 });
  });

  it("sums onHand across multiple inventory rows that share a key", () => {
    const idx = indexInventoryByKey([
      { category: "fermentables", name: "Pale", detail: "", unit: "kg", amountOnHand: 1.5 },
      { category: "fermentables", name: "Pale", detail: "", unit: "kg", amountOnHand: 2 },
    ]);
    const lookup = idx;
    expect(lookup.get(inventoryKeyToString({
      category: "fermentables",
      nameNormalized: "pale",
      detailNormalized: "",
      unitNormalized: "kg",
    }))).toHaveLength(2);

    const out = crossReferenceShoppingList(
      [shoppingItem({ category: "fermentables", name: "Pale", amount: 5, unit: "kg" })],
      [
        { category: "fermentables", name: "Pale", detail: "", unit: "kg", amountOnHand: 1.5 },
        { category: "fermentables", name: "Pale", detail: "", unit: "kg", amountOnHand: 2 },
      ],
    );
    expect(out.rows[0]).toMatchObject({ status: "partial", onHand: 3.5, stillNeed: 1.5 });
  });

  it("treats non-finite / negative onHand as zero (missing)", () => {
    const out = crossReferenceShoppingList(
      [shoppingItem({ category: "fermentables", name: "Pale", amount: 4, unit: "kg" })],
      // Cast through unknown to simulate DB-supplied NaN / negative garbage.
      [
        { category: "fermentables", name: "Pale", detail: "", unit: "kg", amountOnHand: Number.NaN },
        { category: "fermentables", name: "Pale", detail: "", unit: "kg", amountOnHand: -2 },
      ] as unknown as InventoryRow[],
    );
    expect(out.rows[0].onHand).toBe(0);
    expect(out.rows[0].status).toBe("missing");
  });

  it("preserves every original shopping-list field on the output row", () => {
    const out = crossReferenceShoppingList(items, []);
    for (const r of out.rows) {
      const original = items.find(
        (i) =>
          i.category === r.category &&
          i.name === r.name &&
          i.detail === r.detail &&
          i.unit === r.unit,
      );
      expect(original).toBeDefined();
      // Original fields kept.
      expect(r.amount).toBe(original!.amount);
      expect(r.unit).toBe(original!.unit);
      expect(r.category).toBe(original!.category);
      expect(r.detail).toBe(original!.detail);
      // New fields present.
      expect(typeof r.onHand).toBe("number");
      expect(typeof r.stillNeed).toBe("number");
      expect(["full", "partial", "missing"]).toContain(r.status);
      expect(Array.isArray(r.matchedInventoryIds)).toBe(true);
    }
  });
});

describe("crossReferenceShoppingList — empty shopping list", () => {
  it("returns zero counts when given no rows", () => {
    const out = crossReferenceShoppingList([], [
      { category: "fermentables", name: "Pale", detail: "", unit: "kg", amountOnHand: 5 },
    ]);
    expect(out.rows).toEqual([]);
    expect(out.counts).toEqual({
      total: 0,
      full: 0,
      partial: 0,
      missing: 0,
      toBuy: 0,
    });
  });
});

// Sanity check that the helper itself produces deterministic string keys.
describe("inventoryKeyToString", () => {
  it("joins fields with a separator that won't appear in normalised names", () => {
    const k = inventoryKeyToString({
      category: "yeast",
      nameNormalized: "us-05",
      detailNormalized: "dry",
      unitNormalized: "packets",
    });
    expect(k).toBe("yeast\u0001us-05\u0001dry\u0001packets");
    expect(k.split("\u0001")).toHaveLength(4);
  });
});

// row() is the helper that builds the expected shape for the missing baseline
// — make sure the wiring matches what the calc actually returns.
describe("row() helper sanity", () => {
  it("matches the calc's missing-state output for a 3 kg grain requirement", () => {
    const out = crossReferenceShoppingList(
      [shoppingItem({ category: "fermentables", name: "Munich", amount: 3, unit: "kg" })],
      [],
    );
    expect(out.rows[0]).toEqual(
      row(
        shoppingItem({
          category: "fermentables",
          name: "Munich",
          amount: 3,
          unit: "kg",
        }),
      ),
    );
  });
});