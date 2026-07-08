// Quick ABV-from-OG/FG calculator (BRE-35).
//
// Given the brewer's *measured* original and final gravity (from a hydrometer
// or refractometer), this module computes the achieved ABV. It is the
// standalone counterpart to the recipe-target ABV estimator in `./gravity`:
// the recipe estimator works from the planned grain bill; this one works from
// the numbers the brewer actually read off their hydrometer after brew day.
//
// Two formulas are supported:
//
//   1. Standard linear:  ABV = (OG − FG) × 131.25
//
//   2. High-gravity (non-linear):  ABV = (76.08 × (OG − FG) / (1.775 − OG)) × (FG / 0.794)
//
// The linear formula is the standard homebrewing shortcut and is accurate to
// within ~0.2% ABV up to about OG 1.070. Above that the linear formula
// systematically under-reports because it ignores the effect of alcohol on
// wort density; the high-gravity correction (often called the Daniels /
// Papazian equation) is the standard workaround. We default to auto-selecting
// the high-gravity formula at OG ≥ 1.070, but the caller can force either.
//
// References:
//   - R. Daniels, *Designing Great Beers* (the source of the linear constant
//     131.25 and the high-gravity correction).
//   - R. Papazian, *The Complete Joy of Homebrewing* (same formulas, framing
//     for beginners).
//   - Glenn Tinseth's "The Truth About ABV" also surveys both and arrives at
//     the same practical recommendation: switch formulas at OG 1.070.

import { apparentAttenuation, actualAbv } from "./batch";
import { roundTo } from "./units";

/**
 * Threshold above which we automatically use the high-gravity formula.
 *
 * 1.070 is the value both Daniels and Papazian use as the crossover point,
 * and it lines up with what most brewing software does by default. Callers
 * who want the linear formula regardless can pass `forceFormula="linear"`.
 */
export const HIGH_GRAVITY_OG_THRESHOLD = 1.07;

/** Which ABV formula a given result was derived with. */
export type AbvFormula = "linear" | "highGravity";

/** What the quick ABV calculator wants to know. */
export interface MeasuredAbvInput {
  /** Measured original gravity (e.g. 1.052). Must be ≥ measuredFg. */
  measuredOg: number;
  /** Measured final gravity (e.g. 1.012). */
  measuredFg: number;
  /**
   * Optional override of the auto-selected formula. "linear" always uses
   * the standard shortcut; "highGravity" always uses the Daniels correction;
   * "auto" picks high-gravity when OG ≥ `HIGH_GRAVITY_OG_THRESHOLD`.
   * Defaults to "auto".
   */
  formula?: "auto" | "linear" | "highGravity";
}

/** What the calculator returns. */
export interface MeasuredAbvResult {
  /** Alcohol by volume, percent (e.g. 5.25 → 5.25% ABV). */
  abvPct: number;
  /** Apparent attenuation, percent (0–100). */
  apparentAttenuationPct: number;
  /** Gravity points dropped during fermentation (OG − FG, in points × 1000). */
  gravityPointsDropped: number;
  /** Which formula was used to compute `abvPct`. */
  formulaUsed: AbvFormula;
  /** Echo of the resolved input (with the selected formula filled in). */
  input: MeasuredAbvInput & { formula: AbvFormula };
  /**
   * Whether the result was computed with the high-gravity formula. Surfaced
   * separately from `formulaUsed === "highGravity"` so the UI can highlight
   * when an auto-pick kicked in (vs. an explicit user choice).
   */
  isHighGravity: boolean;
}

/**
 * ABV from measured gravities using a single canonical formula choice.
 *
 * `linear` (default for most beers):     ABV = (OG − FG) × 131.25
 * `highGravity` (mead, wine, big beers): ABV = (76.08 × (OG − FG) / (1.775 − OG)) × (FG / 0.794)
 *
 * Throws when OG < FG (fermentation can't go in reverse), when either reading
 * is non-finite, or when either reading falls outside the sensible
 * specific-gravity range of 0.95–1.2.
 */
export function computeMeasuredAbv(input: MeasuredAbvInput): MeasuredAbvResult {
  validate(input);

  const formula: AbvFormula = resolveFormula(input);
  const abvPct =
    formula === "highGravity"
      ? highGravityAbv(input.measuredOg, input.measuredFg)
      : linearAbv(input.measuredOg, input.measuredFg);

  const attenuationPct = apparentAttenuation(input.measuredOg, input.measuredFg);
  const pointsDropped = roundTo(
    (input.measuredOg - input.measuredFg) * 1000,
    1,
  );

  return {
    abvPct,
    apparentAttenuationPct: attenuationPct,
    gravityPointsDropped: pointsDropped,
    formulaUsed: formula,
    isHighGravity: formula === "highGravity",
    input: { ...input, formula },
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Bounds on a sane specific-gravity reading. Water is 1.000; wort can hit
 *  ~1.150 for big beers; very dry mead/wine can fall just below 1.000
 *  (0.998 is common). Anything outside this band is almost certainly a
 *  reading error (refractometer calibration, wrong scale, units mistake). */
const MIN_GRAVITY = 0.95;
const MAX_GRAVITY = 1.2;

function validate(input: MeasuredAbvInput): void {
  if (!Number.isFinite(input.measuredOg)) {
    throw new Error("measuredOg must be a finite number");
  }
  if (!Number.isFinite(input.measuredFg)) {
    throw new Error("measuredFg must be a finite number");
  }
  if (input.measuredOg < MIN_GRAVITY || input.measuredOg > MAX_GRAVITY) {
    throw new Error(
      `measuredOg must be between ${MIN_GRAVITY} and ${MAX_GRAVITY}`,
    );
  }
  if (input.measuredFg < MIN_GRAVITY || input.measuredFg > MAX_GRAVITY) {
    throw new Error(
      `measuredFg must be between ${MIN_GRAVITY} and ${MAX_GRAVITY}`,
    );
  }
  if (input.measuredOg < input.measuredFg) {
    throw new Error(
      "measuredOg must be greater than or equal to measuredFg (fermentation can't go in reverse)",
    );
  }
}

function resolveFormula(input: MeasuredAbvInput): AbvFormula {
  const choice = input.formula ?? "auto";
  if (choice === "linear") return "linear";
  if (choice === "highGravity") return "highGravity";
  // Auto: switch at the threshold. Use the raw (un-rounded) OG so an OG of
  // 1.07000 doesn't accidentally fall on the wrong side of rounding.
  return input.measuredOg >= HIGH_GRAVITY_OG_THRESHOLD ? "highGravity" : "linear";
}

/** Linear formula — kept private so the API layer always goes through
 *  `computeMeasuredAbv`, which owns formula selection. */
function linearAbv(og: number, fg: number): number {
  return actualAbv(og, fg);
}

/** High-gravity formula — same constraint as above. */
function highGravityAbv(og: number, fg: number): number {
  const abv =
    (76.08 * (og - fg) / (1.775 - og)) * (fg / 0.794);
  return roundTo(abv, 2);
}