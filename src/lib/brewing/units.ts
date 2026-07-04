// Imperial <-> metric unit conversion helpers.
//
// The database stores metric SI units; these helpers exist for display,
// user input in imperial, and the gravity/colour formulas which are defined
// in imperial (pounds, gallons).

/** Kilograms in one pound. */
export const KG_PER_POUND = 0.45359237;
/** Litres in one US gallon. */
export const LITERS_PER_US_GALLON = 3.785411784;
/** Grams in one ounce. */
export const GRAMS_PER_OUNCE = 28.349523125;

export function kgToPounds(kg: number): number {
  return kg / KG_PER_POUND;
}

export function poundsToKg(pounds: number): number {
  return pounds * KG_PER_POUND;
}

export function litersToGallons(liters: number): number {
  return liters / LITERS_PER_US_GALLON;
}

export function gallonsToLiters(gallons: number): number {
  return gallons * LITERS_PER_US_GALLON;
}

export function gramsToOunces(grams: number): number {
  return grams / GRAMS_PER_OUNCE;
}

export function ouncesToGrams(ounces: number): number {
  return ounces * GRAMS_PER_OUNCE;
}

export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return ((fahrenheit - 32) * 5) / 9;
}

/** Round to a fixed number of decimal places (default 2), avoiding fp noise. */
export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
