// `GET /api/abv` — compute ABV from measured original + final gravity.
//
// Inputs (query string):
//   - measuredOg   measured original gravity (or recipeId to pre-fill from
//                  a recipe's targetOg)
//   - measuredFg   measured final gravity (or recipeId to pre-fill from
//                  a recipe's targetFg)
//   - formula      "auto" (default) | "linear" | "highGravity"
//   - recipeId     optional; when present, the route looks up the recipe's
//                  target OG/FG to pre-fill `measuredOg` / `measuredFg`.
//                  A caller-provided value always wins over the recipe target.
//
// Output: ABV (percent), apparent attenuation (percent), gravity points
// dropped, and the formula that was used. The route is a thin wrapper
// over `computeMeasuredAbv` in `@/lib/brewing/abv`.

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import {
  badRequest,
  internalError,
  notFound,
  validationError,
} from "@/lib/api/errors";
import { abvQuerySchema } from "@/lib/api/schemas";
import {
  computeMeasuredAbv,
  type MeasuredAbvInput,
  type MeasuredAbvResult,
} from "@/lib/brewing/abv";

export const dynamic = "force-dynamic";

interface AbvResponseData {
  /** Result struct straight from the pure calc. */
  result: MeasuredAbvResult;
  /** Echoed source — "standalone" when no recipe was involved. */
  source: "standalone" | "recipe";
  /** Optional pre-fill context (the recipe that fed the gravities). */
  recipe?: {
    id: string;
    title: string;
    targetOg: number | null;
    targetFg: number | null;
  };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = abvQuerySchema.safeParse({
    measuredOg: url.searchParams.get("measuredOg") ?? undefined,
    measuredFg: url.searchParams.get("measuredFg") ?? undefined,
    formula: url.searchParams.get("formula") ?? undefined,
    recipeId: url.searchParams.get("recipeId") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  const q = parsed.data;

  let measuredOg: number | undefined;
  let measuredFg: number | undefined;
  let recipe:
    | { id: string; title: string; targetOg: number | null; targetFg: number | null }
    | undefined;
  let source: "standalone" | "recipe" = "standalone";

  try {
    if (q.recipeId) {
      const row = await prisma.recipe.findUnique({
        where: { id: q.recipeId },
        select: {
          id: true,
          title: true,
          targetOg: true,
          targetFg: true,
        },
      });
      if (!row) return notFound("Recipe not found");
      recipe = {
        id: row.id,
        title: row.title,
        targetOg: row.targetOg,
        targetFg: row.targetFg,
      };
      source = "recipe";
      // Pre-fill from the recipe's targets, but caller-provided values win.
      // Recipes can have one or both targets null (e.g. only OG is set), so
      // fall back to the recipe target only when the caller didn't supply
      // their own.
      measuredOg = q.measuredOg ?? row.targetOg ?? undefined;
      measuredFg = q.measuredFg ?? row.targetFg ?? undefined;
    } else {
      measuredOg = q.measuredOg;
      measuredFg = q.measuredFg;
    }

    if (measuredOg == null || measuredFg == null) {
      // Should be unreachable — the Zod refine requires either recipeId or
      // both readings. Defensive guard so the type narrows for the calc,
      // and so a recipe with only one target set produces a useful error
      // rather than a generic 500.
      return badRequest(
        "either recipeId or both measuredOg and measuredFg are required",
      );
    }

    const formula = (q.formula ?? "auto") as MeasuredAbvInput["formula"];
    const input: MeasuredAbvInput = { measuredOg, measuredFg, formula };
    const result = computeMeasuredAbv(input);

    const data: AbvResponseData = { result, source };
    if (recipe) data.recipe = recipe;

    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/abv failed:", err);
    return internalError();
  }
}