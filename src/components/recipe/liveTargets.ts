// Live-computed target preview for the recipe form.
//
// Reuses the canonical `computeTargets` from `@/lib/brewing` so the preview
// matches the API calculations exactly. Guards against partial/invalid
// intermediate state (empty batch size, missing fermentable amounts) by
// returning `null` for any metric that cannot be computed confidently.

import {
  computeTargets,
  type FermentableInput,
  type HopInput,
  type RecipeTargets,
  type YeastInput,
} from "@/lib/brewing";
import type {
  FermentableRowState,
  HopRowState,
  RecipeFormState,
  YeastRowState,
} from "./recipeFormState";

/** A preview payload — `null` means the metric cannot be computed yet. */
export interface LiveTargets {
  og: number | null;
  fg: number | null;
  abv: number | null;
  ibu: number | null;
  srm: number | null;
}

function fermentableInputs(rows: FermentableRowState[]): FermentableInput[] {
  const out: FermentableInput[] = [];
  for (const r of rows) {
    if (!r.name.trim()) continue;
    const kg = r.amountKg ?? 0;
    if (!(kg > 0) && !(r.amountLiters != null && r.amountLiters > 0)) continue;
    // Calc layer only reads `amountKg`; liquid fermentables contribute zero
    // gravity points here (kept future-proof by passing the field through).
    out.push({
      type: r.type || undefined,
      amountKg: kg,
      potentialPpg: r.potentialPpg,
      colorLovibond: r.colorLovibond,
    });
  }
  return out;
}

function hopInputs(rows: HopRowState[]): HopInput[] {
  const out: HopInput[] = [];
  for (const r of rows) {
    if (!r.name.trim()) continue;
    const grams = r.amountGrams ?? 0;
    const time = r.timeMinutes ?? 0;
    if (!(grams > 0) || !(time >= 0)) continue;
    out.push({
      amountGrams: grams,
      alphaAcidPct: r.alphaAcidPct,
      timeMinutes: time,
      use: r.use || undefined,
    });
  }
  return out;
}

function yeastInputs(rows: YeastRowState[]): YeastInput[] {
  const out: YeastInput[] = [];
  for (const r of rows) {
    if (!r.name.trim()) continue;
    out.push({
      attenuationPct: r.attenuationPct,
    });
  }
  return out;
}

/**
 * Compute OG/FG/ABV/IBU/SRM from the current form state. Returns `null` for
 * any metric the form doesn't have enough valid input to compute.
 */
export function computeLiveTargets(state: RecipeFormState): LiveTargets {
  const batch = state.batchSizeLiters;
  if (!(batch > 0)) {
    return { og: null, fg: null, abv: null, ibu: null, srm: null };
  }
  const fermentables = fermentableInputs(state.fermentables);
  const hops = hopInputs(state.hops);
  const yeasts = yeastInputs(state.yeasts);
  if (fermentables.length === 0) {
    return { og: null, fg: null, abv: null, ibu: null, srm: null };
  }
  const efficiency = state.efficiencyPct ?? 75;
  const targets: RecipeTargets = computeTargets({
    batchSizeLiters: batch,
    efficiencyPct: efficiency,
    fermentables,
    hops,
    yeasts,
  });
  return targets;
}
