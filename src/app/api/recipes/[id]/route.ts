// `GET    /api/recipes/[id]` — fetch with optional scaling + unit conversion
// `PUT    /api/recipes/[id]` — replace the recipe (full upsert)
// `PATCH  /api/recipes/[id]` — partial update
// `DELETE /api/recipes/[id]` — remove the recipe

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import {
  badRequest,
  internalError,
  notFound,
  readJson,
  validationError,
} from "@/lib/api/errors";
import { presentRecipe } from "@/lib/api/present";
import { presentStyleComparison } from "@/lib/api/presentStyle";
import {
  recipePatchToUpdateInput,
  recipeToCreateInput,
} from "@/lib/api/recipeMapper";
import {
  recipeDetailQuerySchema,
  recipeReplaceSchema,
  recipePatchSchema,
} from "@/lib/api/schemas";
import { Prisma } from "@/generated/prisma/client";

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

async function loadRecipe(id: string) {
  return prisma.recipe.findUnique({
    where: { id },
    include: RECIPE_INCLUDE,
  });
}

function parseBatchSize(raw: string | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  const v = Number.parseFloat(raw);
  if (!Number.isFinite(v) || v <= 0) {
    throw new Error("batchSize must be a positive number");
  }
  return v;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const batchSizeRaw = url.searchParams.get("batchSize");
  const parsedQueryResult = recipeDetailQuerySchema.safeParse({
    batchSize: batchSizeRaw ?? undefined,
    units: url.searchParams.get("units") ?? undefined,
  });
  if (!parsedQueryResult.success) return validationError(parsedQueryResult.error);

  let batchSize: number | undefined;
  try {
    batchSize = parseBatchSize(batchSizeRaw);
  } catch {
    return badRequest("batchSize must be a positive number");
  }

  try {
    const recipe = await loadRecipe(id);
    if (!recipe) return notFound();
    const units = (parsedQueryResult.data.units ?? "metric") as "metric" | "imperial";

    // BRE-44: look up the BJCP style row by `recipe.bjcpCategory` and attach
    // a per-metric comparison block. A null category or unknown code yields
    // a null style block (the UI hides the panel in that case).
    const styleRow = recipe.bjcpCategory
      ? await prisma.bjcpStyle.findUnique({
          where: { code: recipe.bjcpCategory },
        })
      : null;
    const presented = presentRecipe(recipe, { batchSize, units });
    const style = styleRow
      ? presentStyleComparison(
          {
            targetOg: recipe.targetOg,
            targetFg: recipe.targetFg,
            targetIbu: recipe.targetIbu,
            targetSrm: recipe.targetSrm,
            targetAbv: recipe.targetAbv,
          },
          styleRow,
        )
      : null;

    return NextResponse.json({
      data: { ...presented, style },
    });
  } catch (err) {
    console.error("GET /api/recipes/[id] failed:", err);
    return internalError();
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = recipeReplaceSchema.safeParse(body.value);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const existing = await prisma.recipe.findUnique({ where: { id } });
    if (!existing) return notFound();

    // Replace: wipe children then re-create atomically. Doing this in a single
    // transaction keeps the recipe consistent if any child create fails.
    const data = recipeToCreateInput(parsed.data) as unknown as Prisma.RecipeUpdateInput;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.fermentable.deleteMany({ where: { recipeId: id } });
      await tx.hop.deleteMany({ where: { recipeId: id } });
      await tx.yeast.deleteMany({ where: { recipeId: id } });
      await tx.mashStep.deleteMany({ where: { recipeId: id } });
      await tx.processStep.deleteMany({ where: { recipeId: id } });
      await tx.addition.deleteMany({ where: { recipeId: id } });
      return tx.recipe.update({
        where: { id },
        data,
        include: RECIPE_INCLUDE,
      });
    });
    return NextResponse.json({
      data: presentRecipe(updated, { units: "metric" }),
    });
  } catch (err) {
    console.error("PUT /api/recipes/[id] failed:", err);
    return internalError();
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = recipePatchSchema.safeParse(body.value);
  if (!parsed.success) return validationError(parsed.error);

  const update = recipePatchToUpdateInput(parsed.data);
  if (!update) return badRequest("PATCH body must specify at least one field");

  try {
    const existing = await prisma.recipe.findUnique({ where: { id } });
    if (!existing) return notFound();
    const updated = await prisma.recipe.update({
      where: { id },
      data: update as unknown as Prisma.RecipeUpdateInput,
      include: RECIPE_INCLUDE,
    });
    return NextResponse.json({
      data: presentRecipe(updated, { units: "metric" }),
    });
  } catch (err) {
    console.error("PATCH /api/recipes/[id] failed:", err);
    return internalError();
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const existing = await prisma.recipe.findUnique({ where: { id } });
    if (!existing) return notFound();
    await prisma.recipe.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/recipes/[id] failed:", err);
    return internalError();
  }
}
