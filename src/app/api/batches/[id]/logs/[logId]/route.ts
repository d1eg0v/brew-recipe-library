// `DELETE /api/batches/[id]/logs/[logId]` — remove a single fermentation
// reading. Returns 204 on success, 404 if either the batch or the log row is
// missing.

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { internalError, notFound } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; logId: string }> },
) {
  const { id, logId } = await context.params;
  try {
    const log = await prisma.batchLog.findUnique({
      where: { id: logId },
      select: { id: true, batchId: true },
    });
    if (!log || log.batchId !== id) return notFound("Log entry not found");
    await prisma.batchLog.delete({ where: { id: logId } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/batches/[id]/logs/[logId] failed:", err);
    return internalError();
  }
}