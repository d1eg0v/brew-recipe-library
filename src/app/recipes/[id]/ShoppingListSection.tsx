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
        className="rounded-lg border border-red-300 bg-red-50 p-5 text-sm text-red-900 print:hidden"
        data-testid="shopping-list-error"
      >
        Couldn&apos;t reload shopping list: {error}
      </section>
    );
  }
  if (!shoppingList) {
    return (
      <section
        className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 print:hidden"
        data-testid="shopping-list-empty"
      >
        <h2 className="text-base font-semibold mb-2">Shopping list</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
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
    <section
      className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 space-y-4 print:border-black print:bg-white print:rounded-none"
      aria-label="Shopping list"
      data-testid="shopping-list"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3 print:hidden">
        <h2 className="text-base font-semibold">
          Shopping list{" "}
          <span className="text-sm font-normal text-[var(--muted-foreground)]">
            ({shoppingList.counts.total} item
            {shoppingList.counts.total === 1 ? "" : "s"})
          </span>
        </h2>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") window.print();
          }}
          className="px-3 py-2 rounded-md border border-[var(--border)] text-sm hover:bg-[var(--muted)]"
        >
          Print shopping list
        </button>
      </div>

      {/* Print-only header (hidden on screen). */}
      <header className="hidden print:block mb-2">
        <h2 className="text-lg font-semibold">Shopping list — {recipeTitle}</h2>
        <p className="text-sm text-black">
          Batch: {fmtBatchSize(shoppingList.recipeBatchSizeLiters, null, units)} ·{" "}
          {shoppingList.counts.total} item
          {shoppingList.counts.total === 1 ? "" : "s"}
        </p>
      </header>

      {shoppingList.counts.total === 0 ? (
        <p
          className="text-sm text-[var(--muted-foreground)] print:text-black"
          data-testid="shopping-list-no-items"
        >
          Nothing to buy — this recipe has no ingredients listed.
        </p>
      ) : (
        CATEGORY_ORDER.filter((cat) => grouped[cat].length > 0).map((cat) => (
          <div key={cat} className="space-y-2" data-testid={`shopping-list-cat-${cat}`}>
            <h3 className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium print:text-black">
              {shoppingCategoryLabel(cat)}{" "}
              <span className="text-[var(--muted-foreground)] print:text-black">
                ({grouped[cat].length})
              </span>
            </h3>
            <table className="w-full text-sm print:text-black">
              <thead>
                <tr>
                  <th className="text-left pb-1 font-medium text-[var(--muted-foreground)] print:text-black">
                    Item
                  </th>
                  <th className="text-right pb-1 font-medium text-[var(--muted-foreground)] w-32 print:text-black">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {grouped[cat].map((item, idx) => (
                  <tr
                    key={`${cat}-${item.name}-${item.detail}-${idx}`}
                    className="border-t border-[var(--border)] print:border-black"
                  >
                    <td className="py-1.5 pr-3">
                      <span className="font-medium">{item.name}</span>
                      {item.detail ? (
                        <span className="ml-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)] print:text-black">
                          {detailLabel(cat, item.detail)}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono">
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
        ))
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
