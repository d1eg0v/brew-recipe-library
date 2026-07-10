// Response presentation for the recipe API.
//
// Pure functions: takes a loaded recipe (or anything with the same shape) and
// returns a presentation copy with optional scaling and unit conversion. None
// of these mutate the input — the DB record stays metric.

import {
  celsiusToFahrenheit,
  gramsToOunces,
  kgToPounds,
  litersToGallons,
  roundTo,
} from "@/lib/brewing/units";
import { tagsFromRecipeTags, type RecipeTagLinkRow } from "./presentTags";
import type { UnitSystem } from "./schemas";

const SCALE_KEYS = [
  "amountKg",
  "amountGrams",
  "amountLiters",
  "infuseAmountLiters",
] as const;

/** Scale every known amount field on an object by `factor`. */
export function scaleAmountFields<T extends Record<string, unknown>>(
  obj: T,
  factor: number,
): T {
  const out: Record<string, unknown> = { ...obj };
  for (const key of SCALE_KEYS) {
    const v = out[key];
    if (typeof v === "number") out[key] = roundTo(v * factor, 4);
  }
  return out as T;
}

/** Linear scale all amount-bearing children. */
export function scaleChildren<T extends Record<string, unknown>>(
  list: T[] | undefined,
  factor: number,
): T[] | undefined {
  if (!list) return list;
  return list.map((c) => scaleAmountFields(c, factor));
}

/** Convert an ingredient's mass/volume from metric to imperial (mutates a copy). */
function toImperial<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = { ...obj };
  if (typeof out.amountKg === "number") {
    out.amountLbs = roundTo(kgToPounds(out.amountKg), 3);
  }
  if (typeof out.amountGrams === "number") {
    out.amountOz = roundTo(gramsToOunces(out.amountGrams), 3);
  }
  if (typeof out.amountLiters === "number") {
    out.amountGallons = roundTo(litersToGallons(out.amountLiters), 3);
  }
  if (typeof out.infuseAmountLiters === "number") {
    out.infuseAmountGallons = roundTo(
      litersToGallons(out.infuseAmountLiters),
      3,
    );
  }
  return out as T;
}

function toMetric<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = { ...obj };
  // Strip any imperial fields if the incoming payload had them set.
  for (const k of [
    "amountLbs",
    "amountOz",
    "amountGallons",
    "infuseAmountGallons",
  ]) {
    delete out[k];
  }
  return out as T;
}

function tempsToImperial<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = { ...obj };
  if (typeof out.stepTempC === "number")
    out.stepTempF = roundTo(celsiusToFahrenheit(out.stepTempC), 1);
  if (typeof out.tempC === "number")
    out.tempF = roundTo(celsiusToFahrenheit(out.tempC), 1);
  if (typeof out.temperatureCMin === "number")
    out.temperatureFMin = roundTo(celsiusToFahrenheit(out.temperatureCMin), 1);
  if (typeof out.temperatureCMax === "number")
    out.temperatureFMax = roundTo(celsiusToFahrenheit(out.temperatureCMax), 1);
  return out as T;
}

function tempsToMetric<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = { ...obj };
  for (const k of ["stepTempF", "tempF", "temperatureFMin", "temperatureFMax"]) {
    delete out[k];
  }
  return out as T;
}

/** Convert one child list to the requested unit system. */
function convertChildren<T extends Record<string, unknown>>(
  list: T[] | undefined,
  units: UnitSystem,
): T[] | undefined {
  if (!list) return list;
  return list.map((c) => {
    const next = units === "imperial" ? toImperial(c) : toMetric(c);
    return units === "imperial" ? tempsToImperial(next) : tempsToMetric(next);
  }) as T[];
}

/**
 * Presentation options for a recipe response.
 *  - `batchSize` (litres) — when set, re-scales all ingredient amounts.
 *  - `units` — "metric" (default) or "imperial"; the source values stay in
 *    metric (canonical), and imperial-valued fields are *added* alongside.
 */
export interface PresentOptions {
  batchSize?: number;
  units?: UnitSystem;
}

/** A loose "any recipe" view so we can return DB rows or scaled copies. */
export interface RecipeView {
  batchSizeLiters: number;
  fermentables?: Record<string, unknown>[];
  hops?: Record<string, unknown>[];
  yeasts?: Record<string, unknown>[];
  mashSteps?: Record<string, unknown>[];
  processSteps?: Record<string, unknown>[];
  additions?: Record<string, unknown>[];
  recipeTags?: RecipeTagLinkRow[];
  [k: string]: unknown;
}

/**
 * Apply scale + unit conversion to a recipe (and any children) and return a
 * shallow copy. Returns the input unchanged when neither option is set.
 */
export function presentRecipe<T extends RecipeView>(
  recipe: T,
  options: PresentOptions = {},
): T {
  const units: UnitSystem = options.units ?? "metric";
  const factor =
    options.batchSize != null && options.batchSize > 0 && recipe.batchSizeLiters > 0
      ? options.batchSize / recipe.batchSizeLiters
      : null;

  let next: Record<string, unknown> = { ...recipe };
  if (typeof next.beverageType !== "string" && typeof next.category === "string") {
    next.beverageType = next.category;
  }

  if (factor != null && factor !== 1) {
    next = scaleAmountFields(next, factor);
    next.fermentables = scaleChildren(
      recipe.fermentables,
      factor,
    );
    next.hops = scaleChildren(recipe.hops, factor);
    next.yeasts = recipe.yeasts;
    next.mashSteps = scaleChildren(recipe.mashSteps, factor);
    next.processSteps = recipe.processSteps;
    next.additions = recipe.additions;
    next.batchSizeLiters = roundTo(options.batchSize!, 3);
  }

  next.fermentables = convertChildren(
    next.fermentables as Record<string, unknown>[] | undefined,
    units,
  );
  next.hops = convertChildren(next.hops as Record<string, unknown>[] | undefined, units);
  next.yeasts = convertChildren(
    next.yeasts as Record<string, unknown>[] | undefined,
    units,
  );
  next.mashSteps = convertChildren(
    next.mashSteps as Record<string, unknown>[] | undefined,
    units,
  );
  next.processSteps = convertChildren(
    next.processSteps as Record<string, unknown>[] | undefined,
    units,
  );
  next.additions = convertChildren(
    next.additions as Record<string, unknown>[] | undefined,
    units,
  );

  if (units === "imperial") {
    if (typeof next.batchSizeLiters === "number") {
      next.batchSizeGallons = roundTo(litersToGallons(next.batchSizeLiters), 3);
    }
  } else {
    delete next.batchSizeGallons;
  }

  // Tags (BRE-29): flatten the `recipeTags` join into a sorted `tags: string[]`
  // so the client can render chips without traversing the join table.
  const recipeTags = (recipe.recipeTags ??
    (next.recipeTags as RecipeTagLinkRow[] | undefined)) as
    | RecipeTagLinkRow[]
    | undefined;
  const tags = tagsFromRecipeTags(recipeTags);
  next.tags = tags.map((t) => t.name);
  next.tagDetails = tags.map((t) => ({ id: t.id, name: t.name }));
  delete next.recipeTags;

  // Average rating (BRE-39): compute mean of non-null tasting ratings across
  // all batches, if the recipe includes batch+batchLog data (detail queries).
  const batches = (recipe as Record<string, unknown>).batches as
    | Array<Record<string, unknown>>
    | undefined;
  if (batches) {
    const ratings: number[] = [];
    for (const b of batches) {
      const logs = b.logs as Array<Record<string, unknown>> | undefined;
      if (!logs) continue;
      for (const l of logs) {
        if (l.type === "tasting" && typeof l.rating === "number") {
          ratings.push(l.rating);
        }
      }
    }
    next.averageRating =
      ratings.length > 0
        ? roundTo(ratings.reduce((a, b) => a + b, 0) / ratings.length, 1)
        : null;
  } else {
    next.averageRating = null;
  }

  return next as T;
}
