import { describe, expect, it } from "vitest";
import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  gallonsToLiters,
  gramsToOunces,
  kgToPounds,
  litersToGallons,
  ouncesToGrams,
  poundsToKg,
  roundTo,
} from "./units";

describe("unit conversions", () => {
  it("converts kg <-> pounds and round-trips", () => {
    expect(kgToPounds(1)).toBeCloseTo(2.20462, 4);
    expect(poundsToKg(1)).toBeCloseTo(0.453592, 5);
    expect(poundsToKg(kgToPounds(5))).toBeCloseTo(5, 10);
  });

  it("converts litres <-> gallons and round-trips", () => {
    expect(litersToGallons(3.785411784)).toBeCloseTo(1, 9);
    expect(gallonsToLiters(1)).toBeCloseTo(3.785411784, 9);
    expect(gallonsToLiters(litersToGallons(20))).toBeCloseTo(20, 9);
  });

  it("converts grams <-> ounces and round-trips", () => {
    expect(gramsToOunces(28.349523125)).toBeCloseTo(1, 9);
    expect(ouncesToGrams(1)).toBeCloseTo(28.349523125, 9);
    expect(ouncesToGrams(gramsToOunces(50))).toBeCloseTo(50, 9);
  });

  it("converts Celsius <-> Fahrenheit at known points", () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(celsiusToFahrenheit(100)).toBe(212);
    expect(fahrenheitToCelsius(32)).toBe(0);
    expect(fahrenheitToCelsius(212)).toBeCloseTo(100, 10);
    expect(fahrenheitToCelsius(celsiusToFahrenheit(67))).toBeCloseTo(67, 10);
  });

  it("rounds to a given precision", () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(1.23456, 3)).toBe(1.235);
    expect(roundTo(7.74375, 2)).toBe(7.74);
  });
});
