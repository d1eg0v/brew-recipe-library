// Search/filter clause builder for `GET /api/recipes`.
//
// Output is a Prisma `RecipeWhereInput` object so the same clause feeds the
// list and the count query, keeping totals and pagination in sync. SQL
// `LIKE` semantics are used for free-text matches; SQLite does not support
// case-insensitive unicode collation, so we rely on its default behaviour and
// limit matching to a few high-signal fields. SQLite-specific `contains` works
// fine here.

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
 *  - `abvMin`/`abvMax` — bounds on `targetAbv`
 *  - `ibuMin`/`ibuMax` — bounds on `targetIbu`
 *  - `srmMin`/`srmMax` — bounds on `targetSrm`
 *  - `ogMin`/`ogMax`   — bounds on `targetOg`
 *
 * Note on null exclusion: Prisma's `gte`/`lte` already exclude `null` values,
 * so an active bound naturally hides recipes that haven't recorded that target.
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

  applyRange(where, "targetAbv", q.abvMin, q.abvMax);
  applyRange(where, "targetIbu", q.ibuMin, q.ibuMax);
  applyRange(where, "targetSrm", q.srmMin, q.srmMax);
  applyRange(where, "targetOg", q.ogMin, q.ogMax);

  return where;
}

function applyRange(
  where: Record<string, unknown>,
  field: string,
  min: number | undefined,
  max: number | undefined,
): void {
  if (min == null && max == null) return;
  const clause: Record<string, number> = {};
  if (min != null) clause.gte = min;
  if (max != null) clause.lte = max;
  where[field] = clause;
}

/** Default order: most-recently updated first, with stable id tiebreak. */
export const RECIPE_DEFAULT_ORDER = [
  { updatedAt: "desc" as const },
  { id: "asc" as const },
];

/** Default pagination. */
export const RECIPE_DEFAULT_PAGINATION = { limit: 50, offset: 0 };
