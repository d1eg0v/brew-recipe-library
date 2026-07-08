// Server-rendered page for the side-by-side recipe comparison view (BRE-36).
//
// Two query params select the recipes to compare:
//   - a  required when comparing; recipe id
//   - b  required when comparing; recipe id
//
// When neither `a` nor `b` is supplied the page renders a small picker
// (two `<select>`s) that submits to itself with the chosen ids. We refuse
// to compare a recipe against itself. Unknown ids surface a friendly
// "not found" message and re-offer the picker — same pattern as
// `/abv?recipeId=…`.

import Link from "next/link";

import CompareClient from "./CompareClient";
import ComparePicker from "./ComparePicker";
import { prisma } from "@/lib/db";
import { presentRecipe } from "@/lib/api/present";
import { recipeDetailQuerySchema } from "@/lib/api/schemas";
import type { RecipeDetail, UnitSystem } from "@/lib/ui/types";
import { HopMark } from "@/components/icons";

export const dynamic = "force-dynamic";

interface ComparePageProps {
  searchParams: Promise<{
    a?: string;
    b?: string;
    units?: string;
    batchSize?: string;
  }>;
}

function parseId(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptions(unitsRaw: string | undefined, batchSizeRaw: string | undefined): {
  units: UnitSystem;
  batchSize: number | undefined;
} {
  const units: UnitSystem = unitsRaw === "imperial" ? "imperial" : "metric";
  let batchSize: number | undefined;
  if (batchSizeRaw) {
    const parsed = Number.parseFloat(batchSizeRaw);
    if (Number.isFinite(parsed) && parsed > 0) batchSize = parsed;
  }
  // Validate via the same schema the API uses; ignore failures (best-effort
  // page-level parsing — the API does the authoritative validation).
  recipeDetailQuerySchema.safeParse({
    batchSize: batchSize ?? undefined,
    units,
  });
  return { units, batchSize };
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const sp = await searchParams;
  const aId = parseId(sp.a);
  const bId = parseId(sp.b);
  const { units, batchSize } = parseOptions(sp.units, sp.batchSize);

  if (!aId && !bId) {
    return <CompareLayout><ComparePicker /></CompareLayout>;
  }

  if (!aId || !bId) {
    return (
      <CompareLayout>
        <section className="section">
          <h2 className="section-title">Pick two recipes</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            You supplied <code className="font-mono">a</code>
            {aId ? "" : " and "}
            <code className="font-mono">b</code>
            {bId ? "" : " and "} but not both. Choose a recipe for each
            column to compare.
          </p>
          <ComparePicker
            initialA={aId}
            initialB={bId}
            className="mt-5"
          />
        </section>
      </CompareLayout>
    );
  }

  if (aId === bId) {
    return (
      <CompareLayout>
        <section className="section">
          <h2 className="section-title">Pick two different recipes</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Comparing a recipe against itself isn&apos;t useful. Pick a second
            recipe in the right-hand column.
          </p>
          <ComparePicker
            initialA={aId}
            initialB={null}
            className="mt-5"
          />
        </section>
      </CompareLayout>
    );
  }

  const rows = await prisma.recipe.findMany({
    where: { id: { in: [aId, bId] } },
    include: {
      fermentables: { orderBy: { position: "asc" } },
      hops: { orderBy: { position: "asc" } },
      yeasts: { orderBy: { position: "asc" } },
      mashSteps: { orderBy: { position: "asc" } },
      processSteps: { orderBy: { position: "asc" } },
      additions: { orderBy: { position: "asc" } },
      recipeTags: { include: { tag: true } },
    },
  });
  const aRow = rows.find((r) => r.id === aId) ?? null;
  const bRow = rows.find((r) => r.id === bId) ?? null;

  if (!aRow || !bRow) {
    const missing = !aRow ? "a" : "b";
    return (
      <CompareLayout>
        <section className="section">
          <h2 className="section-title">Recipe not found</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Slot <code className="font-mono">{missing}</code> referenced a
            recipe that doesn&apos;t exist. Pick another one below.
          </p>
          <ComparePicker
            initialA={aRow ? aRow.id : null}
            initialB={bRow ? bRow.id : null}
            className="mt-5"
          />
        </section>
      </CompareLayout>
    );
  }

  const a = presentRecipe(aRow, { batchSize, units }) as unknown as RecipeDetail;
  const b = presentRecipe(bRow, { batchSize, units }) as unknown as RecipeDetail;

  return (
    <CompareLayout>
      <CompareClient a={a} b={b} units={units} />
    </CompareLayout>
  );
}

function CompareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <nav className="text-sm">
        <Link
          href="/"
          className="inline-flex items-center gap-1 font-medium text-[var(--muted-foreground)] no-underline hover:text-[var(--foreground)]"
        >
          <span aria-hidden>←</span> All recipes
        </Link>
      </nav>
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <HopMark className="h-5 w-5" />
          <span className="label-eyebrow !text-[var(--accent)]">Compare</span>
        </div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Recipe comparison
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">
          Two recipes side by side. Vital stats, grain bill, hop schedule, yeast
          and mash steps are aligned in parallel columns so the differences jump
          out.
        </p>
      </header>
      {children}
    </div>
  );
}
