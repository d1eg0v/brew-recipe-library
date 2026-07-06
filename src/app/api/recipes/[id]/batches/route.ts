// `POST /api/recipes/[id]/batches` — log a new brew for a recipe
// `GET  /api/recipes/[id]/batches` — list a recipe's batches, newest first

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import {
  internalError,
  notFound,
  readJson,
  validationError,
} from "@/lib/api/errors";
import { presentBatch } from "@/lib/api/presentBatch";
import { batchCreateSchema } from "@/lib/api/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!recipe) return notFound("Recipe not found");
    const batches = await prisma.batch.findMany({
      where: { recipeId: id },
      orderBy: { brewDate: "desc" },
    });
    return NextResponse.json({
      data: batches.map((b) => presentBatch(b)),
    });
  } catch (err) {
    console.error("GET /api/recipes/[id]/batches failed:", err);
    return internalError();
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = batchCreateSchema.safeParse(body.value);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: { fermentables: { orderBy: { position: "asc" } } },
    });
    if (!recipe) return notFound("Recipe not found");

    const created = await prisma.batch.create({
      data: {
        recipeId: id,
        brewDate: new Date(parsed.data.brewDate),
        measuredOg: parsed.data.measuredOg ?? null,
        measuredFg: parsed.data.measuredFg ?? null,
        volumeLiters: parsed.data.volumeLiters ?? null,
        notes: parsed.data.notes ?? null,
      },
    });
    return NextResponse.json(
      { data: presentBatch(created, recipe.fermentables) },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/recipes/[id]/batches failed:", err);
    return internalError();
  }
}
