"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { RecipeListItem } from "@/lib/ui/types";
import { categoryLabel } from "@/lib/ui/format";

interface ComparePickerProps {
  /** Pre-fill for the left column. */
  initialA?: string | null;
  /** Pre-fill for the right column. */
  initialB?: string | null;
  className?: string;
}

/**
 * Small form for picking two recipes to compare. We keep the
 * `useState` for the client-side "select" interaction (so the disabled
 * state on the other column updates as the user picks), but submit is a
 * plain GET to the current path so the form works without JavaScript and
 * renders cleanly under `renderToStaticMarkup` in tests.
 */
export default function ComparePicker({
  initialA = null,
  initialB = null,
  className,
}: ComparePickerProps) {
  const [a, setA] = useState<string>(initialA ?? "");
  const [b, setB] = useState<string>(initialB ?? "");
  const [recipes, setRecipes] = useState<RecipeListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/recipes?limit=200", { cache: "no-store" });
        if (!res.ok) throw new Error(`list failed: ${res.status}`);
        const body = (await res.json()) as { data: RecipeListItem[] };
        if (cancelled) return;
        setRecipes(body.data ?? []);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load recipes",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <form
      method="get"
      action="/recipes/compare"
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${className ?? ""}`}
      aria-label="Pick two recipes to compare"
      data-testid="compare-picker"
    >
      <div>
        <label htmlFor="compare-a" className="label-eyebrow block mb-1.5">
          Left column
        </label>
        <select
          id="compare-a"
          name="a"
          className="field field-mono"
          value={a}
          onChange={(e) => setA(e.target.value)}
        >
          <option value="">Pick a recipe…</option>
          {recipes?.map((r) => (
            <option
              key={r.id}
              value={r.id}
              disabled={b !== "" && r.id === b}
            >
              [{categoryLabel(r.category)}] {r.title}
              {r.styleName ? ` — ${r.styleName}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="compare-b" className="label-eyebrow block mb-1.5">
          Right column
        </label>
        <select
          id="compare-b"
          name="b"
          className="field field-mono"
          value={b}
          onChange={(e) => setB(e.target.value)}
        >
          <option value="">Pick a second recipe…</option>
          {recipes?.map((r) => (
            <option
              key={r.id}
              value={r.id}
              disabled={a !== "" && r.id === a}
            >
              [{categoryLabel(r.category)}] {r.title}
              {r.styleName ? ` — ${r.styleName}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!a || !b}
          data-testid="compare-submit"
        >
          Compare
        </button>
        <Link
          href="/recipes/compare"
          className="btn btn-ghost no-underline"
        >
          Clear
        </Link>
        {error && (
          <span role="alert" className="text-sm text-[var(--error-fg)]">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
