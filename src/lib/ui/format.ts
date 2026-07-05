// Display formatters for the recipe library UI.
//
// The DB and API store canonical metric values; the API may add imperial
// fields alongside (e.g. `amountLbs`, `batchSizeGallons`, `tempF`) when
// `?units=imperial` is set. These helpers pick the right field for display
// and format numbers in a brewer-friendly way.

import type { UnitSystem } from "./types";

/** Format a number with up to N decimals, trimming trailing zeros. */
export function fmtNumber(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const fixed = value.toFixed(decimals);
  // Trim trailing zeros after the decimal point, but keep at least one digit
  // for values that have a decimal part to look like "1.5" not "1.5000000".
  if (!fixed.includes(".")) return fixed;
  const trimmed = fixed.replace(/0+$/, "").replace(/\.$/, "");
  return trimmed || fixed;
}

/** Format an OG/FG-style specific gravity (e.g. 1.056). */
export function fmtGravity(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(3);
}

/** Format a percent (e.g. ABV 5.4 → "5.4%"). */
export function fmtPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(decimals)}%`;
}

/** Format a small amount with the right unit suffix, e.g. "12 g", "0.42 oz". */
export function fmtGrams(grams: number | null | undefined, units: UnitSystem): string {
  if (grams == null || !Number.isFinite(grams)) return "—";
  if (units === "imperial") {
    const oz = grams / 28.349523125;
    return `${fmtNumber(oz, 2)} oz`;
  }
  // Choose g vs kg depending on magnitude.
  if (grams >= 1000) {
    return `${fmtNumber(grams / 1000, 2)} kg`;
  }
  return `${fmtNumber(grams, 0)} g`;
}

/** Format a kilogram mass (fermentables) in kg or lb. */
export function fmtKg(kg: number | null | undefined, units: UnitSystem): string {
  if (kg == null || !Number.isFinite(kg)) return "—";
  if (units === "imperial") {
    const lbs = kg / 0.45359237;
    return `${fmtNumber(lbs, 2)} lb`;
  }
  return `${fmtNumber(kg, 2)} kg`;
}

/** Format a liquid volume (juice/must) in L or gal. */
export function fmtLiters(liters: number | null | undefined, units: UnitSystem): string {
  if (liters == null || !Number.isFinite(liters)) return "—";
  if (units === "imperial") {
    const gal = liters / 3.785411784;
    return `${fmtNumber(gal, 2)} gal`;
  }
  return `${fmtNumber(liters, 2)} L`;
}

/** Format a temperature in °C or °F (the API may supply both). */
export function fmtTemp(
  celsius: number | null | undefined,
  fahrenheit: number | null | undefined,
  units: UnitSystem,
): string {
  if (units === "imperial") {
    if (fahrenheit != null && Number.isFinite(fahrenheit)) {
      return `${fmtNumber(fahrenheit, 0)} °F`;
    }
    if (celsius != null && Number.isFinite(celsius)) {
      return `${fmtNumber((celsius * 9) / 5 + 32, 0)} °F`;
    }
    return "—";
  }
  if (celsius != null && Number.isFinite(celsius)) {
    return `${fmtNumber(celsius, 0)} °C`;
  }
  return "—";
}

/** Format a temperature range (yeast) in °C or °F. */
export function fmtTempRange(
  cMin: number | null | undefined,
  cMax: number | null | undefined,
  units: UnitSystem,
): string {
  if (cMin == null && cMax == null) return "—";
  const lo = units === "imperial" ? (cMin != null ? (cMin * 9) / 5 + 32 : null) : cMin;
  const hi = units === "imperial" ? (cMax != null ? (cMax * 9) / 5 + 32 : null) : cMax;
  if (lo != null && hi != null) {
    return `${fmtNumber(lo, 0)}–${fmtNumber(hi, 0)} ${units === "imperial" ? "°F" : "°C"}`;
  }
  if (lo != null) {
    return `${fmtNumber(lo, 0)} ${units === "imperial" ? "°F" : "°C"}`;
  }
  if (hi != null) {
    return `${fmtNumber(hi, 0)} ${units === "imperial" ? "°F" : "°C"}`;
  }
  return "—";
}

/** Format batch size in L or gal — accepts the API fields directly. */
export function fmtBatchSize(
  liters: number | null | undefined,
  gallons: number | null | undefined,
  units: UnitSystem,
): string {
  if (units === "imperial") {
    const g = gallons ?? (liters != null ? liters / 3.785411784 : null);
    if (g == null) return "—";
    return `${fmtNumber(g, 2)} gal`;
  }
  if (liters == null) return "—";
  return `${fmtNumber(liters, 2)} L`;
}

/** Capitalise a known enum-style string for display ("beer" → "Beer"). */
export function titleCase(value: string | null | undefined): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Human-friendly category labels for the UI. */
export function categoryLabel(category: string | null | undefined): string {
  switch (category) {
    case "beer":
      return "Beer";
    case "mead":
      return "Mead";
    case "wine":
      return "Wine";
    case "cider":
      return "Cider";
    case "other":
      return "Other";
    default:
      return titleCase(category);
  }
}

/** Human-friendly label for a hop `use` value. */
export function hopUseLabel(use: string | null | undefined): string {
  switch (use) {
    case "boil":
      return "Boil";
    case "firstWort":
      return "First wort";
    case "whirlpool":
      return "Whirlpool";
    case "dryHop":
      return "Dry hop";
    case "mash":
      return "Mash";
    default:
      return titleCase(use);
  }
}

/** Human-friendly label for a process step `type`. */
export function processStepLabel(type: string | null | undefined): string {
  switch (type) {
    case "primary":
      return "Primary fermentation";
    case "secondary":
      return "Secondary fermentation";
    case "racking":
      return "Racking";
    case "backsweetening":
      return "Backsweetening";
    case "stabilizing":
      return "Stabilizing";
    case "aging":
      return "Aging";
    case "bottling":
      return "Bottling";
    case "other":
      return "Other";
    default:
      return titleCase(type);
  }
}

/** Human-friendly label for a mash step `type`. */
export function mashStepTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case "infusion":
      return "Infusion";
    case "temperature":
      return "Temperature rest";
    case "decoction":
      return "Decoction";
    default:
      return titleCase(type);
  }
}

/** Human-friendly label for fermentable `type`. */
export function fermentableTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case "grain":
      return "Grain";
    case "extract":
      return "Extract";
    case "sugar":
      return "Sugar";
    case "adjunct":
      return "Adjunct";
    case "honey":
      return "Honey";
    case "juice":
      return "Juice";
    case "concentrate":
      return "Concentrate";
    case "fruit":
      return "Fruit";
    case "must":
      return "Must";
    default:
      return titleCase(type);
  }
}

/** Human-friendly label for a shopping-list category. */
export function shoppingCategoryLabel(
  category: string | null | undefined,
): string {
  switch (category) {
    case "fermentables":
      return "Fermentables";
    case "hops":
      return "Hops";
    case "yeast":
      return "Yeast";
    case "additions":
      return "Additions";
    default:
      return titleCase(category);
  }
}

/**
 * Format one shopping-list amount with the right unit suffix. When the row
 * already has a non-empty `unit` string (e.g. "tsp", "tablet", "packets"),
 * use it as-is. For metric-imperial symmetry, `imperialAmount`/`imperialUnit`
 * are surfaced when the API provided them.
 */
export function fmtShoppingAmount(
  amount: number | null | undefined,
  unit: string | null | undefined,
  units: UnitSystem,
  imperialAmount?: number | null,
  imperialUnit?: string | null,
): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  // Known metric-imperial pairs handled by the recipe detail formatters.
  if (unit === "kg") return fmtKg(amount, units);
  if (unit === "g") return fmtGrams(amount, units);
  if (unit === "L") return fmtLiters(amount, units);
  // Unknown / free-text unit ("tsp", "tablet", "ppm", "packets", etc.)
  // Render the value with its own unit suffix.
  const trimmed = (unit ?? "").trim();
  if (units === "imperial") {
    if (imperialAmount != null && Number.isFinite(imperialAmount)) {
      const imp = trimmed ? `${fmtNumber(imperialAmount, 2)} ${imperialUnit ?? ""}` : `${fmtNumber(imperialAmount, 2)}`;
      return imp.replace(/\s+$/, "").trim() || "—";
    }
    // No imperial equivalent available — fall back to the metric figure.
  }
  if (!trimmed) return `${fmtNumber(amount, 2)}`;
  return `${fmtNumber(amount, 2)} ${trimmed}`;
}