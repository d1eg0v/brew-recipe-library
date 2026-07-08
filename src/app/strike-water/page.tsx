// Server-rendered page for the strike-water / mash calculator.
//
// The page accepts these query params:
//   - recipeId      optional; when present, the server reads the recipe's
//                   grain bill and pre-fills the calculator.
//   - grainKg       optional; overrides the recipe grain mass.
//   - units         "metric" | "imperial" (default metric).
//
// The client component is a small form that re-fetches
// `GET /api/strike-water` whenever any input changes.

import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { roundTo } from "@/lib/brewing/units";
import StrikeWaterCalculator from "./StrikeWaterCalculator";
import type { UnitSystem } from "@/lib/ui/types";

export const dynamic = "force-dynamic";

interface StrikeWaterPageProps {
  searchParams: Promise<{
    recipeId?: string;
    grainKg?: string;
    units?: string;
  }>;
}

function parseUnits(raw: string | undefined): UnitSystem {
  return raw === "imperial" ? "imperial" : "metric";
}

function parseGrainKg(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const v = Number.parseFloat(raw);
  if (!Number.isFinite(v) || v <= 0) return undefined;
  return v;
}

export default async function StrikeWaterPage({
  searchParams,
}: StrikeWaterPageProps) {
  const sp = await searchParams;
  const units = parseUnits(sp.units);
  const initialGrainKg = parseGrainKg(sp.grainKg);

  let recipe: { id: string; title: string; grainKg: number } | null = null;
  if (sp.recipeId) {
    const row = await prisma.recipe.findUnique({
      where: { id: sp.recipeId },
      select: {
        id: true,
        title: true,
        fermentables: { select: { amountKg: true } },
      },
    });
    if (!row) notFound();
    const totalGrainKg = roundTo(
      row.fermentables.reduce(
        (sum, f) =>
          typeof f.amountKg === "number" && f.amountKg > 0
            ? sum + f.amountKg
            : sum,
        0,
      ),
      3,
    );
    recipe = {
      id: row.id,
      title: row.title,
      grainKg: totalGrainKg,
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
          Strike-water calculator
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] max-w-2xl">
          Pick the grain mass, the mash temperature you want to hit, and the
          temperature the grain is sitting at now — the calculator will tell
          you how much water to heat, and to what temperature. Pre-fills from
          any recipe&apos;s grain bill. The math is the Palmer /{" "}
          <em>How to Brew</em> strike-water equation.
        </p>
      </header>

      <StrikeWaterCalculator
        recipe={recipe}
        initialGrainKg={initialGrainKg ?? recipe?.grainKg ?? 5}
        initialUnits={units}
      />
    </div>
  );
}