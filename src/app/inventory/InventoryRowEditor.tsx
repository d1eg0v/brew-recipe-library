"use client";

// `InventoryRowEditor` — single inline form used for both adding a new
// inventory row and editing an existing one (BRE-40). The parent owns
// persistence; this component is purely presentational state + a few
// convenience hints (placeholder text per category).

import type { InventoryCategory } from "@/lib/ui/types";

export interface Draft {
  category: InventoryCategory;
  name: string;
  detail: string;
  unit: string;
  amountOnHand: string;
  notes: string;
}

interface InventoryRowEditorProps {
  draft: Draft;
  onChange: (next: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  isNew?: boolean;
}

export default function InventoryRowEditor({
  draft,
  onChange,
  onCancel,
  onSave,
  saving,
  isNew = false,
}: InventoryRowEditorProps) {
  const hint = placeholderFor(draft.category);
  return (
    <tr data-testid={isNew ? "inventory-row-new" : "inventory-row-edit"}>
      <td>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder={hint.name}
          aria-label="Ingredient name"
          className="field field-mono w-full"
        />
      </td>
      <td>
        <input
          type="text"
          value={draft.detail}
          onChange={(e) => onChange({ ...draft, detail: e.target.value })}
          placeholder={hint.detail}
          aria-label="Detail (e.g. hop use or yeast form)"
          className="field field-mono w-full"
        />
      </td>
      <td>
        <input
          type="text"
          value={draft.unit}
          onChange={(e) => onChange({ ...draft, unit: e.target.value })}
          placeholder={hint.unit}
          aria-label="Unit"
          className="field field-mono w-24"
        />
      </td>
      <td className="text-right">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={draft.amountOnHand}
          onChange={(e) =>
            onChange({ ...draft, amountOnHand: e.target.value })
          }
          placeholder="0"
          aria-label="Amount on hand"
          className="field field-mono w-28 text-right"
        />
      </td>
      <td>
        <input
          type="text"
          value={draft.notes}
          onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          placeholder="optional"
          aria-label="Notes"
          className="field field-mono w-full"
        />
      </td>
      <td className="text-right">
        <div className="inline-flex gap-1.5">
          <button
            type="button"
            onClick={onSave}
            className="btn btn-primary btn-sm"
            disabled={saving}
          >
            {saving ? "Saving…" : isNew ? "Add" : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-ghost btn-sm"
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

function placeholderFor(category: InventoryCategory): {
  name: string;
  detail: string;
  unit: string;
} {
  switch (category) {
    case "fermentables":
      return { name: "Pale 2-Row", detail: "(none)", unit: "kg" };
    case "hops":
      return { name: "Cascade", detail: "boil | dryHop", unit: "g" };
    case "yeast":
      return { name: "US-05", detail: "dry | liquid", unit: "packets" };
    case "additions":
      return { name: "Fermaid-O", detail: "(none)", unit: "g" };
  }
}