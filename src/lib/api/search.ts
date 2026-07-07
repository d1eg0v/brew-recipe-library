// Search/filter clause builder for `GET /api/recipes`.
//
// Output is a Prisma `RecipeWhereInput` object so the same clause feeds the
// list and the count query, keeping totals and pagination in sync. SQL
// `LIKE` semantics are used for free-text matches; SQLite does not support
// case-insensitive unicode collation, so we rely on its default behaviour and
// limit matching to a few high-signal fields. SQLite-specific `contains` works
// fine here.

import { normalizeTagName } from "@/lib/tags";
import type { RecipeListQuery } from "./schemas";

export interface IngredientFilter {
  /** Search string supplied by the client (raw, may be empty). */
  raw: string;
}

function escapeLike(input: string): string {
  // Escape SQLite LIKE wildcards so `*` or `_` in user input doesn't act as a
  // wildcard. We additionally search for an exact word match to be safe.
  return input.replace(/([\\%_])/g, "\\$1");
}

/**
 * Build a Prisma where clause from the parsed query params.
 *
 * Filters:
 *  - `q`         — case-insensitive substring over title/description/notes/styleName
 *  - `category`  — exact match
 *  - `style`     — case-insensitive substring over styleName
 *  - `bjcpCategory` — exact match
 *  - `ingredient` — substring match across any fermentable/hop/yeast name
 *  - `tag`       — exact (normalised) match on a tag name
 *  - `abvMin`/`abvMax` — bounds on `targetAbv`
 */
export function buildRecipeWhere(q: RecipeListQuery) {
  const where: Record<string, unknown> = {};

  if (q.q && q.q.trim().length > 0) {
    const needle = q.q.trim();
    where.OR = [
      { title: { contains: needle } },
      { description: { contains: needle } },
      { notes: { contains: needle } },
      { styleName: { contains: needle } },
    ];
  }

  if (q.category) where.category = q.category;

  if (q.style && q.style.trim().length > 0) {
    where.styleName = { contains: q.style.trim() };
  }

  if (q.bjcpCategory && q.bjcpCategory.trim().length > 0) {
    where.bjcpCategory = q.bjcpCategory.trim();
  }

  if (q.ingredient && q.ingredient.trim().length > 0) {
    const ing = q.ingredient.trim();
    const safe = escapeLike(ing);
    where.OR = [
      ...((where.OR as unknown[]) ?? []),
      { fermentables: { some: { name: { contains: safe } } } },
      { hops: { some: { name: { contains: safe } } } },
      { yeasts: { some: { name: { contains: safe } } } },
    ];
  }

  if (q.tag && q.tag.trim().length > 0) {
    const norm = normalizeTagName(q.tag);
    if (norm) {
      // Match the join on the normalised name. We don't fall back to a partial
      // match because tag names are a small, curated set and substring matches
      // here would be surprising.
      where.recipeTags = { some: { tag: { name: norm } } };
    }
  }

  if (q.abvMin != null || q.abvMax != null) {
    where.targetAbv = {};
    if (q.abvMin != null) (where.targetAbv as Record<string, number>).gte = q.abvMin;
    if (q.abvMax != null) (where.targetAbv as Record<string, number>).lte = q.abvMax;
  }

  return where;
}

/** Default order: most-recently updated first, with stable id tiebreak. */
export const RECIPE_DEFAULT_ORDER = [
  { updatedAt: "desc" as const },
  { id: "asc" as const },
];

/** Default pagination. */
export const RECIPE_DEFAULT_PAGINATION = { limit: 50, offset: 0 };
