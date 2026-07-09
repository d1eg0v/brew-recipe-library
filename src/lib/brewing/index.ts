// Public entry point for the brewing calculation layer.
//
// Pure, dependency-free functions consumed by the API/UI layers. Import from
// "@/lib/brewing" rather than the individual modules.

import type { RecipeCalcInput, RecipeTargets } from "./types";
import {
  attenuationFromYeasts,
  estimateAbv,
  estimateFg,
  estimateOg,
} from "./gravity";
import { estimateIbu } from "./ibu";
import { estimateSrm } from "./color";

export * from "./types";
export * from "./units";
export * from "./gravity";
export * from "./ibu";
export * from "./color";
export * from "./scaling";
export * from "./shoppingList";
export * from "./batch";
export * from "./checklist";
export * from "./priming";
export * from "./abv";
export * from "./mash";
export * from "./inventory";

/**
 * Compute the full target set (OG/FG/ABV/IBU/SRM) for a recipe in one call.
 * IBU uses the estimated OG as the boil gravity approximation.
 */
export function computeTargets(input: RecipeCalcInput): RecipeTargets {
  const efficiency = input.efficiencyPct ?? 75;
  const og = estimateOg(input.fermentables, input.batchSizeLiters, efficiency);
  const fg = estimateFg(og, attenuationFromYeasts(input.yeasts));
  const abv = estimateAbv(og, fg);
  const ibu = estimateIbu(input.hops, input.batchSizeLiters, og);
  const srm = estimateSrm(input.fermentables, input.batchSizeLiters);
  return { og, fg, abv, ibu, srm };
}
