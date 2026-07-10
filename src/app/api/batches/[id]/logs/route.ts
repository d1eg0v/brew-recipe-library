// `GET  /api/batches/[id]/logs` — list fermentation log entries for a batch
// `POST /api/batches/[id]/logs` — add a gravity / pH / temperature reading
//
// Mirrors `/api/recipes/[id]/logs` but pre-binds `batchId` so the UI does not
// have to send it on every call. The parent batch must exist (404 otherwise);
// the recipe id is looked up via the batch and used to keep batchId and
// recipeId consistent on the row we write.

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
    const batch = await prisma.batch.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!batch) return notFound("Batch not found");
    const logs = await prisma.batchLog.findMany({
      where: { batchId: id },
      orderBy: { logDate: "asc" },
    });
    return NextResponse.json({ data: logs });
  } catch (err) {
    console.error("GET /api/batches/[id]/logs failed:", err);
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
    const batch = await prisma.batch.findUnique({
      where: { id },
      select: { id: true, recipeId: true },
    });
    if (!batch) return notFound("Batch not found");

    // Reject the body if it tries to set a different batchId — callers should
    // not be able to create a log for batch A while POSTing to batch B.
    if (
      parsed.data.batchId !== undefined &&
      parsed.data.batchId !== id
    ) {
      return badRequest("batchId in body does not match URL");
    }

    const created = await prisma.batchLog.create({
      data: {
        recipeId: batch.recipeId,
        batchId: batch.id,
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
    console.error("POST /api/batches/[id]/logs failed:", err);
    return internalError();
  }
}