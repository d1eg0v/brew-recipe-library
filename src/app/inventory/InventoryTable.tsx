"use client";

// `InventoryTable` — BRE-40 client-side CRUD UI for the pantry.
//
// One table per category (fermentables / hops / yeast / additions) so the
// brewer can scan what they have without scrolling. Adding a row opens a
// compact form; editing toggles inline. Every change hits `/api/inventory`
// (POST/PATCH/DELETE) and the local state is updated optimistically with
// a rollback on error.

import { useCallback, useMemo, useState, useTransition } from "react";

import {
  fmtNumber,
  hopUseLabel,
  shoppingCategoryLabel,
  titleCase,
} from "@/lib/ui/format";
import type {
  InventoryCategory,
  InventoryItemView,
  InventoryListResponse,
  InventoryItemResponse,
} from "@/lib/ui/types";

import InventoryRowEditor from "./InventoryRowEditor";

interface InventoryTableProps {
  initialItems: InventoryListResponse["data"];
}

const CATEGORY_ORDER: InventoryCategory[] = [
  "fermentables",
  "hops",
  "yeast",
  "additions",
];

interface Draft {
  category: InventoryCategory;
  name: string;
  detail: string;
  unit: string;
  amountOnHand: string;
  notes: string;
}

const EMPTY_DRAFT: Draft = {
  category: "fermentables",
  name: "",
  detail: "",
  unit: "kg",
  amountOnHand: "",
  notes: "",
};

export default function InventoryTable({ initialItems }: InventoryTableProps) {
  const [items, setItems] = useState<InventoryItemView[]>(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState<InventoryCategory | null>(
    null,
  );
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [pending, startTransition] = useTransition();

  // Re-bucket whenever `items` changes so the four category tables always
  // reflect the current state.
  const grouped = useMemo(() => {
    const out: Record<InventoryCategory, InventoryItemView[]> = {
      fermentables: [],
      hops: [],
      yeast: [],
      additions: [],
    };
    for (const it of items) out[it.category].push(it);
    for (const c of CATEGORY_ORDER) {
      out[c].sort((a, b) => {
        const n = a.name.localeCompare(b.name);
        if (n !== 0) return n;
        const d = a.detail.localeCompare(b.detail);
        if (d !== 0) return d;
        return a.unit.localeCompare(b.unit);
      });
    }
    return out;
  }, [items]);

  const resetDraft = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    setAddingCategory(null);
  }, []);

  const startAdd = useCallback((category: InventoryCategory) => {
    setError(null);
    setAddingCategory(category);
    setEditingId(null);
    setDraft({
      ...EMPTY_DRAFT,
      category,
      // Pick a sensible default unit for the category to nudge the form
      // toward the right shape. The brewer can override.
      unit:
        category === "fermentables"
          ? "kg"
          : category === "hops"
            ? "g"
            : category === "yeast"
              ? "packets"
              : "g",
    });
  }, []);

  const startEdit = useCallback((row: InventoryItemView) => {
    setError(null);
    setEditingId(row.id);
    setAddingCategory(null);
    setDraft({
      category: row.category,
      name: row.name,
      detail: row.detail,
      unit: row.unit,
      amountOnHand: String(row.amountOnHand),
      notes: row.notes ?? "",
    });
  }, []);

  const cancel = useCallback(() => {
    setEditingId(null);
    resetDraft();
    setError(null);
  }, [resetDraft]);

  async function create() {
    if (!addingCategory) return;
    const amount = Number.parseFloat(draft.amountOnHand);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Amount on hand must be a non-negative number");
      return;
    }
    if (draft.name.trim().length === 0) {
      setError("Name is required");
      return;
    }
    setError(null);
    const body = {
      category: addingCategory,
      name: draft.name.trim(),
      detail: draft.detail.trim(),
      unit: draft.unit.trim(),
      amountOnHand: amount,
      notes: draft.notes.trim() ? draft.notes.trim() : undefined,
    };
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const msg = await readError(res, `Request failed (${res.status})`);
        setError(msg);
        return;
      }
      const data = (await res.json()) as InventoryItemResponse;
      startTransition(() => {
        setItems((prev) => [...prev, data.data]);
        resetDraft();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add row");
    }
  }

  async function save(id: string) {
    const amount = Number.parseFloat(draft.amountOnHand);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Amount on hand must be a non-negative number");
      return;
    }
    if (draft.name.trim().length === 0) {
      setError("Name is required");
      return;
    }
    setError(null);
    const body = {
      name: draft.name.trim(),
      detail: draft.detail.trim(),
      unit: draft.unit.trim(),
      amountOnHand: amount,
      notes: draft.notes.trim() ? draft.notes.trim() : null,
    };
    try {
      const res = await fetch(`/api/inventory/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const msg = await readError(res, `Request failed (${res.status})`);
        setError(msg);
        return;
      }
      const data = (await res.json()) as InventoryItemResponse;
      startTransition(() => {
        setItems((prev) => prev.map((i) => (i.id === id ? data.data : i)));
        setEditingId(null);
        resetDraft();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save row");
    }
  }

  async function remove(id: string) {
    setError(null);
    const previous = items;
    startTransition(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    });
    try {
      const res = await fetch(`/api/inventory/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        setItems(previous);
        const msg = await readError(res, `Request failed (${res.status})`);
        setError(msg);
      }
    } catch (err) {
      setItems(previous);
      setError(err instanceof Error ? err.message : "Failed to remove row");
    }
  }

  const totalCount = items.length;

  return (
    <div className="space-y-8" data-testid="inventory-tables">
      {error ? (
        <p
          className="rounded-md border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-fg)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {totalCount === 0 && !addingCategory ? (
        <section
          className="section text-center py-12"
          data-testid="inventory-empty"
        >
          <h2 className="font-display text-2xl font-semibold">
            No inventory tracked yet
          </h2>
          <p className="mt-2 text-[var(--muted-foreground)]">
            Add a row for whatever you already have on the shelf — the shopping
            list on each recipe will then subtract it for you.
          </p>
        </section>
      ) : null}

      {CATEGORY_ORDER.map((category) => {
        const rows = grouped[category];
        return (
          <section
            key={category}
            className="section"
            data-testid={`inventory-category-${category}`}
          >
            <div className="section-title">
              {shoppingCategoryLabel(category)}
              <span className="count">{rows.length}</span>
              <button
                type="button"
                onClick={() => startAdd(category)}
                className="btn btn-outline btn-sm ml-auto"
                disabled={pending || (addingCategory != null && addingCategory !== category)}
                aria-label={`Add ${shoppingCategoryLabel(category).toLowerCase()} to inventory`}
              >
                + Add
              </button>
            </div>
            {rows.length === 0 && addingCategory !== category ? (
              <p className="text-sm italic text-[var(--muted-foreground)]">
                Nothing tracked in this category yet.
              </p>
            ) : (
              <div className="-mx-1 overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Detail</th>
                      <th>Unit</th>
                      <th className="text-right">On hand</th>
                      <th>Notes</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) =>
                      editingId === row.id ? (
                        <InventoryRowEditor
                          key={row.id}
                          draft={draft}
                          onChange={setDraft}
                          onCancel={cancel}
                          onSave={() => void save(row.id)}
                          saving={pending}
                        />
                      ) : (
                        <tr key={row.id} data-testid={`inventory-row-${row.id}`}>
                          <td className="font-medium">{row.name}</td>
                          <td>{detailLabel(category, row.detail)}</td>
                          <td>{row.unit || "—"}</td>
                          <td className="num text-right">
                            {fmtNumber(row.amountOnHand, 3)}
                          </td>
                          <td className="text-sm text-[var(--muted-foreground)]">
                            {row.notes ?? "—"}
                          </td>
                          <td className="text-right">
                            <div className="inline-flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => startEdit(row)}
                                className="btn btn-outline btn-sm"
                                disabled={pending}
                                aria-label={`Edit ${row.name}`}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    typeof window !== "undefined" &&
                                    window.confirm(
                                      `Remove "${row.name}" from inventory?`,
                                    )
                                  ) {
                                    void remove(row.id);
                                  }
                                }}
                                className="btn btn-ghost btn-sm"
                                disabled={pending}
                                aria-label={`Remove ${row.name}`}
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                    {addingCategory === category ? (
                      <InventoryRowEditor
                        key="__new__"
                        draft={draft}
                        onChange={setDraft}
                        onCancel={cancel}
                        onSave={() => void create()}
                        saving={pending}
                        isNew
                      />
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

function detailLabel(
  category: InventoryCategory,
  detail: string,
): string {
  if (!detail) return "—";
  if (category === "hops") return hopUseLabel(detail) ?? titleCase(detail);
  if (category === "yeast") {
    switch (detail) {
      case "dry":
        return "Dry";
      case "liquid":
        return "Liquid";
      case "slant":
        return "Slant";
      case "culture":
        return "Culture";
      default:
        return titleCase(detail);
    }
  }
  return detail;
}