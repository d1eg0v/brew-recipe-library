// `POST /api/recipes/[id]/clone` — clone an existing recipe (deep copy).

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { internalError, notFound } from "@/lib/api/errors";
import { presentRecipe } from "@/lib/api/present";

export const dynamic = "force-dynamic";

const CHILD_INCLUDE = {
  fermentables: { orderBy: { position: "asc" as const } },
  hops: { orderBy: { position: "asc" as const } },
  yeasts: { orderBy: { position: "asc" as const } },
  mashSteps: { orderBy: { position: "asc" as const } },
  processSteps: { orderBy: { position: "asc" as const } },
  additions: { orderBy: { position: "asc" as const } },
};

// Strip the auto-generated `id` and the parent `recipeId` off each child row
// when cloning, so the new recipe gets fresh IDs from Prisma's defaults.
function cloneChildren<T extends { id: string; recipeId: string }>(rows: T[]) {
  return rows.map((row) => {
    const { id, recipeId, ...rest } = row;
    // Explicitly drop the per-row identity fields.
    void id;
    void recipeId;
    return rest;
  });
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const source = await prisma.recipe.findUnique({
      where: { id },
      include: CHILD_INCLUDE,
    });
    if (!source) return notFound();

    const copy = await prisma.recipe.create({
      data: {
        title: `${source.title} (copy)`,
        author: source.author,
        description: source.description,
        notes: source.notes,
        category: source.category,
        styleName: source.styleName,
        bjcpCategory: source.bjcpCategory,
        batchSizeLiters: source.batchSizeLiters,
        boilTimeMinutes: source.boilTimeMinutes,
        efficiencyPct: source.efficiencyPct,
        targetOg: source.targetOg,
        targetFg: source.targetFg,
        targetAbv: source.targetAbv,
        targetIbu: source.targetIbu,
        targetSrm: source.targetSrm,
        fermentables: { create: cloneChildren(source.fermentables) },
        hops: { create: cloneChildren(source.hops) },
        yeasts: { create: cloneChildren(source.yeasts) },
        mashSteps: { create: cloneChildren(source.mashSteps) },
        processSteps: { create: cloneChildren(source.processSteps) },
        additions: { create: cloneChildren(source.additions) },
      },
      include: CHILD_INCLUDE,
    });

    return NextResponse.json(
      { data: presentRecipe(copy, { units: "metric" }) },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/recipes/[id]/clone failed:", err);
    return internalError();
  }
}
