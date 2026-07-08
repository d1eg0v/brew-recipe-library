// `GET /api/priming-sugar` — compute priming-sugar mass for a batch.
//
// Inputs (query string):
//   - volumeLiters  (or recipeId to pre-fill from a recipe's batch size)
//   - targetVolumes (CO2 volumes, 0–6)
//   - temperatureC  (conditioning temperature, °C, -20–60)
//   - sugarType     (cornSugar | tableSugar | dme)
//   - units         (metric | imperial, default metric)
//
// Output: priming-sugar mass (grams, plus ounces when `units=imperial`) plus
// the residual CO2 and net volumes the calculation derived. The route is a
// thin wrapper over `computePrimingSugar` in `@/lib/brewing/priming`.

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import {
  badRequest,
  internalError,
  notFound,
  validationError,
} from "@/lib/api/errors";
import {
  computePrimingSugar,
  type PrimingSugarResult,
  type PrimingSugarType,
} from "@/lib/brewing/priming";
import { roundTo } from "@/lib/brewing/units";
import { primingSugarQuerySchema } from "@/lib/api/schemas";

export const dynamic = "force-dynamic";

interface PrimingSugarResponseData {
  /** Result struct straight from the pure calc. */
  result: PrimingSugarResult;
  /** Optional imperial parallel when `?units=imperial`. */
  imperial?: {
    weightOz: number;
  };
  /** Echoed source — "standalone" when no recipe was involved. */
  source: "standalone" | "recipe";
  /** Optional pre-fill context (the recipe that fed the volume). */
  recipe?: {
    id: string;
    title: string;
    batchSizeLiters: number;
  };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = primingSugarQuerySchema.safeParse({
    volumeLiters: url.searchParams.get("volumeLiters") ?? undefined,
    targetVolumes: url.searchParams.get("targetVolumes") ?? undefined,
    temperatureC: url.searchParams.get("temperatureC") ?? undefined,
    sugarType: url.searchParams.get("sugarType") ?? undefined,
    recipeId: url.searchParams.get("recipeId") ?? undefined,
    units: url.searchParams.get("units") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  const q = parsed.data;
  const units = (q.units ?? "metric") as "metric" | "imperial";

  let volumeLiters: number | undefined;
  let recipe: { id: string; title: string; batchSizeLiters: number } | undefined;
  let source: "standalone" | "recipe" = "standalone";

  try {
    if (q.recipeId) {
      const row = await prisma.recipe.findUnique({
        where: { id: q.recipeId },
        select: { id: true, title: true, batchSizeLiters: true },
      });
      if (!row) return notFound("Recipe not found");
      recipe = {
        id: row.id,
        title: row.title,
        batchSizeLiters: row.batchSizeLiters,
      };
      source = "recipe";
      // Pre-fill from the recipe, but a caller-provided volume wins.
      volumeLiters = q.volumeLiters ?? row.batchSizeLiters;
    } else {
      volumeLiters = q.volumeLiters;
    }

    if (volumeLiters == null) {
      // Should be unreachable — the Zod refine requires one of {recipeId,
      // volumeLiters}. Defensive guard so the type narrows for the calc.
      return badRequest("either recipeId or volumeLiters is required");
    }

    const result = computePrimingSugar({
      volumeLiters,
      targetVolumes: q.targetVolumes,
      temperatureC: q.temperatureC,
      sugarType: q.sugarType as PrimingSugarType,
    });

    const data: PrimingSugarResponseData = { result, source };
    if (units === "imperial") {
      // Re-derive oz from grams so the response is always consistent with the
      // rounded gram value, regardless of any rounding-strategy change in the
      // pure-calc layer.
      data.imperial = {
        weightOz: roundTo(result.weightGrams / 28.349523125, 2),
      };
    }
    if (recipe) data.recipe = recipe;

    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/priming-sugar failed:", err);
    return internalError();
  }
}
