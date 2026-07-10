// Original gravity, final gravity, and ABV estimation.

import type { FermentableInput, YeastInput } from "./types";
import { kgToPounds, litersToGallons, roundTo } from "./units";

/** Default gravity potential (points per pound per gallon) by fermentable type. */
export const DEFAULT_POTENTIAL_PPG: Record<string, number> = {
  grain: 36, // typical base malt
  extract: 44, // dry malt extract
  sugar: 46, // table/dextrose sugar
  adjunct: 34,
};

/** Fallback attenuation (apparent, %) when no yeast data is available. */
export const DEFAULT_ATTENUATION_PCT = 75;

/** Only these fermentable types are subject to brewhouse (mash) efficiency. */
const NEEDS_EFFICIENCY = new Set(["grain", "adjunct"]);

function potentialFor(f: FermentableInput): number {
  if (f.potentialPpg != null && f.potentialPpg > 0) return f.potentialPpg;
  const type = (f.type ?? "grain").toLowerCase();
  return DEFAULT_POTENTIAL_PPG[type] ?? DEFAULT_POTENTIAL_PPG.grain;
}

/**
 * Total gravity points contributed to the batch, before dividing by volume.
 * Grains/adjuncts get the brewhouse efficiency applied; extract and sugar are
 * assumed to convert fully (100%).
 */
export function totalGravityPoints(
  fermentables: FermentableInput[],
  efficiencyPct: number,
): number {
  const efficiency = efficiencyPct / 100;
  return fermentables.reduce((sum, f) => {
    if (f.amountKg <= 0) return sum;
    const pounds = kgToPounds(f.amountKg);
    const ppg = potentialFor(f);
    const type = (f.type ?? "grain").toLowerCase();
    const applied = NEEDS_EFFICIENCY.has(type) ? efficiency : 1;
    return sum + ppg * pounds * applied;
  }, 0);
}

/**
 * Estimate original gravity from the grain bill.
 * OG = 1 + (total points / volume in gallons) / 1000.
 */
export function estimateOg(
  fermentables: FermentableInput[],
  batchSizeLiters: number,
  efficiencyPct = 75,
): number {
  const gallons = litersToGallons(batchSizeLiters);
  if (gallons <= 0) throw new Error("batchSizeLiters must be greater than 0");
  const points = totalGravityPoints(fermentables, efficiencyPct);
  const og = 1 + points / gallons / 1000;
  return roundTo(og, 3);
}

/**
 * Estimate final gravity from an original gravity and apparent attenuation.
 * FG = 1 + (OG points * (1 - attenuation)) / 1000.
 */
export function estimateFg(og: number, attenuationPct = DEFAULT_ATTENUATION_PCT): number {
  const ogPoints = (og - 1) * 1000;
  const remaining = ogPoints * (1 - attenuationPct / 100);
  return roundTo(1 + remaining / 1000, 3);
}

/** Pick an apparent attenuation from the yeast list (first with data), else default. */
export function attenuationFromYeasts(yeasts?: YeastInput[]): number {
  const withData = yeasts?.find((y) => y.attenuationPct != null && y.attenuationPct > 0);
  return withData?.attenuationPct ?? DEFAULT_ATTENUATION_PCT;
}

/** 
 * Alcohol by volume from original and final gravity.
 * Standard formula: ABV = (OG - FG) * 131.25.
 */
export function estimateAbv(og: number, fg: number): number {
  return roundTo((og - fg) * 131.25, 2);
}

/**
 * High-gravity ABV estimate for strong mead and wine where the standard linear
 * formula under-reports alcohol.
 */
export function estimateHighGravityAbv(og: number, fg: number): number {
  const abv = (76.08 * (og - fg) / (1.775 - og)) * (fg / 0.794);
  return roundTo(abv, 2);
}

/**
 * Convert degrees Brix to specific gravity for unfermented must/wort.
 * Formula: SG = 1 + Brix / (258.6 - ((Brix / 258.2) * 227.1)).
 */
export function brixToGravity(brix: number): number {
  if (!Number.isFinite(brix) || brix < 0) {
    throw new Error("brix must be a non-negative finite number");
  }
  const sg = 1 + brix / (258.6 - (brix / 258.2) * 227.1);
  return roundTo(sg, 3);
}
