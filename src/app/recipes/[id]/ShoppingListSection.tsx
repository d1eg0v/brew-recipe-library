"use client";

import {
  fmtBatchSize,
  fmtShoppingAmount,
  hopUseLabel,
  shoppingCategoryLabel,
  titleCase,
} from "@/lib/ui/format";
import type {
  ShoppingList,
  ShoppingListItem,
  UnitSystem,
} from "@/lib/ui/types";
import { BasketGlyph, PrintGlyph } from "@/components/icons";

interface ShoppingListSectionProps {
  shoppingList: ShoppingList | null;
  units: UnitSystem;
  error: string | null;
  recipeTitle: string;
}

const CATEGORY_ORDER: ShoppingListItem["category"][] = [
  "fermentables",
  "hops",
  "yeast",
  "additions",
];

export default function ShoppingListSection({
  shoppingList,
  units,
  error,
  recipeTitle,
}: ShoppingListSectionProps) {
  if (error) {
    return (
      <section
        className="section no-print"
        data-testid="shopping-list-error"
        role="alert"
      >
        <div className="section-title">
          <BasketGlyph className="h-5 w-5 text-[var(--accent)]" />
          Shopping list
        </div>
        <p className="text-sm text-[var(--error-fg)]">
          Couldn&apos;t reload shopping list: {error}
        </p>
      </section>
    );
  }
  if (!shoppingList) {
    return (
      <section className="section no-print" data-testid="shopping-list-empty">
        <div className="section-title">
          <BasketGlyph className="h-5 w-5 text-[var(--accent)]" />
          Shopping list
        </div>
        <p className="text-sm italic text-[var(--muted-foreground)]">
          No shopping list available for this recipe yet.
        </p>
      </section>
    );
  }

  const grouped: Record<ShoppingListItem["category"], ShoppingListItem[]> = {
    fermentables: [],
    hops: [],
    yeast: [],
    additions: [],
  };
  for (const item of shoppingList.items) {
    grouped[item.category].push(item);
  }
  for (const cat of CATEGORY_ORDER) {
    grouped[cat] = sortItemsForDisplay(grouped[cat]);
  }

  return (
    <section className="section no-print" aria-label="Shopping list" data-testid="shopping-list">
      <div className="section-title">
        <BasketGlyph className="h-5 w-5 text-[var(--accent)]" />
        Shopping list
        <span className="count">
          {shoppingList.counts.total} item{shoppingList.counts.total === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          aria-label="Print shopping list"
          onClick={() => {
            if (typeof window !== "undefined") window.print();
          }}
          className="btn btn-outline btn-sm ml-auto no-print"
        >
          <PrintGlyph className="h-4 w-4" />
          Print
        </button>
      </div>

      {/* Print-only header (hidden on screen). */}
      <header className="mb-3 hidden print:block">
        <h2 className="font-display text-lg font-semibold">
          Shopping list — {recipeTitle}
        </h2>
        <p className="text-sm text-black">
          Batch: {fmtBatchSize(shoppingList.recipeBatchSizeLiters, null, units)} ·{" "}
          {shoppingList.counts.total} item
          {shoppingList.counts.total === 1 ? "" : "s"}
        </p>
      </header>

      {shoppingList.counts.total === 0 ? (
        <p
          className="text-sm italic text-[var(--muted-foreground)] print:text-black"
          data-testid="shopping-list-no-items"
        >
          Nothing to buy — this recipe has no ingredients listed.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {CATEGORY_ORDER.filter((cat) => grouped[cat].length > 0).map((cat) => (
            <div key={cat} data-testid={`shopping-list-cat-${cat}`}>
              <div className="eyebrow-rule mb-2">
                {shoppingCategoryLabel(cat)}
                <span className="chip-count font-mono">{grouped[cat].length}</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[cat].map((item, idx) => (
                    <tr key={`${cat}-${item.name}-${item.detail}-${idx}`}>
                      <td>
                        <span className="font-medium">{item.name}</span>
                        {item.detail ? (
                          <span className="ml-2 text-[0.7rem] uppercase tracking-wide text-[var(--muted-foreground)]">
                            {detailLabel(cat, item.detail)}
                          </span>
                        ) : null}
                      </td>
                      <td className="num text-right">
                        {fmtShoppingAmount(
                          item.amount,
                          item.unit,
                          units,
                          item.imperialAmount ?? null,
                          item.imperialUnit ?? null,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function sortItemsForDisplay(items: ShoppingListItem[]): ShoppingListItem[] {
  return [...items].sort((a, b) => {
    const n = a.name.localeCompare(b.name);
    if (n !== 0) return n;
    return a.detail.localeCompare(b.detail);
  });
}

function detailLabel(
  category: ShoppingListItem["category"],
  detail: string,
): string {
  if (!detail) return "";
  if (category === "hops") return hopUseLabel(detail) ?? titleCase(detail);
  if (category === "yeast") return yeastDetailLabel(detail);
  return detail;
}

function yeastDetailLabel(detail: string): string {
  switch (detail) {
    case "dry":
      return "Dry";
    case "liquid":
      return "Liquid";
    case "slant":
      return "Slant";
    case "culture":
      return "Culture";
    default:
      return titleCase(detail);
  }
}
