// Beer colour (SRM) estimation using the Morey equation.
//
//   MCU = sum(grainColorLovibond * weightLb) / volumeGallons
//   SRM = 1.4922 * MCU^0.6859

import type { FermentableInput } from "./types";
import { kgToPounds, litersToGallons, roundTo } from "./units";

/** Malt Colour Units: colour load per gallon, before the Morey correction. */
export function maltColorUnits(
  fermentables: FermentableInput[],
  batchSizeLiters: number,
): number {
  const gallons = litersToGallons(batchSizeLiters);
  if (gallons <= 0) throw new Error("batchSizeLiters must be greater than 0");
  const total = fermentables.reduce((sum, f) => {
    const lovibond = f.colorLovibond ?? 0;
    if (lovibond <= 0 || f.amountKg <= 0) return sum;
    return sum + lovibond * kgToPounds(f.amountKg);
  }, 0);
  return total / gallons;
}

/** Estimate SRM colour from the grain bill via the Morey equation. */
export function estimateSrm(
  fermentables: FermentableInput[],
  batchSizeLiters: number,
): number {
  const mcu = maltColorUnits(fermentables, batchSizeLiters);
  if (mcu <= 0) return 0;
  return roundTo(1.4922 * Math.pow(mcu, 0.6859), 1);
}
