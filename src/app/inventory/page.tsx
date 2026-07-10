// `/inventory` — manage on-hand brewing ingredients (BRE-40).
//
// Server-rendered shell that lists the brewer's pantry grouped by category and
// hands editing off to a client component (`<InventoryTable />`). The page
// owns the SSR fetch + the initial empty-state copy; the table owns the
// add/edit/delete interactions.

import Link from "next/link";

import {
  ArrowGlyph,
} from "@/components/icons";
import { INVENTORY_CATEGORIES } from "@/lib/api/schemas";
import {
  fmtNumber,
  shoppingCategoryLabel,
} from "@/lib/ui/format";
import type {
  InventoryCategory,
  InventoryListResponse,
} from "@/lib/ui/types";

import InventoryTable from "./InventoryTable";

export const dynamic = "force-dynamic";

async function fetchInventory(
  base: string,
): Promise<{ items: InventoryListResponse["data"]; error: string | null }> {
  try {
    const res = await fetch(new URL("/api/inventory", base), {
      cache: "no-store",
    });
    if (!res.ok) {
      return { items: [], error: `request failed: ${res.status}` };
    }
    const body = (await res.json()) as InventoryListResponse;
    return { items: body.data, error: null };
  } catch (err) {
    return {
      items: [],
      error: err instanceof Error ? err.message : "failed to load inventory",
    };
  }
}

export default async function InventoryPage() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const { items, error } = await fetchInventory(base);

  const counts = INVENTORY_CATEGORIES.reduce<Record<InventoryCategory, number>>(
    (acc, c) => {
      acc[c] = items.filter((i) => i.category === c).length;
      return acc;
    },
    {
      fermentables: 0,
      hops: 0,
      yeast: 0,
      additions: 0,
    },
  );

  return (
    <div>
      {/* ---------------------------------------------------------- */}
      {/*  Hero                                                       */}
      {/* ---------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--surface-2)]/50">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            background:
              "radial-gradient(640px 300px at 8% -20%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-10 sm:py-14">
          <nav className="mb-5">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--muted-foreground)] no-underline hover:text-[var(--foreground)]"
            >
              <ArrowGlyph className="h-3.5 w-3.5 rotate-180" />
              All recipes
            </Link>
          </nav>
          <p className="label-eyebrow">Pantry</p>
          <h1 className="font-display mt-3 text-4xl sm:text-5xl font-semibold tracking-tight text-[var(--foreground)]">
            Ingredient inventory
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted-foreground)]">
            Track what&apos;s on hand in your fermenting pantry. The shopping
            list on any recipe will cross-reference this to show what you still
            need to buy.
          </p>
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
            {INVENTORY_CATEGORIES.map((c) => (
              <span key={c}>
                <span className="font-mono text-[var(--foreground)]">
                  {fmtNumber(counts[c], 0)}
                </span>{" "}
                {shoppingCategoryLabel(c)}
              </span>
            ))}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {error ? (
          <section
            className="section"
            data-testid="inventory-error"
            role="alert"
          >
            <p className="text-sm text-[var(--error-fg)]">
              Couldn&apos;t load inventory: {error}
            </p>
          </section>
        ) : (
          <InventoryTable initialItems={items} />
        )}
      </div>
    </div>
  );
}