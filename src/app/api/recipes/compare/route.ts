// `GET /api/recipes/compare?a=<id>&b=<id>` — fetch two recipes in one round
// trip so the comparison page can render both columns in a single render.
//
// 400 — `a` or `b` is missing
// 404 — either id does not exist (returns `{ a?, b? }` so the client can
//       tell which slot is missing)
// 200 — `{ a, b }` with the same shape `GET /api/recipes/[id]` returns
//
// Same `?batchSize=` + `?units=` contract as the detail route so callers can
// scale / unit-convert both columns together.

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import {
  badRequest,
  internalError,
  notFound,
  validationError,
} from "@/lib/api/errors";
import { presentRecipe } from "@/lib/api/present";
import { recipeDetailQuerySchema } from "@/lib/api/schemas";

export const dynamic = "force-dynamic";

const RECIPE_INCLUDE = {
  fermentables: { orderBy: { position: "asc" as const } },
  hops: { orderBy: { position: "asc" as const } },
  yeasts: { orderBy: { position: "asc" as const } },
  mashSteps: { orderBy: { position: "asc" as const } },
  processSteps: { orderBy: { position: "asc" as const } },
  additions: { orderBy: { position: "asc" as const } },
  recipeTags: { include: { tag: true } },
};

function parseBatchSize(raw: string | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  const v = Number.parseFloat(raw);
  if (!Number.isFinite(v) || v <= 0) {
    throw new Error("batchSize must be a positive number");
  }
  return v;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const a = url.searchParams.get("a")?.trim() || null;
  const b = url.searchParams.get("b")?.trim() || null;
  if (!a || !b) {
    return badRequest("Both `a` and `b` query parameters are required");
  }
  if (a === b) {
    return badRequest("Pick two different recipes to compare");
  }

  const batchSizeRaw = url.searchParams.get("batchSize");
  const parsedQuery = recipeDetailQuerySchema.safeParse({
    batchSize: batchSizeRaw ?? undefined,
    units: url.searchParams.get("units") ?? undefined,
  });
  if (!parsedQuery.success) return validationError(parsedQuery.error);

  let batchSize: number | undefined;
  try {
    batchSize = parseBatchSize(batchSizeRaw);
  } catch {
    return badRequest("batchSize must be a positive number");
  }

  const units = (parsedQuery.data.units ?? "metric") as "metric" | "imperial";

  try {
    const rows = await prisma.recipe.findMany({
      where: { id: { in: [a, b] } },
      include: RECIPE_INCLUDE,
    });
    const aRow = rows.find((r) => r.id === a) ?? null;
    const bRow = rows.find((r) => r.id === b) ?? null;
    if (!aRow && !bRow) return notFound();
    if (!aRow || !bRow) {
      return NextResponse.json(
        {
          error: {
            message: "One or both recipes not found",
            missing: !aRow ? "a" : "b",
          },
        },
        { status: 404 },
      );
    }
    return NextResponse.json({
      data: {
        a: presentRecipe(aRow, { batchSize, units }),
        b: presentRecipe(bRow, { batchSize, units }),
      },
    });
  } catch (err) {
    console.error("GET /api/recipes/compare failed:", err);
    return internalError();
  }
}
