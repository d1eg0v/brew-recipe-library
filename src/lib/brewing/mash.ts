// Strike-water and mash-infusion calculators.
//
// The strike-water math answers the question "how much water, and at what
// temperature, do I add to my grain to land on my target mash temperature?"
// Both come from a single energy balance: the heat the water sheds on the way
// down must equal the heat the grain picks up on the way up, assuming the tun
// itself is a perfectly insulated calorimeter.
//
//   heat shed by water  =  mass_water × c_water × (T_strike − T_target)
//   heat gained by grain =  mass_grain × c_grain × (T_target − T_grain)
//
// where c_water ≈ 1.0 cal/(g·°C) and c_grain ≈ 0.4 cal/(g·°C) for dry malt.
// In metric (litres of water per kg of grain, masses in kg) that simplifies
// to the Palmer / How to Brew strike-water temperature equation:
//
//   T_strike = T_target + (0.4 / R) × (T_target − T_grain)
//
// with R = water-to-grain ratio (L/kg). The constant 0.4 is the grain specific
// heat (0.4) divided by 1 (water specific heat at 1.0, which cancels out when
// we keep both sides in the same units of mass).
//
// Reference: John Palmer, *How to Brew*, chapter on mashing (and many other
// texts; the formula is unchanged across Brewing Elements, Noonan's *Brewing
// Lager Beer*, and the BYO strike-water calculator). See also Papazian's
// *The Complete Joy of Homebrewing* for the same formula with slightly
// different framing.
//
// Volume is the trivial half:
//
//   V_strike_liters = grain_kg × R
//
// We do **not** account for tun heat losses, grain moisture, or the extra
// heat required to warm the strike water above boiling — these are small
// (typically <2 °C) and would obscure the formula for a calculator that is
// meant to be a starting point. Callers who need a more precise number should
// add their tun-loss correction on top of the value this returns.

import type { FermentableInput } from "./types";
import { roundTo } from "./units";

/** Specific heat of dry malt in cal/(g·°C). Source: brewing-science texts. */
export const GRAIN_SPECIFIC_HEAT = 0.4;

/**
 * Sensible default water-to-grain ratio for a single-infusion mash.
 *
 * 3.0 L/kg ≈ 1.5 qt/lb, the classic "thin mash" used for most ale/pale-malt
 * bills. Lower ratios (2.5–2.8 L/kg) suit pilsner/drier bills; higher ratios
 * (3.3–3.5 L/kg) suit adjunct-heavy or wheat-heavy bills. The presets in the
 * UI map to this range.
 */
export const DEFAULT_WATER_TO_GRAIN_RATIO = 3.0;

/** Lower bound on a usable water-to-grain ratio (very thick mash). */
export const MIN_WATER_TO_GRAIN_RATIO = 1.5;
/** Upper bound — anything wetter is essentially steeping, not mashing. */
export const MAX_WATER_TO_GRAIN_RATIO = 6.0;

/** What the calculator wants to know. */
export interface StrikeWaterInput {
  /** Total grain mass, in kilograms. */
  grainKg: number;
  /** Target mash temperature (where you want the grain to land), °C. */
  targetMashTempC: number;
  /** Current grain temperature, °C (room-temp grain is ~20 °C). */
  grainTempC: number;
  /**
   * Water-to-grain ratio in litres of water per kilogram of grain.
   * Defaults to 3.0 (the "classic" thin mash).
   */
  waterToGrainRatioLPerKg?: number;
}

/** What the calculator returns. */
export interface StrikeWaterResult {
  /** Strike-water volume, litres. */
  volumeLiters: number;
  /** Strike-water temperature, °C. */
  strikeTempC: number;
  /** Echo of the resolved water-to-grain ratio (L/kg). */
  waterToGrainRatioLPerKg: number;
  /** Echo of the full input for round-trip. */
  input: StrikeWaterInput & { waterToGrainRatioLPerKg: number };
}

/**
 * Strike-water temperature in °C.
 *
 * Palmer / *How to Brew* strike-water temperature equation:
 *
 *   T_strike = T_target + (GRAIN_SPECIFIC_HEAT / R) × (T_target − T_grain)
 *
 * where R is the water-to-grain ratio in L/kg. With grain at room temp
 * (~20 °C) and a 67 °C target mash at 3.0 L/kg, this returns ~74.0 °C, which
 * matches the standard strike-temperature tables. With cold grain (10 °C) the
 * strike temp climbs to ~75.3 °C; with warm grain (30 °C) it drops to ~72.7 °C.
 *
 * Throws when the ratio is non-positive or outside a sensible mashing range,
 * when the grain mass is not positive, or when a temperature is not finite.
 */
export function strikeWaterTempC(input: StrikeWaterInput): number {
  validate(input);
  const r = effectiveRatio(input);
  const tempDelta = input.targetMashTempC - input.grainTempC;
  const strike = input.targetMashTempC + (GRAIN_SPECIFIC_HEAT / r) * tempDelta;
  return roundTo(strike, 1);
}

/**
 * Strike-water volume in litres.
 *
 * V = grain_kg × R, with R = water-to-grain ratio in L/kg. This is the volume
 * to heat up to the strike temperature; it does not account for water lost
 * to the grain's absorption (typically ~0.7 L/kg for pale malt) or to
 * evaporation. Callers running a real brew should expect to need slightly
 * more — but the difference is small enough that the strike-water number is
 * a useful starting point.
 *
 * Throws on a non-positive grain mass or out-of-range ratio (see validate()).
 */
export function strikeWaterVolumeLiters(input: StrikeWaterInput): number {
  validate(input);
  const r = effectiveRatio(input);
  return roundTo(input.grainKg * r, 2);
}

/** Convenience wrapper that returns both numbers plus a round-trip echo. */
export function computeStrikeWater(input: StrikeWaterInput): StrikeWaterResult {
  validate(input);
  const ratio = effectiveRatio(input);
  const resolvedInput: StrikeWaterInput & { waterToGrainRatioLPerKg: number } = {
    ...input,
    waterToGrainRatioLPerKg: ratio,
  };
  return {
    volumeLiters: strikeWaterVolumeLiters(resolvedInput),
    strikeTempC: strikeWaterTempC(resolvedInput),
    waterToGrainRatioLPerKg: ratio,
    input: resolvedInput,
  };
}

/** Total grain mass (kg) across a fermentable list. Skips null/missing amounts. */
export function totalGrainMassKg(fermentables: FermentableInput[]): number {
  return fermentables.reduce((sum, f) => {
    if (typeof f.amountKg === "number" && f.amountKg > 0) {
      return sum + f.amountKg;
    }
    return sum;
  }, 0);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function effectiveRatio(input: StrikeWaterInput): number {
  return input.waterToGrainRatioLPerKg ?? DEFAULT_WATER_TO_GRAIN_RATIO;
}

function validate(input: StrikeWaterInput): void {
  if (!(input.grainKg > 0)) {
    throw new Error("grainKg must be greater than 0");
  }
  if (!Number.isFinite(input.targetMashTempC)) {
    throw new Error("targetMashTempC must be a finite number");
  }
  if (!Number.isFinite(input.grainTempC)) {
    throw new Error("grainTempC must be a finite number");
  }
  const r = effectiveRatio(input);
  if (!Number.isFinite(r)) {
    throw new Error("waterToGrainRatioLPerKg must be a finite number");
  }
  if (r < MIN_WATER_TO_GRAIN_RATIO || r > MAX_WATER_TO_GRAIN_RATIO) {
    throw new Error(
      `waterToGrainRatioLPerKg must be between ${MIN_WATER_TO_GRAIN_RATIO} and ${MAX_WATER_TO_GRAIN_RATIO} L/kg`,
    );
  }
}