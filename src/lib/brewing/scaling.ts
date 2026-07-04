// Batch-size scaling.
//
// Gravity, IBU and colour are concentration-based (mass per unit volume), so
// scaling a recipe to a new batch size means multiplying every ingredient
// amount by newVolume/oldVolume. The style targets (OG/FG/IBU/SRM/ABV) stay
// the same, which is exactly what a brewer expects when resizing a batch.

/** Compute the linear scale factor between two batch volumes. */
export function scaleFactor(fromLiters: number, toLiters: number): number {
  if (fromLiters <= 0) throw new Error("fromLiters must be greater than 0");
  if (toLiters <= 0) throw new Error("toLiters must be greater than 0");
  return toLiters / fromLiters;
}

/** The ingredient amount fields that scale linearly with batch volume. */
const SCALABLE_AMOUNT_FIELDS = [
  "amountKg",
  "amountGrams",
  "infuseAmountLiters",
] as const;

/**
 * Return a copy of an ingredient with its known amount fields multiplied by
 * `factor`. Non-amount fields (name, colour, alpha %, times, etc.) are left
 * untouched. Unknown shapes pass through unchanged except for matched fields.
 */
export function scaleIngredient<T extends Record<string, unknown>>(
  ingredient: T,
  factor: number,
): T {
  const scaled: Record<string, unknown> = { ...ingredient };
  for (const field of SCALABLE_AMOUNT_FIELDS) {
    const value = scaled[field];
    if (typeof value === "number") {
      scaled[field] = value * factor;
    }
  }
  return scaled as T;
}

/** Scale every ingredient in a list by `factor`. */
export function scaleIngredients<T extends Record<string, unknown>>(
  ingredients: T[],
  factor: number,
): T[] {
  return ingredients.map((i) => scaleIngredient(i, factor));
}

export interface ScalableRecipe {
  batchSizeLiters: number;
  fermentables?: Record<string, unknown>[];
  hops?: Record<string, unknown>[];
  yeasts?: Record<string, unknown>[];
  mashSteps?: Record<string, unknown>[];
}

/**
 * Scale a whole recipe to `toLiters`. Ingredient amounts are recomputed;
 * gravity/colour/bitterness targets are unchanged because they are volume
 * independent. Returns a new object; the input is not mutated.
 */
export function scaleRecipe<T extends ScalableRecipe>(recipe: T, toLiters: number): T {
  const factor = scaleFactor(recipe.batchSizeLiters, toLiters);
  return {
    ...recipe,
    batchSizeLiters: toLiters,
    fermentables: recipe.fermentables ? scaleIngredients(recipe.fermentables, factor) : recipe.fermentables,
    hops: recipe.hops ? scaleIngredients(recipe.hops, factor) : recipe.hops,
    yeasts: recipe.yeasts,
    mashSteps: recipe.mashSteps ? scaleIngredients(recipe.mashSteps, factor) : recipe.mashSteps,
  };
}
