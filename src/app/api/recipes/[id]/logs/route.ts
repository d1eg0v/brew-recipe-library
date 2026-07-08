// `GET  /api/recipes/[id]/logs` — list dynamic FermentDB batch log entries
// `POST /api/recipes/[id]/logs` — add a gravity/pH/temp/note timeline entry

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import {
  badRequest,
  internalError,
  notFound,
  readJson,
  validationError,
} from "@/lib/api/errors";
import { batchLogCreateSchema } from "@/lib/api/schemas";

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
    const logs = await prisma.batchLog.findMany({
      where: { recipeId: id },
      orderBy: { logDate: "desc" },
    });
    return NextResponse.json({ data: logs });
  } catch (err) {
    console.error("GET /api/recipes/[id]/logs failed:", err);
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
  const parsed = batchLogCreateSchema.safeParse(body.value);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!recipe) return notFound("Recipe not found");

    if (parsed.data.batchId) {
      const batch = await prisma.batch.findFirst({
        where: { id: parsed.data.batchId, recipeId: id },
        select: { id: true },
      });
      if (!batch) return badRequest("batchId does not belong to this recipe");
    }

    const created = await prisma.batchLog.create({
      data: {
        recipeId: id,
        batchId: parsed.data.batchId ?? null,
        logDate: parsed.data.logDate ? new Date(parsed.data.logDate) : new Date(),
        type: parsed.data.type,
        gravity: parsed.data.gravity ?? null,
        ph: parsed.data.ph ?? null,
        temperatureC: parsed.data.temperatureC ?? null,
        volumeLiters: parsed.data.volumeLiters ?? null,
        notes: parsed.data.notes ?? null,
      },
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/recipes/[id]/logs failed:", err);
    return internalError();
  }
}
