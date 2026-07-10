"use client";

import { StarFillGlyph, StarGlyph } from "@/components/icons";
import { useFavorites } from "@/lib/favorites/useFavorites";

interface FavoriteButtonProps {
  recipeId: string;
  recipeTitle: string;
  className?: string;
}

/**
 * Star toggle for the recipe detail header (BRE-46).
 *
 * Renders as a pill-shaped button with an outline / filled star so the two
 * states are visually distinct. The button uses `aria-pressed` to advertise
 * its toggle nature and announces a clear label that includes the recipe
 * title so screen-reader users get the right context.
 *
 * The set is stored in `localStorage` (per-browser) and broadcast through
 * the `brew-favorites-change` event so any other favorite UI on the page —
 * e.g. a card star — stays in sync without prop drilling.
 */
export default function FavoriteButton({
  recipeId,
  recipeTitle,
  className,
}: FavoriteButtonProps) {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(recipeId);

  function handleClick() {
    toggle(recipeId);
  }

  const baseClass =
    "btn no-underline inline-flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
  const toneClass = active
    ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-transparent hover:opacity-90"
    : "btn-outline";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label={
        active
          ? `Remove ${recipeTitle} from favorites`
          : `Add ${recipeTitle} to favorites`
      }
      title={
        active
          ? `Remove "${recipeTitle}" from favorites`
          : `Favorite "${recipeTitle}"`
      }
      data-testid="favorite-button"
      className={`${baseClass} ${toneClass}${className ? ` ${className}` : ""}`}
    >
      {active ? (
        <StarFillGlyph className="h-4 w-4" aria-hidden />
      ) : (
        <StarGlyph className="h-4 w-4" aria-hidden />
      )}
      <span className="font-medium">
        {active ? "Favorited" : "Favorite"}
      </span>
    </button>
  );
}
