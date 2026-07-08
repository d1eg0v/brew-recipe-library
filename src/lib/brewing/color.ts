// Beer colour (SRM) estimation and rendering.
//
//   MCU = sum(grainColorLovibond * weightLb) / volumeGallons
//   SRM = 1.4922 * MCU^0.6859  (Morey)
//
// The SRM→RGB conversion below is a lookup-table with linear interpolation
// calibrated to the reference palette used by mainstream brewing software
// (BeerSmith, Brewer's Friend, the BJCP guide). The palette is published as
// tabulated (SRM, R, G, B) triples; values between tabulated SRMs are
// interpolated per channel. Out-of-range inputs (≤0 or ≥80 SRM) clamp to the
// nearest table endpoint.

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

/** Reference SRM palette (tabulated triples: srm, r, g, b — channels 0–255). */
const SRM_RGB_TABLE: ReadonlyArray<readonly [number, number, number, number]> = [
  [1, 255, 245, 198],
  [2, 255, 234, 170],
  [3, 255, 224, 142],
  [4, 255, 213, 117],
  [5, 255, 203, 95],
  [6, 247, 192, 88],
  [7, 238, 180, 82],
  [8, 229, 169, 75],
  [9, 220, 157, 69],
  [10, 211, 146, 62],
  [12, 199, 124, 48],
  [14, 189, 105, 36],
  [16, 180, 89, 31],
  [18, 171, 75, 28],
  [20, 162, 62, 27],
  [22, 154, 55, 25],
  [25, 140, 44, 22],
  [30, 122, 32, 19],
  [35, 106, 23, 17],
  [40, 90, 16, 15],
  [50, 61, 9, 11],
  [60, 42, 5, 9],
  [70, 29, 3, 7],
  [80, 20, 2, 5],
];

/** 8-bit RGB triple returned by {@link srmToRgb}. */
export interface SrmRgb {
  r: number;
  g: number;
  b: number;
}

/** Clamp a number to the closed interval [min, max]. */
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Convert a Standard Reference Method (SRM) value to an 8-bit RGB triple.
 *
 * Values ≤0 return the lightest reference colour. Values ≥80 clamp to the
 * darkest reference. Values in between are linearly interpolated per channel
 * between the surrounding table entries. `NaN` / `Infinity` inputs are
 * normalised to 0 (lightest).
 */
export function srmToRgb(srm: number): SrmRgb {
  const safe = Number.isFinite(srm) ? srm : 0;
  const first = SRM_RGB_TABLE[0];
  const last = SRM_RGB_TABLE[SRM_RGB_TABLE.length - 1];
  if (safe <= first[0]) {
    return { r: first[1], g: first[2], b: first[3] };
  }
  if (safe >= last[0]) {
    return { r: last[1], g: last[2], b: last[3] };
  }
  for (let i = 0; i < SRM_RGB_TABLE.length - 1; i += 1) {
    const a = SRM_RGB_TABLE[i];
    const b = SRM_RGB_TABLE[i + 1];
    if (safe >= a[0] && safe <= b[0]) {
      const span = b[0] - a[0];
      const t = span === 0 ? 0 : (safe - a[0]) / span;
      return {
        r: Math.round(clamp(a[1] + (b[1] - a[1]) * t, 0, 255)),
        g: Math.round(clamp(a[2] + (b[2] - a[2]) * t, 0, 255)),
        b: Math.round(clamp(a[3] + (b[3] - a[3]) * t, 0, 255)),
      };
    }
  }
  return { r: first[1], g: first[2], b: first[3] };
}

/** Format an 8-bit channel as a zero-padded two-digit hex string. */
function toHexByte(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

/** Convert a SRM value to a `#rrggbb` CSS colour string. */
export function srmToHex(srm: number): string {
  const { r, g, b } = srmToRgb(srm);
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}
