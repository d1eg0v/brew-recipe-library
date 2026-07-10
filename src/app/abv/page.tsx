// Server-rendered page for the quick ABV-from-OG/FG calculator.
//
// The page accepts these query params:
//   - recipeId   optional; when present, the server reads the recipe's
//                targetOg / targetFg and pre-fills the calculator.
//   - measuredOg optional; overrides the recipe OG (0.95-1.20).
//   - measuredFg optional; overrides the recipe FG (0.95-1.20).
//   - formula    optional; "auto" (default) | "linear" | "highGravity".
//
// The client component is a small form that re-fetches `GET /api/abv`
// whenever any input changes.

import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import AbvCalculator from "./AbvCalculator";

export const dynamic = "force-dynamic";

interface AbvPageProps {
  searchParams: Promise<{
    recipeId?: string;
    measuredOg?: string;
    measuredFg?: string;
    formula?: string;
  }>;
}

const MIN_GRAVITY = 0.95;
const MAX_GRAVITY = 1.2;

function parseGravity(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const v = Number.parseFloat(raw);
  if (!Number.isFinite(v) || v < MIN_GRAVITY || v > MAX_GRAVITY) return undefined;
  return v;
}

function parseFormula(
  raw: string | undefined,
): "auto" | "linear" | "highGravity" {
  if (raw === "linear" || raw === "highGravity") return raw;
  return "auto";
}

export default async function AbvPage({ searchParams }: AbvPageProps) {
  const sp = await searchParams;
  const initialOg = parseGravity(sp.measuredOg);
  const initialFg = parseGravity(sp.measuredFg);
  const initialFormula = parseFormula(sp.formula);

  let recipe:
    | {
        id: string;
        title: string;
        targetOg: number | null;
        targetFg: number | null;
      }
    | null = null;
  if (sp.recipeId) {
    const row = await prisma.recipe.findUnique({
      where: { id: sp.recipeId },
      select: {
        id: true,
        title: true,
        targetOg: true,
        targetFg: true,
      },
    });
    if (!row) notFound();
    recipe = {
      id: row.id,
      title: row.title,
      targetOg: row.targetOg,
      targetFg: row.targetFg,
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
          Quick ABV calculator
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] max-w-2xl">
          Punch in the original and final gravity you measured on brew day
          (hydrometer or refractometer) and the calculator will tell you what
          your batch actually fermented to. Pre-fills from any recipe&apos;s
          targets. Above OG 1.07 the calculator auto-switches to the
          high-gravity formula — the standard correction for meads, wines,
          and big beers.
        </p>
      </header>

      <AbvCalculator
        recipe={recipe}
        initialOg={initialOg ?? recipe?.targetOg ?? 1.05}
        initialFg={initialFg ?? recipe?.targetFg ?? 1.012}
        initialFormula={initialFormula}
      />
    </div>
  );
}