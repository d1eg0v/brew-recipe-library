// Server-rendered page for the priming-sugar / carbonation calculator.
//
// The page accepts these query params:
//   - recipeId   optional; when present, the server reads the recipe's
//                batch size and pre-fills the calculator volume.
//   - batchSize  optional; overrides the recipe batch size (in litres).
//   - units      "metric" | "imperial" (default metric).
//
// The client component is a small form that re-fetches
// `GET /api/priming-sugar` whenever any input changes.

import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import PrimingSugarCalculator from "./PrimingSugarCalculator";
import type { UnitSystem } from "@/lib/ui/types";

export const dynamic = "force-dynamic";

interface PrimingSugarPageProps {
  searchParams: Promise<{
    recipeId?: string;
    batchSize?: string;
    units?: string;
  }>;
}

function parseUnits(raw: string | undefined): UnitSystem {
  return raw === "imperial" ? "imperial" : "metric";
}

function parseBatchSize(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const v = Number.parseFloat(raw);
  if (!Number.isFinite(v) || v <= 0) return undefined;
  return v;
}

export default async function PrimingSugarPage({
  searchParams,
}: PrimingSugarPageProps) {
  const sp = await searchParams;
  const units = parseUnits(sp.units);
  const initialBatchSize = parseBatchSize(sp.batchSize);

  let recipe: { id: string; title: string; batchSizeLiters: number } | null =
    null;
  if (sp.recipeId) {
    const row = await prisma.recipe.findUnique({
      where: { id: sp.recipeId },
      select: { id: true, title: true, batchSizeLiters: true },
    });
    if (!row) notFound();
    recipe = {
      id: row.id,
      title: row.title,
      batchSizeLiters: row.batchSizeLiters,
    };
  }

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link
          href="/"
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] no-underline"
        >
          ← All recipes
        </Link>
      </nav>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Priming sugar calculator
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] max-w-2xl">
          Pick a target CO<sub>2</sub> volume, enter your batch size and the
          temperature the bottles will condition at, and the calculator will
          tell you how much priming sugar to dose. Supports corn sugar, table
          sugar, and dry malt extract (DME). The math follows Tinseth&apos;s
          published coefficients.
        </p>
      </header>

      <PrimingSugarCalculator
        recipe={recipe}
        initialBatchSize={initialBatchSize ?? recipe?.batchSizeLiters ?? 20}
        initialUnits={units}
      />
    </div>
  );
}
