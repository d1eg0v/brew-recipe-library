// Presentation helpers for tags (BRE-29).
//
// Pure functions that shape `Tag` and `RecipeTag` rows for API/UI consumption.

export interface TagRow {
  id: string;
  name: string;
  createdAt: Date | string;
}

export interface RecipeTagLinkRow {
  recipeId: string;
  tagId: string;
  tag: TagRow;
  createdAt?: Date | string;
}

/** A minimal `{ id, name }` view safe for JSON serialisation. */
export function presentTag(tag: TagRow) {
  return {
    id: tag.id,
    name: tag.name,
    createdAt:
      tag.createdAt instanceof Date
        ? tag.createdAt.toISOString()
        : String(tag.createdAt),
  };
}

/** Extract the ordered list of tags attached via `recipeTags`. */
export function tagsFromRecipeTags(
  recipeTags: RecipeTagLinkRow[] | undefined,
): TagRow[] {
  if (!recipeTags) return [];
  return recipeTags
    .map((rt) => rt.tag)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Tag-with-usage-count row for the `/api/tags` listing. */
export interface TagWithCount extends ReturnType<typeof presentTag> {
  recipeCount: number;
}

export function presentTagWithCount(
  tag: TagRow,
  recipeCount: number,
): TagWithCount {
  return { ...presentTag(tag), recipeCount };
}
