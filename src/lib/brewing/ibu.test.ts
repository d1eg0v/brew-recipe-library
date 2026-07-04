import { describe, expect, it } from "vitest";
import {
  bignessFactor,
  boilTimeFactor,
  estimateIbu,
  hopIbu,
  tinsethUtilization,
} from "./ibu";
import type { HopInput } from "./types";

describe("Tinseth factors", () => {
  it("boil-time factor rises with time and plateaus", () => {
    expect(boilTimeFactor(0)).toBeCloseTo(0, 6);
    expect(boilTimeFactor(60)).toBeGreaterThan(boilTimeFactor(15));
    // approaches the asymptote 1/4.15 ~ 0.240964 from below
    expect(boilTimeFactor(600)).toBeLessThan(1 / 4.15);
    expect(boilTimeFactor(600)).toBeGreaterThan(0.2409);
  });

  it("bigness factor decreases as boil gravity increases", () => {
    expect(bignessFactor(1.05)).toBeGreaterThan(bignessFactor(1.09));
    expect(bignessFactor(1.0)).toBeCloseTo(1.65, 6);
  });

  it("utilization is zero at zero time", () => {
    expect(tinsethUtilization(0, 1.05)).toBe(0);
  });
});

describe("hopIbu", () => {
  const hop: HopInput = { amountGrams: 28.35, alphaAcidPct: 10, timeMinutes: 60, use: "boil" };

  it("computes a plausible bitterness for a 60-min addition", () => {
    // ~1 oz @ 10% AA, 60 min, 20 L, boil grav 1.050 -> low-30s IBU
    const ibu = hopIbu(hop, 20, 1.05);
    expect(ibu).toBeGreaterThan(28);
    expect(ibu).toBeLessThan(38);
  });

  it("contributes nothing for dry hops or whirlpool", () => {
    expect(hopIbu({ ...hop, use: "dryHop" }, 20, 1.05)).toBe(0);
    expect(hopIbu({ ...hop, use: "whirlpool" }, 20, 1.05)).toBe(0);
  });

  it("contributes nothing without alpha acids or mass", () => {
    expect(hopIbu({ ...hop, alphaAcidPct: 0 }, 20, 1.05)).toBe(0);
    expect(hopIbu({ ...hop, alphaAcidPct: null }, 20, 1.05)).toBe(0);
    expect(hopIbu({ ...hop, amountGrams: 0 }, 20, 1.05)).toBe(0);
  });

  it("treats first-wort hops as bittering", () => {
    expect(hopIbu({ ...hop, use: "firstWort" }, 20, 1.05)).toBeGreaterThan(0);
  });

  it("throws on a non-positive batch size", () => {
    expect(() => hopIbu(hop, 0, 1.05)).toThrow();
  });
});

describe("estimateIbu", () => {
  it("sums contributions across the schedule", () => {
    const hops: HopInput[] = [
      { amountGrams: 28, alphaAcidPct: 12, timeMinutes: 60, use: "boil" },
      { amountGrams: 28, alphaAcidPct: 5, timeMinutes: 15, use: "boil" },
      { amountGrams: 56, alphaAcidPct: 8, timeMinutes: 0, use: "dryHop" },
    ];
    const total = estimateIbu(hops, 20, 1.055);
    const first = estimateIbu([hops[0]], 20, 1.055);
    expect(total).toBeGreaterThan(first);
    expect(total).toBeGreaterThan(0);
  });

  it("is zero for an empty schedule", () => {
    expect(estimateIbu([], 20, 1.05)).toBe(0);
  });

  it("scales down as batch size grows", () => {
    const hops: HopInput[] = [{ amountGrams: 28, alphaAcidPct: 10, timeMinutes: 60, use: "boil" }];
    expect(estimateIbu(hops, 10, 1.05)).toBeGreaterThan(estimateIbu(hops, 40, 1.05));
  });
});
