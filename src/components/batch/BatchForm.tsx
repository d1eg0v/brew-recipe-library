"use client";

// Batch (brew-log) create / edit form.
//
// One component, two modes:
//   - `mode="create"` for /recipes/[id]/batches/new (POST /api/recipes/[id]/batches)
//   - `mode="edit"`   for /recipes/[id]/batches/[batchId]/edit
//                       (PATCH /api/batches/[batchId], DELETE on the explicit
//                        delete button).
//
// The edit form carries a `recipeId` so the success redirect can land on the
// recipe detail page (which is where the batch history section lives).
//
// All numeric fields are stored as strings in component state so the user
// can freely type and clear; conversion to numbers happens in
// `validation.ts` against the same Zod schema the server uses.

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  blankBatchFormState,
  validateBatchForm,
  type BatchFormState,
  type FormErrors,
} from "./validation";

interface BatchFormProps {
  mode: "create" | "edit";
  recipeId: string;
  initial?: BatchFormState;
  batchId?: string;
}

export default function BatchForm({
  mode,
  recipeId,
  initial,
  batchId,
}: BatchFormProps) {
  const router = useRouter();
  const initialState = useMemo<BatchFormState>(
    () => (initial ? { ...blankBatchFormState(), ...initial } : blankBatchFormState()),
    [initial],
  );
  const [state, setState] = useState<BatchFormState>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function update<K extends keyof BatchFormState>(key: K, value: BatchFormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setErrors({});

    const result = validateBatchForm(state);
    if (!result.ok) {
      setErrors(result.errors);
      const firstKey = Object.keys(result.errors)[0];
      if (firstKey && typeof document !== "undefined") {
        const el = document.querySelector<HTMLElement>(`[data-field-path="${firstKey}"]`);
        el?.focus();
      }
      return;
    }

    setSubmitting(true);
    try {
      const url =
        mode === "create"
          ? `/api/recipes/${recipeId}/batches`
          : `/api/batches/${batchId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(result.body),
      });
      const payload = (await res.json().catch(() => null)) as
        | { error?: { message?: string; issues?: { path?: string; message: string }[] } }
        | null;
      if (!res.ok) {
        const message = payload?.error?.message ?? `Request failed (${res.status}).`;
        const issues = payload?.error?.issues ?? [];
        if (issues.length > 0) {
          const next: FormErrors = {};
          for (const issue of issues) {
            const path = (issue.path ?? "").replace(/^\.?/, "");
            if (path && !(path in next)) next[path] = issue.message;
          }
          setErrors(next);
        }
        setSubmitError(message);
        return;
      }
      router.push(`/recipes/${recipeId}`);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (mode !== "edit" || !batchId) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/batches/${batchId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setSubmitError(
          payload?.error?.message ?? `Delete failed (${res.status}).`,
        );
        return;
      }
      router.push(`/recipes/${recipeId}`);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-6"
      aria-busy={submitting || deleting}
    >
      {submitError && (
        <div
          role="alert"
          className="p-3 rounded-md border border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-fg)] text-sm"
        >
          {submitError}
        </div>
      )}

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
        <h2 className="text-base font-semibold">Brew details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Brew date"
            required
            error={errors["brewDate"]}
            fieldPath="brewDate"
          >
            <input
              type="date"
              value={state.brewDate}
              onChange={(e) => update("brewDate", e.target.value)}
              required
              className={inputClass}
              data-field-path="brewDate"
            />
          </Field>

          <Field
            label="Volume into fermenter (litres)"
            error={errors["volumeLiters"]}
            fieldPath="volumeLiters"
          >
            <input
              type="number"
              value={state.volumeLiters}
              onChange={(e) => update("volumeLiters", e.target.value)}
              min={0}
              step={0.1}
              className={inputClass}
              data-field-path="volumeLiters"
              placeholder="e.g. 19"
            />
          </Field>

          <Field
            label="Measured OG"
            error={errors["measuredOg"]}
            fieldPath="measuredOg"
          >
            <input
              type="number"
              value={state.measuredOg}
              onChange={(e) => update("measuredOg", e.target.value)}
              min={1.0}
              max={1.2}
              step={0.001}
              className={inputClass}
              data-field-path="measuredOg"
              placeholder="e.g. 1.054"
            />
          </Field>

          <Field
            label="Measured FG"
            error={errors["measuredFg"]}
            fieldPath="measuredFg"
          >
            <input
              type="number"
              value={state.measuredFg}
              onChange={(e) => update("measuredFg", e.target.value)}
              min={1.0}
              max={1.2}
              step={0.001}
              className={inputClass}
              data-field-path="measuredFg"
              placeholder="e.g. 1.011"
            />
          </Field>
        </div>

        <Field
          label="Notes"
          error={errors["notes"]}
          fieldPath="notes"
        >
          <textarea
            value={state.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={4}
            maxLength={10000}
            className={inputClass}
            data-field-path="notes"
            placeholder="Deviations from the recipe, fermentation observations, tasting notes…"
          />
        </Field>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting || deleting}
          className="px-4 py-2 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] text-sm font-medium hover:opacity-90 disabled:opacity-50"
          data-testid="batch-form-submit"
        >
          {submitting
            ? "Saving…"
            : mode === "create"
              ? "Log this brew"
              : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/recipes/${recipeId}`)}
          disabled={submitting || deleting}
          className="px-4 py-2 rounded-md border border-[var(--border)] text-sm hover:bg-[var(--muted)] disabled:opacity-50"
        >
          Cancel
        </button>
        {mode === "edit" && (
          <button
            type="button"
            onClick={onDelete}
            disabled={submitting || deleting}
            className={`ml-auto px-4 py-2 rounded-md text-sm border ${
              confirmDelete
                ? "border-red-700 bg-red-700 text-white hover:bg-red-800"
                : "border-[var(--border)] text-[var(--error-fg)] hover:bg-[var(--error-bg)]"
            } disabled:opacity-50`}
            data-testid="batch-form-delete"
          >
            {deleting
              ? "Deleting…"
              : confirmDelete
                ? "Click again to confirm delete"
                : "Delete this brew"}
          </button>
        )}
      </div>
    </form>
  );
}

const inputClass =
  "w-full border border-[var(--border)] rounded-md px-3 py-2 bg-[var(--background)] text-[var(--foreground)]";

function Field({
  label,
  required,
  error,
  fieldPath,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  fieldPath: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className="flex flex-col gap-1"
      data-field-key={fieldPath}
    >
      <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
        {required ? <span className="ml-0.5 text-[var(--error-fg)]">*</span> : null}
      </span>
      {children}
      {error && (
        <span
          className="text-xs text-[var(--error-fg)]"
          role="alert"
          data-error-path={fieldPath}
        >
          {error}
        </span>
      )}
    </label>
  );
}
