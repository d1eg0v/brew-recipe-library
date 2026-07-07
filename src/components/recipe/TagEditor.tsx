"use client";

import { useCallback, useState, useTransition } from "react";

import TagChip from "@/components/TagChip";
import { normalizeTagName } from "@/lib/tags";

interface TagEditorProps {
  recipeId: string;
  initialTags: string[];
  onChange?: (next: string[]) => void;
}

/**
 * Inline tag editor for a recipe (BRE-29). Lets the user add a new tag by
 * typing a name and pressing Enter, or remove an existing one via the × on the
 * chip. All requests go through the recipe-scoped tag routes.
 */
export default function TagEditor({
  recipeId,
  initialTags,
  onChange,
}: TagEditorProps) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const commit = useCallback(
    (next: string[]) => {
      setTags(next);
      onChange?.(next);
    },
    [onChange],
  );

  async function addTag(rawName: string) {
    const norm = normalizeTagName(rawName);
    if (!norm) {
      setError("Tag name cannot be empty");
      return;
    }
    if (tags.includes(norm)) {
      setError(`"${norm}" is already added`);
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/tags`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: rawName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message =
          (body && typeof body === "object" && body.error?.message) ||
          `Request failed (${res.status})`;
        setError(message);
        return;
      }
      const next = [...tags, norm].sort((a, b) => a.localeCompare(b));
      commit(next);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add tag");
    }
  }

  async function removeTag(name: string) {
    setError(null);
    const previous = tags;
    const optimistic = tags.filter((t) => t !== name);
    commit(optimistic);
    try {
      const res = await fetch(
        `/api/recipes/${recipeId}/tags/${encodeURIComponent(name)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        commit(previous);
        const body = await res.json().catch(() => null);
        const message =
          (body && typeof body === "object" && body.error?.message) ||
          `Request failed (${res.status})`;
        setError(message);
      }
    } catch (err) {
      commit(previous);
      setError(err instanceof Error ? err.message : "Failed to remove tag");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const v = draft.trim();
      if (v.length === 0) return;
      startTransition(() => {
        void addTag(v);
      });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {tags.length === 0 ? (
          <span className="text-sm text-[var(--muted-foreground)]">
            No tags yet.
          </span>
        ) : (
          tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1"
            >
              <TagChip name={t} asLink size="sm" />
              <button
                type="button"
                onClick={() =>
                  startTransition(() => {
                    void removeTag(t);
                  })
                }
                disabled={pending}
                aria-label={`Remove tag ${t}`}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Add a tag (e.g. session, competition)"
          aria-label="New tag"
          className="flex-1 border border-[var(--border)] rounded-md px-3 py-1.5 bg-[var(--background)] text-[var(--foreground)] text-sm"
        />
        <button
          type="button"
          onClick={() => {
            const v = draft.trim();
            if (v.length === 0) return;
            startTransition(() => {
              void addTag(v);
            });
          }}
          disabled={pending || draft.trim().length === 0}
          className="px-3 py-1.5 rounded-md border border-[var(--border)] text-sm hover:bg-[var(--muted)] disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {error && (
        <p className="text-xs text-[var(--error-fg)]">{error}</p>
      )}
    </div>
  );
}
