// `PATCH /api/inventory/[id]` — update an inventory row (partial).
// `DELETE /api/inventory/[id]` — remove an inventory row.

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import {
  conflict,
  internalError,
  notFound,
  readJson,
  validationError,
} from "@/lib/api/errors";
import {
  presentInventoryItem,
  type InventoryItemRow,
} from "@/lib/api/presentInventory";
import { inventoryPatchSchema } from "@/lib/api/schemas";
import { normaliseForKey } from "@/lib/brewing/inventory";

export const dynamic = "force-dynamic";

/**
 * The same lower-cased trimmed normalisation the `POST /api/inventory` route
 * applies to free-text fields. Duplicated here so a PATCH that renames an
 * ingredient rebuilds the unique key the same way — otherwise a rename would
 * silently break the (category, nameNormalized, detailNormalized,
 * unitNormalized) unique index.
 */
function normaliseNameKey(s: string): string {
  return s.trim().toLowerCase();
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = inventoryPatchSchema.safeParse(body.value);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const existing = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) return notFound("Inventory item not found");

    // Rebuild the unique-key fields whenever any of them are touched so the
    // unique index doesn't reject a rename that lands on the same canonical
    // key as another row.
    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) {
      data.name = parsed.data.name;
      data.nameNormalized = normaliseNameKey(parsed.data.name);
    }
    if (parsed.data.detail !== undefined) {
      data.detail = parsed.data.detail;
      data.detailNormalized = normaliseForKey(parsed.data.detail);
    }
    if (parsed.data.unit !== undefined) {
      data.unit = parsed.data.unit;
      data.unitNormalized = normaliseForKey(parsed.data.unit);
    }
    if (parsed.data.amountOnHand !== undefined) {
      data.amountOnHand = parsed.data.amountOnHand;
    }
    if (parsed.data.notes !== undefined) {
      data.notes = parsed.data.notes;
    }

    const row = await prisma.inventoryItem.update({
      where: { id },
      data,
    });
    return NextResponse.json({
      data: presentInventoryItem(row as unknown as InventoryItemRow),
    });
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return conflict(
        "Renaming this inventory row would collide with an existing one.",
      );
    }
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2025"
    ) {
      return notFound("Inventory item not found");
    }
    console.error("PATCH /api/inventory/[id] failed:", err);
    return internalError();
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const existing = await prisma.inventoryItem.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return notFound("Inventory item not found");

    await prisma.inventoryItem.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2025"
    ) {
      return notFound("Inventory item not found");
    }
    console.error("DELETE /api/inventory/[id] failed:", err);
    return internalError();
  }
}