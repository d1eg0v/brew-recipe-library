// `GET   /api/inventory`       — list all inventory rows (optionally filtered by category)
// `POST  /api/inventory`       — create a new inventory row
//
// Inventory is a flat, app-wide pantry (BRE-40). It is not scoped to a
// recipe — a brewer carries the same Cascade hops from one brew to the next,
// so the rows live at the top level and the shopping-list route does the
// cross-referencing per recipe.

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import {
  conflict,
  internalError,
  readJson,
  validationError,
} from "@/lib/api/errors";
import {
  presentInventoryItem,
  type InventoryItemRow,
} from "@/lib/api/presentInventory";
import {
  inventoryCreateSchema,
  inventoryListQuerySchema,
} from "@/lib/api/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsedQuery = inventoryListQuerySchema.safeParse({
    category: url.searchParams.get("category") ?? undefined,
  });
  if (!parsedQuery.success) return validationError(parsedQuery.error);

  try {
    const rows = await prisma.inventoryItem.findMany({
      where: parsedQuery.data.category
        ? { category: parsedQuery.data.category }
        : undefined,
      orderBy: [
        { category: "asc" },
        { name: "asc" },
        { detail: "asc" },
        { unit: "asc" },
      ],
    });
    return NextResponse.json({
      data: rows.map((r) =>
        presentInventoryItem(r as unknown as InventoryItemRow),
      ),
    });
  } catch (err) {
    console.error("GET /api/inventory failed:", err);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = inventoryCreateSchema.safeParse(body.value);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const row = await prisma.inventoryItem.create({
      data: parsed.data,
    });
    return NextResponse.json(
      { data: presentInventoryItem(row as unknown as InventoryItemRow) },
      { status: 201 },
    );
  } catch (err) {
    // Prisma P2002 = unique constraint violation. Return a 409 with a useful
    // message instead of leaking a stack trace.
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return conflict(
        `An inventory row for ${parsed.data.category} "${parsed.data.name}" ` +
          `(detail "${parsed.data.detail}", unit "${parsed.data.unit}") already exists.`,
      );
    }
    console.error("POST /api/inventory failed:", err);
    return internalError();
  }
}