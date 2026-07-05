// Shopping-list builder.
//
// Turns an already-presented (post-scaling, post-unit-conversion) recipe into a
// flat, deduplicated list of items a brewer needs to purchase. The builder is
// intentionally pure and dependency-free — it consumes the same shape the
// `/api/recipes/[id]` route already returns, so the API route can just run
// `presentRecipe` first and then `buildShoppingList`.
//
// Aggregation rules (matching the Helper Agent scope for BRE-15):
//
// - Fermentables: group by lowercase `name`. A row keyed on `amountKg`
//   (solid) and a row keyed on `amountLiters` (liquid) for the same
//   ingredient stay separate — kg and L are not force-converted.
// - Hops: group by (lowercase `name`, lowercase `use`). Boil and dry-hop
//   additions of the same hop stay separate because home brewers buy
//   different quantities for them.
// - Yeast: each `Yeast` row represents one packet. The packet count shown
//   next to each unique yeast scales with batch size: ceil(batchL / 20).
//   Same `(name, form)` collapses; different `form` (dry vs liquid) stays
//   separate.
// - Additions: group by (lowercase `name`, lowercase `unit` or ""). Same
//   name with different units stays separate (we can't safely convert
//   "1 tsp" + "2 g").
//
// The builder never mutates the input.

import { roundTo } from "./units";

/** Source shapes for each ingredient collection, as the presented recipe carries them. */
export interface ShoppingFermentable {
  name: string;
  amountKg?: number | null;
  amountLiters?: number | null;
}

export interface ShoppingHop {
  name: string;
  amountGrams: number;
  use?: string | null;
}

export interface ShoppingYeast {
  name: string;
  form?: string | null;
}

export interface ShoppingAddition {
  name: string;
  amount?: number | null;
  unit?: string | null;
}

/** Everything `buildShoppingList` needs from a presented recipe. */
export interface ShoppingListInput {
  batchSizeLiters: number;
  fermentables?: ShoppingFermentable[];
  hops?: ShoppingHop[];
  yeasts?: ShoppingYeast[];
  additions?: ShoppingAddition[];
}

/** One row in the produced shopping list. */
export interface ShoppingListItem {
  /** Group key: category slug used to render sections in the UI. */
  category: "fermentables" | "hops" | "yeast" | "additions";
  /** Canonical, display-cased ingredient name taken from the first occurrence. */
  name: string;
  /** Aggregated numeric quantity — read with `unit` (imperial is layered on by API). */
  amount: number;
  /** Unit for `amount`. For fermentables this is "kg" or "L"; for hops "g"; for additions the row's unit (or "" if none). */
  unit: string;
  /** Sub-bucket key — for hops the use (boil, dryHop, …); for yeast the form; "" otherwise. */
  detail: string;
}

/** Full produced shopping list, ready for the UI. */
export interface ShoppingList {
  recipeBatchSizeLiters: number;
  items: ShoppingListItem[];
  /** Convenience counts for UI summaries. */
  counts: {
    fermentables: number;
    hops: number;
    yeast: number;
    additions: number;
    total: number;
  };
}

// ---------- helpers ----------

const norm = (s: string | null | undefined) =>
  (s ?? "").trim().toLowerCase();

function titleCase(value: string | null | undefined): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Round to 4 dp — keeps printed output tidy and stable across runs. */
function tidy(n: number): number {
  return roundTo(n, 4);
}

// ---------- aggregators ----------

interface BucketRow {
  amount: number;
  /** First-seen display name (cased as in the recipe). */
  displayName: string;
  detail: string;
}

function bucket(): Map<string, BucketRow> {
  return new Map();
}

function addTo(
  map: Map<string, BucketRow>,
  key: string,
  amount: number,
  displayName: string,
  detail: string,
) {
  const prev = map.get(key);
  if (prev) {
    prev.amount = tidy(prev.amount + amount);
  } else {
    map.set(key, { amount: tidy(amount), displayName, detail });
  }
}

// ---------- builders per category ----------

function aggregateFermentables(input: ShoppingListInput): ShoppingListItem[] {
  const map = bucket();
  for (const f of input.fermentables ?? []) {
    const name = norm(f.name);
    if (!name) continue;
    if (typeof f.amountKg === "number" && f.amountKg > 0) {
      addTo(map, `${name}\u0001kg`, f.amountKg, f.name, "");
    }
    if (typeof f.amountLiters === "number" && f.amountLiters > 0) {
      addTo(map, `${name}\u0001l`, f.amountLiters, f.name, "");
    }
  }
  return Array.from(map.entries()).map(([key, row]) => {
    const unit = key.endsWith("\u0001kg") ? "kg" : "L";
    return {
      category: "fermentables",
      name: row.displayName,
      amount: row.amount,
      unit,
      detail: "",
    } satisfies ShoppingListItem;
  });
}

function aggregateHops(input: ShoppingListInput): ShoppingListItem[] {
  const map = bucket();
  for (const h of input.hops ?? []) {
    const name = norm(h.name);
    if (!name) continue;
    if (typeof h.amountGrams !== "number" || !Number.isFinite(h.amountGrams) || h.amountGrams <= 0) {
      continue;
    }
    const use = norm(h.use);
    addTo(map, `${name}\u0001${use}`, h.amountGrams, h.name, use);
  }
  return Array.from(map.values()).map(
    (row) =>
      ({
        category: "hops",
        name: row.displayName,
        amount: row.amount,
        unit: "g",
        detail: row.detail,
      }) satisfies ShoppingListItem,
  );
}

function aggregateYeasts(
  input: ShoppingListInput,
): ShoppingListItem[] {
  const packets = Math.max(1, Math.ceil((input.batchSizeLiters || 0) / 20));
  const map = bucket();
  for (const y of input.yeasts ?? []) {
    const name = norm(y.name);
    if (!name) continue;
    const form = norm(y.form);
    addTo(map, `${name}\u0001${form}`, packets, y.name, form);
  }
  return Array.from(map.values()).map(
    (row) =>
      ({
        category: "yeast",
        name: row.displayName,
        amount: row.amount,
        unit: "packets",
        detail: row.detail,
      }) satisfies ShoppingListItem,
  );
}

function aggregateAdditions(input: ShoppingListInput): ShoppingListItem[] {
  const map = bucket();
  for (const a of input.additions ?? []) {
    const name = norm(a.name);
    if (!name) continue;
    if (typeof a.amount !== "number" || !Number.isFinite(a.amount) || a.amount <= 0) {
      continue;
    }
    const unit = (a.unit ?? "").trim();
    const unitKey = norm(unit);
    addTo(map, `${name}\u0001${unitKey}`, a.amount, a.name, unitKey);
  }
  return Array.from(map.values()).map(
    (row) =>
      ({
        category: "additions",
        name: row.displayName,
        amount: row.amount,
        unit: row.detail || "",
        detail: "",
      }) satisfies ShoppingListItem,
  );
}

// ---------- public entry point ----------

/**
 * Build the deduplicated, scaled shopping list for an already-presented recipe.
 * The input is the response of `presentRecipe(recipe, { batchSize, units })`,
 * so the recipe's `batchSizeLiters` and the per-ingredient amounts are already
 * in the units the caller wants to display.
 */
export function buildShoppingList(input: ShoppingListInput): ShoppingList {
  const fermentables = aggregateFermentables(input);
  const hops = aggregateHops(input);
  const yeasts = aggregateYeasts(input);
  const additions = aggregateAdditions(input);

  const items: ShoppingListItem[] = [
    ...fermentables,
    ...hops,
    ...yeasts,
    ...additions,
  ];

  return {
    recipeBatchSizeLiters: tidy(input.batchSizeLiters ?? 0),
    items,
    counts: {
      fermentables: fermentables.length,
      hops: hops.length,
      yeast: yeasts.length,
      additions: additions.length,
      total: items.length,
    },
  };
}

/** Sort an item list within a category for the print view (alphabetical). */
export function sortShoppingItems(
  items: ShoppingListItem[],
): ShoppingListItem[] {
  return [...items].sort((a, b) => {
    const n = a.name.localeCompare(b.name);
    if (n !== 0) return n;
    return a.detail.localeCompare(b.detail);
  });
}

/** Re-exported so consumers don't need to import units separately. */
export { titleCase };
