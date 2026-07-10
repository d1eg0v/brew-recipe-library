// Yeast pitch-rate / starter calculator (BRE-33).
//
// Given OG, batch volume, and yeast viability, this module computes the
// recommended cell count and how many packs (or a starter) are needed to
// achieve a healthy fermentation. Ale and lager have different pitch-rate
// targets (lager needs roughly twice the cells).
//
// The pitch-rate target comes from Jamil Zainasheff's *Yeast* (Brewers
// Publications, 2010) and the White Labs pitch-rate recommendations:
//
//   Ale/ wine/ cider:  0.75 million cells / mL / °P
//   Lager:             1.50 million cells / mL / °P
//
// Cell counts per pack use industry-standard assumptions:
//   Liquid (White Labs / Wyeast):  100 billion cells per fresh pack
//   Dry (e.g. Fermentis):          200 billion cells per pack
//
// Viability loss follows the ~21 % per month standard (~0.7 % per day)
// that Jamil and Chris White both cite.
//
// The calculator recommends a starter when the number of liquid packs
// needed is >= 2 or when OG > 1.060 (high-gravity needs more head start).
// Starter size is estimated at ~100 billion cells grown per litre of
// 1.040 starter wort — a conservative average from published data.

import { roundTo } from "./units";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pitch rate for ales, wine, cider — million cells / mL / °P. */
export const ALE_PITCH_RATE = 0.75;

/** Pitch rate for lagers — million cells / mL / °P. */
export const LAGER_PITCH_RATE = 1.5;

/** Billion cells in a fresh liquid-yeast pack (White Labs / Wyeast). */
export const LIQUID_CELLS_PER_PACK = 100;

/** Billion cells in a fresh dry-yeast pack (Fermentis / Lallemand). */
export const DRY_CELLS_PER_PACK = 200;

/**
 * Daily viability loss fraction (decimal).
 * 0.7 % = 0.007, which compounds to ~21 % per 30 days — the figure Zainasheff
 * uses for prompt-ale pitch rates assuming proper cold storage.
 */
export const DAILY_VIABILITY_LOSS = 0.007;

/** Minimum viability we report (never below 15 % — anything older should be
 *  stepped up or replaced). */
export const MIN_VIABILITY = 0.15;

/** Approximate billions of cells grown per litre of 1.040 starter wort. */
export const STARTER_GROWTH_PER_LITER = 100;

/** Minimum sensible starter volume in litres. */
export const MIN_STARTER_VOLUME = 1;

/** Round starter volume to the nearest N litres. */
export const STARTER_VOLUME_STEP = 0.5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The type of fermentation that drives the pitch rate target. */
export type BeerType = "ale" | "lager";

/**
 * Yeast form — determines how many cells are in a single retail pack and
 * whether a starter is meaningful (dry yeast rarely needs a starter).
 */
export type YeastForm = "dry" | "liquid";

/** What the pitch-rate calculator needs. */
export interface PitchRateInput {
  /** Original gravity of the wort (e.g. 1.050). */
  og: number;
  /** Batch volume at pitching, in litres. */
  batchSizeLiters: number;
  /** Ale or lager (determines the pitch-rate target). */
  beerType: BeerType;
  /** Dry or liquid (determines cells per pack & starter logic). */
  yeastForm: YeastForm;
  /**
   * Days since the yeast was manufactured (for viability estimation).
   * 0 = fresh. Defaults to 0 when omitted.
   */
  daysSinceProduction?: number;
  /**
   * Optional explicit viability as a decimal (0–1). When provided, it
   * overrides the computed viability from `daysSinceProduction`.
   */
  viabilityOverride?: number;
  /**
   * Optional cell count per pack (billions). Overrides the form-based
   * default when provided (e.g. for a large-format White Labs pitch).
   */
  cellsPerPackOverride?: number;
}

/** What the calculator returns. */
export interface PitchRateResult {
  /** Recommended cell count in billions (the target). */
  recommendedCells: number;
  /** Viable cells per pack, in billions (after viability discount). */
  viableCellsPerPack: number;
  /** Number of packs needed (rounded up). */
  packsNeeded: number;
  /**
   * Suggested starter volume in litres. 0 when no starter is recommended
   * (i.e. the pack count is adequate without stepping up).
   */
  starterVolumeLiters: number;
  /** Whether a starter is recommended. */
  starterRecommended: boolean;
  /** Viability decimal used (0–1). */
  viability: number;
  /** Wort gravity in degrees Plato (°P). */
  degreesPlato: number;
  /** Echo of the input. */
  input: PitchRateInput;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the recommended pitch rate, packs, and starter size.
 *
 * Throws when any input is out of range or non-finite (see validate).
 */
export function computePitchRate(input: PitchRateInput): PitchRateResult {
  validate(input);

  const degPlato = gravityToPlato(input.og);
  const pitchRate = input.beerType === "lager" ? LAGER_PITCH_RATE : ALE_PITCH_RATE;

  const recommendedCells = roundTo(
    pitchRate * input.batchSizeLiters * degPlato,
    1,
  );

  const viability =
    input.viabilityOverride ??
    computeViability(input.daysSinceProduction ?? 0);

  const cellsPerPack =
    input.cellsPerPackOverride ??
    (input.yeastForm === "dry" ? DRY_CELLS_PER_PACK : LIQUID_CELLS_PER_PACK);

  const viableCellsPerPack = roundTo(cellsPerPack * viability, 1);
  const packsNeeded = Math.ceil(recommendedCells / viableCellsPerPack);

  const starterRecommended =
    input.yeastForm === "liquid" &&
    (packsNeeded >= 2 || input.og > 1.06);

  const deficit = recommendedCells - viableCellsPerPack;
  const starterVolumeLiters =
    starterRecommended && deficit > 0
      ? roundTo(
          Math.max(MIN_STARTER_VOLUME, deficit / STARTER_GROWTH_PER_LITER),
          1,
        )
      : 0;

  // Round to the nearest step
  const roundedStarter =
    starterVolumeLiters > 0
      ? roundTo(
          Math.ceil(starterVolumeLiters / STARTER_VOLUME_STEP) *
            STARTER_VOLUME_STEP,
          1,
        )
      : 0;

  return {
    recommendedCells,
    viableCellsPerPack,
    packsNeeded,
    starterVolumeLiters: roundedStarter,
    starterRecommended,
    viability: roundTo(viability, 2),
    degreesPlato: roundTo(degPlato, 1),
    input,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert specific gravity to degrees Plato.
 *
 * Source: ASBC (American Society of Brewing Chemists) — the standard
 * polynomial fit used in commercial brewing:
 *   °P = -463.37 + 668.72 × SG - 205.35 × SG²
 *
 * For homebrew contexts the "divide by 4" rule (SG points / 4) is a common
 * approximation, but this module uses the canonical polynomial for accuracy.
 */
function gravityToPlato(sg: number): number {
  return -463.37 + 668.72 * sg - 205.35 * sg * sg;
}

/**
 * Viability as a function of days since manufacture.
 * v = max(MIN_VIABILITY, 1 - days × DAILY_VIABILITY_LOSS)
 */
function computeViability(daysSinceProduction: number): number {
  if (daysSinceProduction <= 0) return 1;
  const v = 1 - daysSinceProduction * DAILY_VIABILITY_LOSS;
  return Math.max(MIN_VIABILITY, v);
}

function validate(input: PitchRateInput): void {
  if (!Number.isFinite(input.og)) {
    throw new Error("og must be a finite number");
  }
  if (input.og < 1.0 || input.og > 1.2) {
    throw new Error("og must be between 1.0 and 1.2");
  }
  if (!(input.batchSizeLiters > 0)) {
    throw new Error("batchSizeLiters must be greater than 0");
  }
  if (!Number.isFinite(input.batchSizeLiters)) {
    throw new Error("batchSizeLiters must be a finite number");
  }
  if (!["ale", "lager"].includes(input.beerType)) {
    throw new Error("beerType must be 'ale' or 'lager'");
  }
  if (!["dry", "liquid"].includes(input.yeastForm)) {
    throw new Error("yeastForm must be 'dry' or 'liquid'");
  }
  if (input.daysSinceProduction != null && (!Number.isFinite(input.daysSinceProduction) || input.daysSinceProduction < 0)) {
    throw new Error("daysSinceProduction must be a non-negative finite number");
  }
  if (input.viabilityOverride != null) {
    if (!Number.isFinite(input.viabilityOverride) || input.viabilityOverride < 0 || input.viabilityOverride > 1) {
      throw new Error("viabilityOverride must be a finite number between 0 and 1");
    }
  }
  if (input.cellsPerPackOverride != null) {
    if (!Number.isFinite(input.cellsPerPackOverride) || input.cellsPerPackOverride <= 0) {
      throw new Error("cellsPerPackOverride must be a positive finite number");
    }
  }
}
