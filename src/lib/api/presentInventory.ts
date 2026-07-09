// Response presentation for inventory items (BRE-40).
//
// Pure mapping from a Prisma `InventoryItem` row to the API response shape.
// Lives in `lib/api/` alongside the other presenters so the route handler
// stays thin.

import type { InventoryCategory } from "@/lib/brewing/inventory";

export interface InventoryItemRow {
  id: string;
  category: InventoryCategory;
  name: string;
  detail: string;
  unit: string;
  amountOnHand: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryItemView {
  id: string;
  category: InventoryCategory;
  name: string;
  detail: string;
  unit: string;
  amountOnHand: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Convert a DB row to the wire shape (dates -> ISO strings). */
export function presentInventoryItem(
  row: InventoryItemRow,
): InventoryItemView {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    detail: row.detail,
    unit: row.unit,
    amountOnHand: row.amountOnHand,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}