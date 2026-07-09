// Pure recipe data imported from the curator's seed JSON. The seed script and
// the route-handler validation paths both type-check against the same shape
// described here.

import type { RecipeCreateBody } from "@/lib/api/schemas";

/**
 * Type guard that a parsed JSON node looks like a single seed recipe. Loose by
 * design — we deliberately trust the curator's file rather than re-validating
 * every field. Per-field coercion (sensible defaults + lazy trimming) happens
 * in `normalizeSeedRecipe`.
 */
export function isSeedRecipe(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const title = (value as Record<string, unknown>).title;
  return typeof title === "string" && title.trim().length > 0;
}

/** Strip `id` fields — the curator's seed file shouldn't dictate DB IDs. */
function stripIds(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(stripIds);
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (k === "id") continue;
      if (v === null) continue;
      out[k] = stripIds(v);
    }
    return out;
  }
  return input;
}

/**
 * Coerce a single seed entry into the shape expected by the recipe POST
 * validator. Mutates the returned object minimally — values are left as-is
 * except for stripping `id`s and trimming strings so the validator accepts the
 * payload without further edits.
 */
export function normalizeSeedRecipe(input: Record<string, unknown>): RecipeCreateBody {
  const stripped = stripIds(input) as Record<string, unknown>;
  const beverageType = stripped.beverageType ?? stripped.category;
  if (typeof beverageType === "string" && beverageType.length > 0) {
    stripped.category = beverageType;
    stripped.beverageType = beverageType;
  }
  return stripped as unknown as RecipeCreateBody;
}

/** Top-level loader entry: read the JSON file and return recipes ready for upsert. */
export function loadSeedRecipes(json: unknown): RecipeCreateBody[] {
  if (!Array.isArray(json)) {
    throw new Error("Seed file must be a JSON array of recipes");
  }
  const out: RecipeCreateBody[] = [];
  for (let i = 0; i < json.length; i++) {
    const entry = json[i];
    if (!isSeedRecipe(entry)) {
      const title =
        entry && typeof entry === "object"
          ? (entry as Record<string, unknown>).title
          : undefined;
      throw new Error(`Seed entry ${i} (${String(title)}) missing required "title"`);
    }
    out.push(normalizeSeedRecipe(entry));
  }
  return out;
}

/** For convenience when invoking the loader directly with the file. */
export function loadSeedRecipesFromJsonText(text: string): RecipeCreateBody[] {
  const parsed: unknown = JSON.parse(text);
  return loadSeedRecipes(parsed);
}
