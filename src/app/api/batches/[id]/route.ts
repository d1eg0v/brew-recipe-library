// `GET    /api/batches/[id]` — fetch a single logged brew with derived metrics
// `PATCH  /api/batches/[id]` — partial update
// `DELETE /api/batches/[id]` — remove a batch

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import {
  badRequest,
  internalError,
  notFound,
  readJson,
  validationError,
} from "@/lib/api/errors";
import { presentBatch } from "@/lib/api/presentBatch";
import { batchPatchSchema } from "@/lib/api/schemas";

export const dynamic = "force-dynamic";

async function loadBatchWithFermentables(id: string) {
  const batch = await prisma.batch.findUnique({ where: { id } });
  if (!batch) return null;
  const fermentables = await prisma.fermentable.findMany({
    where: { recipeId: batch.recipeId },
    orderBy: { position: "asc" },
  });
  return { batch, fermentables };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const loaded = await loadBatchWithFermentables(id);
    if (!loaded) return notFound("Batch not found");
    return NextResponse.json({
      data: presentBatch(loaded.batch, loaded.fermentables),
    });
  } catch (err) {
    console.error("GET /api/batches/[id] failed:", err);
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
  const parsed = batchPatchSchema.safeParse(body.value);
  if (!parsed.success) return validationError(parsed.error);

  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    return badRequest("PATCH body must specify at least one field");
  }

  try {
    const existing = await prisma.batch.findUnique({ where: { id } });
    if (!existing) return notFound("Batch not found");

    const data: Record<string, unknown> = {};
    if (patch.brewDate !== undefined) data.brewDate = new Date(patch.brewDate);
    if (patch.measuredOg !== undefined) data.measuredOg = patch.measuredOg;
    if (patch.measuredFg !== undefined) data.measuredFg = patch.measuredFg;
    if (patch.volumeLiters !== undefined) data.volumeLiters = patch.volumeLiters;
    if (patch.notes !== undefined) data.notes = patch.notes;

    const updated = await prisma.batch.update({ where: { id }, data });
    const fermentables = await prisma.fermentable.findMany({
      where: { recipeId: updated.recipeId },
      orderBy: { position: "asc" },
    });
    return NextResponse.json({
      data: presentBatch(updated, fermentables),
    });
  } catch (err) {
    console.error("PATCH /api/batches/[id] failed:", err);
    return internalError();
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const existing = await prisma.batch.findUnique({ where: { id } });
    if (!existing) return notFound("Batch not found");
    await prisma.batch.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/batches/[id] failed:", err);
    return internalError();
  }
}
