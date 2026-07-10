"use client";

import Link from "next/link";

import { ReactNode } from "react";

import { useFavorites } from "@/lib/favorites/useFavorites";

interface BrowseFavoritesGridProps {
  /** Server-rendered card markup, one node per recipe. Order matters. */
  children: ReactNode[];
  /** Whether `?favorites=1` is set in the URL. Hides non-favorites when true. */
  filterActive: boolean;
  /**
   * Function that returns the recipe id for a card at the given index.
   * Caller (the server-component page) supplies this so the order matches
   * between the rendered list and the favorites set.
   */
  recipeIds: string[];
  /** Empty-state prop kept stable across server/client renders. */
  recipeCount: number;
}

/**
 * Wrapper around the server-rendered card grid (BRE-46).
 *
 * When `?favorites=1` is set, the page hydrates the favorites set from
 * `localStorage` and hides the cards whose ids aren't in it. The server
 * still renders every card so SEO / no-JS users see the full library;
 * the filter just collapses the visible count to match the chip.
 *
 * The wrapper also handles an "empty after filter" state: if the user
 * has `?favorites=1` on but no favorites yet (or none of the favorite
 * recipes are in the current slice), we show a clear call-to-action
 * instead of a confusing blank page.
 */
export default function BrowseFavoritesGrid({
  children,
  filterActive,
  recipeIds,
  recipeCount,
}: BrowseFavoritesGridProps) {
  const { ids } = useFavorites();

  if (!filterActive) {
    return (
      <ul
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
        data-testid="recipe-grid"
        data-favorites-filter="off"
      >
        {children}
      </ul>
    );
  }

  const favoriteSet = new Set(ids);
  const visible: ReactNode[] = [];
  let hiddenCount = 0;
  children.forEach((node, index) => {
    const id = recipeIds[index];
    if (id != null && favoriteSet.has(id)) {
      visible.push(node);
    } else {
      hiddenCount += 1;
    }
  });

  if (visible.length === 0) {
    return (
      <div
        data-testid="recipe-grid-empty"
        data-favorites-filter="on"
        className="section text-center py-16"
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--muted-foreground)]">
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 3.6 14.7 9l5.9.6-4.4 4 1.3 5.8L12 16.6 6.5 19.4 7.8 13.6 3.4 9.6 9.3 9Z" />
          </svg>
        </div>
        <h2 className="font-display mt-4 text-2xl font-semibold">
          {ids.length === 0
            ? "No favorites yet"
            : "No favorites match your filters"}
        </h2>
        <p className="mt-2 text-[var(--muted-foreground)]">
          {ids.length === 0
            ? `Tap the star on any recipe to add it here. Toggle the chip above to see all ${recipeCount} recipes.`
            : "Try clearing other filters or removing this one."}
        </p>
        <Link
          href="/"
          className="btn btn-primary mt-5 no-underline"
          data-testid="clear-favorites-filter"
        >
          Show all recipes
        </Link>
      </div>
    );
  }

  return (
    <>
      <ul
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
        data-testid="recipe-grid"
        data-favorites-filter="on"
        data-hidden-count={hiddenCount}
      >
        {visible}
      </ul>
      {hiddenCount > 0 && (
        <p className="mt-4 text-xs text-[var(--muted-foreground)]">
          {hiddenCount} of {recipeCount} recipes hidden by the favorites
          filter.
        </p>
      )}
    </>
  );
}
