// Priming-sugar (carbonation) calculator.
//
// Given a target CO2 volume, batch volume, and conditioning temperature, this
// module computes the mass of priming sugar to add at bottling. The math uses
// Tinseth's published coefficients (https://www.tinseth.com/priming.php) —
// these are the same values the homebrew community has been using for two
// decades and they remain the most-cited reference for bottle conditioning.
//
// The calculation is:
//   1. residualVolumes = f(temperatureF)           — Henry's law for CO2 already
//                                                   dissolved at the chosen
//                                                   conditioning temperature.
//   2. volumesToAdd     = max(0, target - residual)
//   3. weightOz         = gallons * volumesToAdd * sugarMultiplier
//   4. weightGrams      = weightOz * 28.3495
//
// `sugarMultiplier` is the published mass of sugar (in ounces per US gallon) it
// takes to produce one extra volume of CO2:
//
//   corn sugar (dextrose):  0.5  oz/gal/volume
//   table sugar (sucrose):  0.54 oz/gal/volume
//   dry malt extract (DME): 0.96 oz/gal/volume
//
// DME is roughly two-thirds the fermentability of refined sugar, which is why
// you need almost twice as much of it for the same carbonation.

import { roundTo } from "./units";

/** Sugar options the calculator supports. */
export const PRIMING_SUGAR_TYPES = [
  "cornSugar",
  "tableSugar",
  "dme",
] as const;
export type PrimingSugarType = (typeof PRIMING_SUGAR_TYPES)[number];

/**
 * Tinseth's published multipliers (oz per US gallon per extra volume of CO2).
 * Kept as the source of truth so the conversion to metric happens in one
 * well-tested place.
 */
export const PRIMING_SUGAR_OZ_PER_GAL_PER_VOLUME: Record<PrimingSugarType, number> =
  {
    cornSugar: 0.5,
    tableSugar: 0.54,
    dme: 0.96,
  };

/** Ounces to grams (NIST). */
const GRAMS_PER_OUNCE = 28.349523125;

export interface PrimingSugarInput {
  /** Batch volume at bottling, in litres. */
  volumeLiters: number;
  /** Target volumes of CO2 (e.g. 2.5 for typical ales, 3.5 for Belgian ales). */
  targetVolumes: number;
  /** Conditioning temperature in degrees Celsius. */
  temperatureC: number;
  /** Which priming sugar the brewer is using. */
  sugarType: PrimingSugarType;
}

export interface PrimingSugarResult {
  /** Mass of priming sugar to add, in grams (rounded to 1 decimal). */
  weightGrams: number;
  /** Same mass, in ounces (rounded to 2 decimals) — for imperial-mode display. */
  weightOz: number;
  /** CO2 already in solution at the conditioning temperature, in volumes. */
  residualVolumes: number;
  /** Net CO2 the sugar needs to deliver (`max(0, target - residual)`), volumes. */
  volumesToAdd: number;
  /** Echo of the sugar type. */
  sugarType: PrimingSugarType;
  /** Echo of the input (for clients that want to round-trip). */
  input: PrimingSugarInput;
}

/**
 * CO2 already in solution at the conditioning temperature, in volumes.
 *
 * Source: Tinseth, "Priming Sugar Calculator" (2003) — cubic polynomial in
 * degrees Fahrenheit derived from Henry's-law CO2 solubility tables. The fit
 * is valid for 32–100 °F (0–38 °C), which covers the full range of beer
 * conditioning temperatures; outside that range the value is clamped rather
 * than extrapolated.
 */
export function residualCo2Volumes(temperatureC: number): number {
  if (!Number.isFinite(temperatureC)) {
    throw new Error("temperatureC must be a finite number");
  }
  const temperatureF = (temperatureC * 9) / 5 + 32;
  const clampedF = Math.min(100, Math.max(32, temperatureF));
  const t = clampedF;
  const volumes =
    3.0378 -
    0.050062 * t +
    0.00026555 * t * t -
    0.00000054 * t * t * t;
  // Below freezing the CO2 / temperature relationship is non-monotonic in
  // practice; clamp to 0 as a safety floor.
  return Math.max(0, volumes);
}

/**
 * Mass of priming sugar to add at bottling, in grams.
 *
 * Throws on a non-positive batch volume or non-finite target temperature.
 * Returns 0 grams when the target CO2 is already met by residual carbonation
 * (i.e. conditioning at a high enough temperature to hold that much CO2).
 */
export function primingSugarGrams(input: PrimingSugarInput): number {
  if (!(input.volumeLiters > 0)) {
    throw new Error("volumeLiters must be greater than 0");
  }
  if (!Number.isFinite(input.targetVolumes)) {
    throw new Error("targetVolumes must be a finite number");
  }
  if (!Number.isFinite(input.temperatureC)) {
    throw new Error("temperatureC must be a finite number");
  }
  const residual = residualCo2Volumes(input.temperatureC);
  const volumesToAdd = Math.max(0, input.targetVolumes - residual);
  if (volumesToAdd <= 0) return 0;
  const gallons = input.volumeLiters / 3.785411784;
  const ozPerGalPerVolume =
    PRIMING_SUGAR_OZ_PER_GAL_PER_VOLUME[input.sugarType];
  const ounces = gallons * volumesToAdd * ozPerGalPerVolume;
  return ounces * GRAMS_PER_OUNCE;
}

/** Round-trip helper that returns the full result struct (grams + diagnostics). */
export function computePrimingSugar(input: PrimingSugarInput): PrimingSugarResult {
  const residual = residualCo2Volumes(input.temperatureC);
  const volumesToAdd = Math.max(0, input.targetVolumes - residual);
  const grams = primingSugarGrams(input);
  const oz = grams / GRAMS_PER_OUNCE;
  return {
    weightGrams: roundTo(grams, 1),
    weightOz: roundTo(oz, 2),
    residualVolumes: roundTo(residual, 2),
    volumesToAdd: roundTo(volumesToAdd, 2),
    sugarType: input.sugarType,
    input,
  };
}
