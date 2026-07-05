// IBU estimation using Tinseth's formula (metric form).
//
// Tinseth utilization = bigness factor * boil-time factor:
//   bignessFactor  = 1.65 * 0.000125^(boilGravity - 1)
//   boilTimeFactor = (1 - e^(-0.04 * time)) / 4.15
// IBU contribution of one addition (mg/L of isomerized alpha acid):
//   (alphaDecimal * grams * 1000) / volumeLiters * utilization

import type { HopInput } from "./types";
import { roundTo } from "./units";

/** Hop uses that contribute isomerized bitterness in this model. */
const BITTERING_USES = new Set(["boil", "firstwort"]);

export function bignessFactor(boilGravity: number): number {
  return 1.65 * Math.pow(0.000125, boilGravity - 1);
}

export function boilTimeFactor(timeMinutes: number): number {
  return (1 - Math.exp(-0.04 * timeMinutes)) / 4.15;
}

/** Tinseth utilization fraction for a given contact time and boil gravity. */
export function tinsethUtilization(timeMinutes: number, boilGravity: number): number {
  if (timeMinutes <= 0) return 0;
  return bignessFactor(boilGravity) * boilTimeFactor(timeMinutes);
}

/** IBU contribution of a single hop addition. */
export function hopIbu(
  hop: HopInput,
  batchSizeLiters: number,
  boilGravity: number,
): number {
  if (batchSizeLiters <= 0) throw new Error("batchSizeLiters must be greater than 0");
  const use = (hop.use ?? "boil").toLowerCase();
  if (!BITTERING_USES.has(use)) return 0;
  const alpha = hop.alphaAcidPct ?? 0;
  if (alpha <= 0 || hop.amountGrams <= 0) return 0;

  const utilization = tinsethUtilization(hop.timeMinutes, boilGravity);
  const mgPerLiter = (alpha / 100) * hop.amountGrams * 1000 / batchSizeLiters;
  return mgPerLiter * utilization;
}

/**
 * Total IBU for a hop schedule.
 * boilGravity defaults to the batch OG (approximates full-volume boil).
 */
export function estimateIbu(
  hops: HopInput[],
  batchSizeLiters: number,
  boilGravity: number,
): number {
  const total = hops.reduce(
    (sum, hop) => sum + hopIbu(hop, batchSizeLiters, boilGravity),
    0,
  );
  return roundTo(total, 1);
}
