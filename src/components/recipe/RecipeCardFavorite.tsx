"use client";

import { StarFillGlyph, StarGlyph } from "@/components/icons";
import { useFavorites } from "@/lib/favorites/useFavorites";

interface RecipeCardFavoriteProps {
  recipeId: string;
  recipeTitle: string;
}

/**
 * Tiny star button overlaid in the corner of a recipe card (BRE-46).
 *
 * The card itself is a `<Link>` so navigating to the detail page is one
 * click anywhere on the card. The star has to sit *inside* the link to
 * anchor itself visually, but clicking it should toggle the favorite state
 * instead of following the link. We stop propagation + prevent default on
 * the click so the parent link never sees it; keyboard activation does the
 * same so Enter on the focused star also doesn't fire the link.
 *
 * The star is a real button, not a styled span, so screen readers and
 * keyboard users get the right affordance. `aria-pressed` advertises the
 * toggle state, and the accessible name includes the recipe title for
 * context.
 */
export default function RecipeCardFavorite({
  recipeId,
  recipeTitle,
}: RecipeCardFavoriteProps) {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(recipeId);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    // Stop the wrapping <Link> from navigating when the star is clicked.
    event.preventDefault();
    event.stopPropagation();
    toggle(recipeId);
  }

  // Keyboard activation (Enter / Space) bubbles up to the parent link as a
  // synthetic click — same handling here so keyboard users get the same
  // "star doesn't navigate" behaviour as mouse users.
  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  const label = active
    ? `Remove ${recipeTitle} from favorites`
    : `Add ${recipeTitle} to favorites`;

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-pressed={active}
      aria-label={label}
      title={active ? `Remove "${recipeTitle}" from favorites` : `Favorite "${recipeTitle}"`}
      data-testid="card-favorite-button"
      data-recipe-id={recipeId}
      data-favorited={active ? "true" : "false"}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
        active
          ? "border-transparent bg-[var(--accent)] text-[var(--accent-foreground)]"
          : "border-[var(--border)] bg-[var(--surface-2)]/85 text-[var(--muted-foreground)] hover:text-[var(--accent)]"
      }`}
    >
      {active ? (
        <StarFillGlyph className="h-4 w-4" aria-hidden />
      ) : (
        <StarGlyph className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
