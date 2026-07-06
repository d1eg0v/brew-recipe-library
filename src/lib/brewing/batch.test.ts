import { describe, expect, it } from "vitest";
import { actualAbv, apparentAttenuation, brewhouseEfficiency } from "./batch";
import { gallonsToLiters } from "./units";
import type { FermentableInput } from "./types";

describe("actualAbv", () => {
  it("computes ABV from measured OG and FG", () => {
    expect(actualAbv(1.05, 1.01)).toBeCloseTo(5.25, 2);
  });

  it("is zero when nothing fermented", () => {
    expect(actualAbv(1.05, 1.05)).toBe(0);
  });
});

describe("apparentAttenuation", () => {
  it("computes attenuation from measured gravities", () => {
    // OG 1.060 -> 60 points, FG 1.015 -> 45 points attenuated -> 75%
    expect(apparentAttenuation(1.06, 1.015)).toBeCloseTo(75, 1);
  });

  it("is 100% when FG reaches 1.000", () => {
    expect(apparentAttenuation(1.05, 1.0)).toBeCloseTo(100, 1);
  });

  it("is 0% when FG equals OG", () => {
    expect(apparentAttenuation(1.05, 1.05)).toBe(0);
  });

  it("returns 0 (no divide-by-zero) when OG is 1.000", () => {
    expect(apparentAttenuation(1.0, 1.0)).toBe(0);
  });
});

describe("brewhouseEfficiency", () => {
  it("returns ~100% when measured OG matches the theoretical max", () => {
    // 1 kg (2.2046 lb) grain @ 36 ppg in 1 gallon at 100% eff -> ~1.0794 OG.
    const bill: FermentableInput[] = [{ type: "grain", amountKg: 1, potentialPpg: 36 }];
    const eff = brewhouseEfficiency(bill, 1.0794, gallonsToLiters(1));
    expect(eff).toBeCloseTo(100, 0);
  });

  it("reports roughly half efficiency when only half the points are collected", () => {
    const bill: FermentableInput[] = [{ type: "grain", amountKg: 1, potentialPpg: 36 }];
    // Half of ~79.4 points -> OG ~1.0397 in 1 gallon.
    const eff = brewhouseEfficiency(bill, 1.0397, gallonsToLiters(1));
    expect(eff).toBeCloseTo(50, 0);
  });

  it("returns 0 for an empty grain bill instead of dividing by zero", () => {
    expect(brewhouseEfficiency([], 1.05, 20)).toBe(0);
  });

  it("throws on a non-positive volume", () => {
    const bill: FermentableInput[] = [{ type: "grain", amountKg: 5 }];
    expect(() => brewhouseEfficiency(bill, 1.05, 0)).toThrow();
  });
});
