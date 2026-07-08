// Print / PDF brew sheet (BRE-42).
//
// Renders a print-optimized one-page brew sheet for a recipe: header, target
// measurements, fermentables, hop schedule, yeast, mash + process steps,
// additions, the auto-generated brew-day checklist, and a free-form notes
// block. The page hides the global nav/header/footer via print CSS and
// exposes a "Print" button (a client island) that calls `window.print()`.
//
// The DB fetch goes through Prisma directly in this server component (rather
// than HTTP-fetching /api/recipes/[id]) so the page renders in a single pass
// without an extra round trip.

import { notFound } from "next/navigation";

import { presentRecipe } from "@/lib/api/present";
import { prisma } from "@/lib/db";
import type { RecipeDetail, UnitSystem } from "@/lib/ui/types";

import PrintSheet from "./PrintSheet";
import styles from "./print.module.css";

export const dynamic = "force-dynamic";

const RECIPE_INCLUDE = {
  fermentables: { orderBy: { position: "asc" as const } },
  hops: { orderBy: { position: "asc" as const } },
  yeasts: { orderBy: { position: "asc" as const } },
  mashSteps: { orderBy: { position: "asc" as const } },
  processSteps: { orderBy: { position: "asc" as const } },
  additions: { orderBy: { position: "asc" as const } },
};

function parseUnitsParam(raw: string | undefined): UnitSystem {
  return raw === "imperial" ? "imperial" : "metric";
}

function parseBatchSizeParam(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const v = Number.parseFloat(raw);
  if (!Number.isFinite(v) || v <= 0) return undefined;
  return v;
}

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const unitsRaw = Array.isArray(sp.units) ? sp.units[0] : sp.units;
  const batchSizeRaw = Array.isArray(sp.batchSize) ? sp.batchSize[0] : sp.batchSize;
  const initialUnits = parseUnitsParam(unitsRaw);
  const initialBatchSize = parseBatchSizeParam(batchSizeRaw);

  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: RECIPE_INCLUDE,
  });
  if (!recipe) notFound();

  const presented = presentRecipe(recipe, {
    batchSize: initialBatchSize,
    units: initialUnits,
  }) as unknown as RecipeDetail;

  return (
    <div className={styles.shell} data-testid="print-sheet">
      <PrintSheet
        recipeId={id}
        initialRecipe={presented}
        initialUnits={initialUnits}
        initialBatchSize={initialBatchSize}
      />
    </div>
  );
}
