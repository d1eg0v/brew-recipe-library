// Inventory cross-reference (BRE-40).
//
// Pure, dependency-free helpers for matching a recipe's shopping list against
// the brewer's on-hand pantry inventory. The shopping-list builder
// (`./shoppingList`) already buckets ingredients by
// (lowercase name, lowercase detail, unit) — this module reuses the same key
// shape so an inventory row plugs straight into a shopping-list row.
//
// Two responsibilities live here:
//   1. `inventoryKeyForShoppingItem` — produces the (category, name, detail,
//      unit) key tuple both sides agree on, so the API / UI layers can build
//      a lookup without re-implementing the normalisation.
//   2. `crossReferenceShoppingList` — given a shopping list and the brewer's
//      on-hand inventory, returns one `ShoppingListRowWithInventory` per
//      shopping-list row carrying `onHand`, `stillNeed`, and a `status` flag
//      ("full" | "partial" | "missing"). The shape is intentionally additive:
//      it preserves every field on the original `ShoppingListItem` and layers
//      inventory on top, so existing clients ignore the new fields without
//      any branching.
//
// Numbers are clamped to >= 0 — overshoot (more on hand than needed) is
// reported as `status: "full"` and `stillNeed: 0`, never a negative amount.

import { roundTo } from "./units";
import type { ShoppingListItem } from "./shoppingList";

/** Allowed inventory categories — must match the DB model. */
export const INVENTORY_CATEGORIES = [
  "fermentables",
  "hops",
  "yeast",
  "additions",
] as const;
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

/** A pantry stock row, as stored / surfaced by the inventory API. */
export interface InventoryRow {
  category: InventoryCategory;
  /** Display name (any case). */
  name: string;
  /** Hop use / yeast form / addition unit / "". */
  detail: string;
  /** "kg", "g", "L", "packets", "tsp", "tablet", … */
  unit: string;
  amountOnHand: number;
}

/** The composite key used to match an inventory row to a shopping-list row. */
export interface InventoryKey {
  category: InventoryCategory;
  nameNormalized: string;
  detailNormalized: string;
  unitNormalized: string;
}

/** Cross-reference status. */
export type InventoryStatus = "full" | "partial" | "missing";

/**
 * One shopping-list row, with on-hand pantry data layered on. The original
 * shopping-list fields are preserved; the new fields sit alongside.
 */
export interface ShoppingListRowWithInventory extends ShoppingListItem {
  /** Quantity on hand for this row (0 when none is recorded). */
  onHand: number;
  /** How much still needs buying: max(0, required − onHand). */
  stillNeed: number;
  /** "full" when onHand >= required; "partial" when 0 < onHand < required; "missing" when onHand == 0. */
  status: InventoryStatus;
  /** Inventory row id(s) that contributed to `onHand` (more than one row can
   *  share a key in theory — the unique index prevents it, but the consumer
   *  may have filtered, so we surface what matched). Empty when no row hit. */
  matchedInventoryIds: string[];
}

export interface ShoppingListWithInventory {
  rows: ShoppingListRowWithInventory[];
  /** Convenience counts for UI summaries. */
  counts: {
    total: number;
    full: number;
    partial: number;
    missing: number;
    /** Number of rows that still require a purchase (partial + missing). */
    toBuy: number;
  };
}

// ---------- helpers ----------

/** Lower-case + trim — same normalisation the shopping-list builder uses. */
const norm = (s: string | null | undefined): string =>
  (s ?? "").trim().toLowerCase();

/**
 * Public version of the same normalisation. Exported for API layers that
 * need to rebuild the unique key on update (e.g. PATCH /api/inventory/[id]
 * recomputing the canonical name/detail/unit from the incoming payload so a
 * rename keeps the unique index in sync).
 */
export const normaliseForKey = norm;

/**
 * The unique lookup key for a single shopping-list row. The shopping-list
 * builder already enforces (category, lowercase name, lowercase detail, unit),
 * so this is just a stable, exported version of that shape — consumers
 * (API, UI) use it to build a `Map<key, InventoryRow[]>` for O(1) lookup.
 */
export function inventoryKeyForShoppingItem(
  item: Pick<ShoppingListItem, "category" | "name" | "detail" | "unit">,
): InventoryKey {
  return {
    category: item.category,
    nameNormalized: norm(item.name),
    detailNormalized: norm(item.detail),
    unitNormalized: norm(item.unit),
  };
}

/** Same key shape but for an arbitrary inventory row (e.g. one fetched from
 *  the API). Useful when the caller wants to verify a DB row maps to a
 *  shopping-list row before saving it. */
export function inventoryKeyForInventoryRow(row: InventoryRow): InventoryKey {
  return {
    category: row.category,
    nameNormalized: norm(row.name),
    detailNormalized: norm(row.detail),
    unitNormalized: norm(row.unit),
  };
}

/** Convenience: render a key as a string so callers can `Map.set(key, …)`. */
export function inventoryKeyToString(key: InventoryKey): string {
  return `${key.category}\u0001${key.nameNormalized}\u0001${key.detailNormalized}\u0001${key.unitNormalized}`;
}

/** Build a string-keyed lookup from a flat inventory list. Multiple rows can
 *  match the same string key (the DB unique index prevents this on a single
 *  write, but bulk imports / test fixtures may not enforce it). */
export function indexInventoryByKey(
  inventory: readonly InventoryRow[],
): Map<string, Array<InventoryRow & { id?: string }>> {
  const map = new Map<string, Array<InventoryRow & { id?: string }>>();
  for (const row of inventory) {
    const key = inventoryKeyToString(inventoryKeyForInventoryRow(row));
    const arr = map.get(key);
    if (arr) arr.push(row);
    else map.set(key, [row]);
  }
  return map;
}

// ---------- public entry point ----------

/**
 * Cross-reference a shopping list against the brewer's on-hand inventory.
 *
 * For every shopping-list row, sum the matching inventory rows' `amountOnHand`
 * (clamped to >= 0). Compute `stillNeed = max(0, required - onHand)` and
 * classify the status. Rows with no matching inventory are reported as
 * `status: "missing"` with `onHand: 0`.
 */
export function crossReferenceShoppingList(
  items: readonly ShoppingListItem[],
  inventory: readonly InventoryRow[],
): ShoppingListWithInventory {
  const lookup = indexInventoryByKey(inventory);

  const rows: ShoppingListRowWithInventory[] = items.map((item) => {
    const key = inventoryKeyToString(inventoryKeyForShoppingItem(item));
    const matches = lookup.get(key) ?? [];
    const onHandRaw = matches.reduce(
      (sum, r) => sum + (Number.isFinite(r.amountOnHand) ? r.amountOnHand : 0),
      0,
    );
    const onHand = Math.max(0, onHandRaw);
    const required = Math.max(0, item.amount);
    const stillNeed = Math.max(0, roundTo(required - onHand, 4));
    const status: InventoryStatus =
      onHand <= 0 ? "missing" : onHand >= required ? "full" : "partial";
    return {
      ...item,
      onHand: roundTo(onHand, 4),
      stillNeed,
      status,
      matchedInventoryIds: matches
        .map((m) => (typeof m.id === "string" ? m.id : null))
        .filter((id): id is string => id !== null),
    };
  });

  let full = 0;
  let partial = 0;
  let missing = 0;
  for (const r of rows) {
    if (r.status === "full") full++;
    else if (r.status === "partial") partial++;
    else missing++;
  }

  return {
    rows,
    counts: {
      total: rows.length,
      full,
      partial,
      missing,
      toBuy: partial + missing,
    },
  };
}