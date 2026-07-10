"use client";

// `ShoppingListSection` — BRE-15 + BRE-40.
//
// Renders the recipe's deduplicated shopping list. When `crossReference` is
// supplied (from `?includeInventory=true` on the API), every row also shows
// how much the brewer already has on hand and how much still needs buying,
// with a coloured status chip ("full" / "partial" / "missing"). Rows that
// are already covered by inventory are visually de-emphasised so the
// remaining shopping list is the focal point.

import Link from "next/link";

import {
  fmtBatchSize,
  fmtNumber,
  fmtShoppingAmount,
  hopUseLabel,
  shoppingCategoryLabel,
  titleCase,
} from "@/lib/ui/format";
import type {
  ShoppingList,
  ShoppingListCrossReference,
  ShoppingListItem,
  ShoppingListItemWithInventory,
  UnitSystem,
} from "@/lib/ui/types";
import { BasketGlyph, PrintGlyph } from "@/components/icons";

interface ShoppingListSectionProps {
  shoppingList: ShoppingList | null;
  units: UnitSystem;
  error: string | null;
  recipeTitle: string;
  crossReference?: ShoppingListCrossReference | null;
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
  crossReference,
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

  // Build a quick lookup from the cross-reference so each shopping-list row
  // can find its inventory overlay in O(1). Falls back to "no data" when the
  // cross-reference wasn't requested.
  const overlayByKey = new Map<string, ShoppingListItemWithInventory>();
  if (crossReference) {
    for (const r of crossReference.rows) {
      overlayByKey.set(rowKey(r), r);
    }
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

  const toBuy = crossReference?.counts.toBuy ?? null;
  const total = shoppingList.counts.total;

  return (
    <section className="section no-print" aria-label="Shopping list" data-testid="shopping-list">
      <div className="section-title">
        <BasketGlyph className="h-5 w-5 text-[var(--accent)]" />
        Shopping list
        <span className="count">
          {total} item{total === 1 ? "" : "s"}
        </span>
        {toBuy != null ? (
          <span
            className="chip ml-1"
            data-testid="shopping-list-to-buy"
            data-to-buy={toBuy}
          >
            {toBuy} to buy
          </span>
        ) : null}
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

      {crossReference ? (
        <p
          className="mb-4 text-sm text-[var(--muted-foreground)]"
          data-testid="shopping-list-cross-summary"
        >
          Cross-referenced against your{" "}
          <Link
            href="/inventory"
            className="text-[var(--accent)] underline"
          >
            pantry inventory
          </Link>
          : {crossReference.counts.full} covered,{" "}
          {crossReference.counts.partial} partial,{" "}
          {crossReference.counts.missing} missing.
        </p>
      ) : null}

      {/* Print-only header (hidden on screen). */}
      <header className="mb-3 hidden print:block">
        <h2 className="font-display text-lg font-semibold">
          Shopping list — {recipeTitle}
        </h2>
        <p className="text-sm text-black">
          Batch: {fmtBatchSize(shoppingList.recipeBatchSizeLiters, null, units)} ·{" "}
          {total} item{total === 1 ? "" : "s"}
          {toBuy != null ? ` · ${toBuy} to buy` : ""}
        </p>
      </header>

      {total === 0 ? (
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
                    {crossReference ? (
                      <th className="text-right">On hand</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {grouped[cat].map((item, idx) => {
                    const overlay = overlayByKey.get(rowKey(item)) ?? null;
                    return (
                      <tr
                        key={`${cat}-${item.name}-${item.detail}-${idx}`}
                        data-testid={`shopping-list-row-${cat}-${idx}`}
                        data-status={overlay?.status ?? undefined}
                        className={
                          overlay?.status === "full"
                            ? "opacity-60"
                            : undefined
                        }
                      >
                        <td>
                          <span className="font-medium">{item.name}</span>
                          {item.detail ? (
                            <span className="ml-2 text-[0.7rem] uppercase tracking-wide text-[var(--muted-foreground)]">
                              {detailLabel(cat, item.detail)}
                            </span>
                          ) : null}
                          {overlay ? (
                            <StatusBadge status={overlay.status} />
                          ) : null}
                        </td>
                        <td className="num text-right">
                          <span className="font-mono">
                            {fmtShoppingAmount(
                              item.amount,
                              item.unit,
                              units,
                              item.imperialAmount ?? null,
                              item.imperialUnit ?? null,
                            )}
                          </span>
                          {overlay && overlay.stillNeed > 0 ? (
                            <div className="mt-0.5 text-[0.7rem] text-[var(--muted-foreground)]">
                              need {fmtNeedAmount(
                                overlay.stillNeed,
                                item.unit,
                                units,
                                item.imperialUnit ?? null,
                              )}
                            </div>
                          ) : null}
                        </td>
                        {crossReference ? (
                          <td className="num text-right text-[var(--muted-foreground)]">
                            {overlay ? (
                              <span className="font-mono">
                                {fmtNumber(overlay.onHand, 3)}
                                {item.unit ? ` ${item.unit}` : ""}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function rowKey(item: ShoppingListItem): string {
  return `${item.category}\u0001${item.name}\u0001${item.detail}\u0001${item.unit}`;
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

function fmtNeedAmount(
  amount: number,
  unit: string,
  units: UnitSystem,
  imperialUnit: string | null,
): string {
  if (unit === "kg" || unit === "L" || unit === "g") {
    // Re-use the canonical formatters so imperial conversions match the
    // shopping-list cell.
    return fmtShoppingAmount(amount, unit, units, null, imperialUnit);
  }
  const trimmed = (unit ?? "").trim();
  if (!trimmed) return fmtNumber(amount, 2);
  return `${fmtNumber(amount, 2)} ${trimmed}`;
}

function StatusBadge({
  status,
}: {
  status: "full" | "partial" | "missing";
}) {
  const label =
    status === "full" ? "in stock" : status === "partial" ? "partial" : "missing";
  return (
    <span
      className="ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-[1px] text-[0.65rem] font-semibold uppercase tracking-wide"
      data-testid={`status-${status}`}
      style={badgeStyle(status)}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: badgeColor(status) }}
      />
      {label}
    </span>
  );
}

function badgeColor(status: "full" | "partial" | "missing"): string {
  if (status === "full") return "var(--success-fg, #16a34a)";
  if (status === "partial") return "var(--warning-fg, #d97706)";
  return "var(--error-fg, #dc2626)";
}

function badgeStyle(status: "full" | "partial" | "missing"): React.CSSProperties {
  const color = badgeColor(status);
  return {
    color,
    borderColor: "color-mix(in srgb, " + color + " 35%, var(--border))",
    background: "color-mix(in srgb, " + color + " 8%, transparent)",
  };
}