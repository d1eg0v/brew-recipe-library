"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

interface RecipeActionsProps {
  recipeId: string;
  recipeTitle: string;
}

/**
 * Recipe manage toolbar — duplicate and delete actions on the detail page.
 *
 * Both buttons target the existing backend routes:
 *   - POST   /api/recipes/[id]       (duplicate via /clone subroute, returns new id)
 *   - DELETE /api/recipes/[id]       (deletes, 204)
 *
 * Destructive Delete uses a two-step inline confirmation: the first click swaps
 * the button to "Confirm delete" with a Cancel sibling, and the actual delete
 * only fires from a second click on the confirmation button. Escape clears the
 * pending confirmation.
 */
export default function RecipeActions({
  recipeId,
  recipeTitle,
}: RecipeActionsProps) {
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelId = useId();
  const errorId = useId();

  // Auto-focus the confirm button when the destructive step appears so a
  // keyboard user only needs Enter/Space (not Tab) to fire it.
  useEffect(() => {
    if (confirmingDelete) {
      confirmRef.current?.focus();
    }
  }, [confirmingDelete]);

  // Escape cancels a pending delete confirmation.
  useEffect(() => {
    if (!confirmingDelete) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setConfirmingDelete(false);
        setDeleteError(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmingDelete]);

  const handleDuplicate = useCallback(async () => {
    if (duplicating) return;
    setDuplicating(true);
    setDuplicateError(null);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/clone`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `request failed: ${res.status}`);
      }
      const body = (await res.json()) as { data?: { id?: string } };
      const newId = body.data?.id;
      if (!newId) throw new Error("clone response missing id");
      window.location.assign(`/recipes/${newId}`);
    } catch (err) {
      console.error("duplicate failed", err);
      setDuplicateError(
        err instanceof Error ? err.message : "failed to duplicate recipe",
      );
      setDuplicating(false);
    }
  }, [duplicating, recipeId]);

  const handleDelete = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/recipes/${recipeId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `request failed: ${res.status}`);
      }
      window.location.assign("/");
    } catch (err) {
      console.error("delete failed", err);
      setDeleteError(
        err instanceof Error ? err.message : "failed to delete recipe",
      );
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }, [deleting, recipeId]);

  return (
    <section
      aria-labelledby={labelId}
      className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
    >
      <h2 id={labelId} className="text-base font-semibold mb-3">
        Manage recipe
      </h2>
      <div
        ref={containerRef}
        className="flex flex-wrap items-center gap-3"
      >
        <button
          type="button"
          onClick={handleDuplicate}
          disabled={duplicating || deleting}
          aria-busy={duplicating}
          className="px-4 py-2 rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm font-medium hover:bg-[var(--muted)] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {duplicating ? "Duplicating…" : "Duplicate"}
        </button>

        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => {
              setConfirmingDelete(true);
              setDeleteError(null);
            }}
            disabled={duplicating || deleting}
            className="px-4 py-2 rounded-md border border-[var(--error-border)] bg-[var(--background)] text-[var(--error-fg)] text-sm font-medium hover:bg-[var(--error-bg)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Delete
          </button>
        ) : (
          <span
            role="group"
            aria-label={`Confirm deletion of ${recipeTitle}`}
            className="inline-flex flex-wrap items-center gap-2"
          >
            <button
              ref={confirmRef}
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-busy={deleting}
              aria-describedby={errorId}
              className="px-4 py-2 rounded-md bg-[var(--error-fg)] text-[var(--background)] text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {deleting ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmingDelete(false);
                setDeleteError(null);
              }}
              disabled={deleting}
              className="px-4 py-2 rounded-md border border-[var(--border)] text-sm hover:bg-[var(--muted)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </span>
        )}
      </div>

      {(duplicateError || deleteError) && (
        <p
          id={errorId}
          role="alert"
          className="mt-3 text-sm text-[var(--error-fg)]"
        >
          {duplicateError
            ? `Couldn’t duplicate recipe: ${duplicateError}`
            : `Couldn’t delete recipe: ${deleteError}`}
        </p>
      )}
      {confirmingDelete && !deleteError && (
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          Deleting cannot be undone. Press Escape to cancel.
        </p>
      )}
    </section>
  );
}
