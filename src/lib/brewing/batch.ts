// Derived metrics for a logged brew (Batch): achieved ABV, apparent
// attenuation, and brewhouse efficiency computed from measured values.
//
// These mirror the recipe-target estimators in ./gravity but operate on what
// was actually measured on brew day rather than on the planned grain bill. Per
// the schema convention, nothing here is persisted — the Batch row stores the
// raw measurements and these functions derive the rest on demand.

import type { FermentableInput } from "./types";
import { estimateAbv, totalGravityPoints } from "./gravity";
import { litersToGallons, roundTo } from "./units";

/**
 * Achieved alcohol by volume from measured original and final gravity.
 * Same formula as the recipe estimate (ABV = (OG - FG) * 131.25); named for the
 * batch domain so callers read as "actual", not "target".
 */
export function actualAbv(measuredOg: number, measuredFg: number): number {
  return estimateAbv(measuredOg, measuredFg);
}

/**
 * Apparent attenuation (%) from measured gravities.
 * Attenuation = (OG - FG) / (OG - 1) * 100. Returns 0 when there are no
 * fermentable points (OG <= 1), avoiding a divide-by-zero.
 */
export function apparentAttenuation(measuredOg: number, measuredFg: number): number {
  const ogPoints = measuredOg - 1;
  if (ogPoints <= 0) return 0;
  return roundTo(((measuredOg - measuredFg) / ogPoints) * 100, 1);
}

/**
 * Achieved brewhouse efficiency (%) for a brew: the gravity points actually
 * collected versus the theoretical maximum from the grain bill at 100%.
 *
 * measuredPoints = (measuredOg - 1) * 1000 * volumeGallons
 * maxPoints      = totalGravityPoints(fermentables, 100)
 *
 * Returns 0 when the grain bill can contribute no points (maxPoints <= 0).
 * Throws on a non-positive volume, matching estimateOg's guard style.
 */
export function brewhouseEfficiency(
  fermentables: FermentableInput[],
  measuredOg: number,
  volumeLiters: number,
): number {
  const gallons = litersToGallons(volumeLiters);
  if (gallons <= 0) throw new Error("volumeLiters must be greater than 0");
  const maxPoints = totalGravityPoints(fermentables, 100);
  if (maxPoints <= 0) return 0;
  const measuredPoints = (measuredOg - 1) * 1000 * gallons;
  return roundTo((measuredPoints / maxPoints) * 100, 1);
}
