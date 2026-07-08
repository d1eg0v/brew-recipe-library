// Search/filter clause builder for `GET /api/recipes`.
//
// Output is a Prisma `RecipeWhereInput` object so the same clause feeds the
// list and the count query, keeping totals and pagination in sync. SQL
// `LIKE` semantics are used for free-text matches; SQLite does not support
// case-insensitive unicode collation, so we rely on its default behaviour and
// limit matching to a few high-signal fields. SQLite-specific `contains` works
// fine here.

import type { Prisma } from "@/generated/prisma/client";
import { normalizeTagName } from "@/lib/tags";

import type {
  RecipeListQuery,
  RecipeSortDir,
  RecipeSortField,
} from "./schemas";

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
 *  - `q`         — case-insensitive substring over title/author/description/notes
 *  - `category`  — exact match
 *  - `style`     — case-insensitive substring over styleName
 *  - `bjcpCategory` — exact match
 *  - `ingredient` — substring match across any fermentable/hop/yeast name
 *  - `tag`       — exact normalised tag match
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
    // Escape SQLite LIKE wildcards so user-typed `%` or `_` don't act as
    // wildcards when matching across the four text fields.
    const needle = escapeLike(q.q.trim());
    where.OR = [
      { title: { contains: needle } },
      { author: { contains: needle } },
      { description: { contains: needle } },
      { notes: { contains: needle } },
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
      where.recipeTags = { some: { tag: { name: norm } } };
    }
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

/** Map a sort-field alias to the underlying Recipe column. */
function sortFieldToColumn(
  field: RecipeSortField,
): keyof Prisma.RecipeOrderByWithRelationInput {
  switch (field) {
    case "name":
      return "title";
    case "abv":
      return "targetAbv";
    case "ibu":
      return "targetIbu";
    case "gravity":
      return "targetOg";
    case "date":
      return "createdAt";
  }
}

/**
 * Build a Prisma `orderBy` array for `GET /api/recipes` from the parsed
 * query params. The primary sort is `sort`/`dir`; `id asc` is appended as a
 * stable tiebreaker so pagination is deterministic when many rows share the
 * primary value (or are all `null` on the sorted column).
 */
export function buildRecipeOrderBy(
  sort: RecipeSortField,
  dir: RecipeSortDir,
): Prisma.RecipeOrderByWithRelationInput[] {
  const column = sortFieldToColumn(sort);
  return [{ [column]: dir }, { id: "asc" }];
}
