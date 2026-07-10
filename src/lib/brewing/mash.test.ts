import { describe, expect, it } from "vitest";

import {
  computeStrikeWater,
  DEFAULT_WATER_TO_GRAIN_RATIO,
  GRAIN_SPECIFIC_HEAT,
  MAX_WATER_TO_GRAIN_RATIO,
  MIN_WATER_TO_GRAIN_RATIO,
  strikeWaterTempC,
  strikeWaterVolumeLiters,
  totalGrainMassKg,
} from "./mash";

describe("constants", () => {
  it("uses grain specific heat ≈ 0.4 cal/(g·°C)", () => {
    // Source: brewing-science tables; Noonan / Palmer / Brewing Elements.
    expect(GRAIN_SPECIFIC_HEAT).toBeCloseTo(0.4, 5);
  });

  it("exposes a sensible default ratio and bounds", () => {
    expect(DEFAULT_WATER_TO_GRAIN_RATIO).toBe(3.0);
    expect(MIN_WATER_TO_GRAIN_RATIO).toBe(1.5);
    expect(MAX_WATER_TO_GRAIN_RATIO).toBe(6.0);
  });
});

describe("strikeWaterTempC — Palmer formula", () => {
  // T_strike = T_target + (0.4 / R) × (T_target − T_grain)
  //
  // Reference: at the classic 3.0 L/kg ratio (≈ 1.5 qt/lb), a 67 °C target
  // mash with room-temperature grain (20 °C) should land at 67 + (0.4 / 3.0)
  // × (67 − 20) = 67 + 6.267 ≈ 73.3 °C. The standard "brew day" strike temp
  // tables for a 67 °C / 20 °C grain / 3 L/kg batch agree with this number
  // (How to Brew strike-temperature chapter).

  it("classic reference: 67 °C target, 20 °C grain, 3.0 L/kg → ~73.3 °C", () => {
    expect(
      strikeWaterTempC({
        grainKg: 5,
        targetMashTempC: 67,
        grainTempC: 20,
      }),
    ).toBeCloseTo(73.3, 1);
  });

  it("rounds to 1 decimal place", () => {
    const t = strikeWaterTempC({
      grainKg: 5,
      targetMashTempC: 65,
      grainTempC: 22,
    });
    // 65 + (0.4 / 3.0) × 43 = 65 + 5.7333... ≈ 70.7
    expect(t).toBeCloseTo(70.7, 1);
    // No fp noise beyond 1 dp.
    expect(t).toBe(Math.round(t * 10) / 10);
  });

  it("cold grain demands a hotter strike (10 °C grain)", () => {
    const room = strikeWaterTempC({
      grainKg: 5,
      targetMashTempC: 67,
      grainTempC: 20,
    });
    const cold = strikeWaterTempC({
      grainKg: 5,
      targetMashTempC: 67,
      grainTempC: 10,
    });
    expect(cold).toBeGreaterThan(room);
  });

  it("warm grain demands a cooler strike (30 °C grain)", () => {
    const room = strikeWaterTempC({
      grainKg: 5,
      targetMashTempC: 67,
      grainTempC: 20,
    });
    const warm = strikeWaterTempC({
      grainKg: 5,
      targetMashTempC: 67,
      grainTempC: 30,
    });
    expect(warm).toBeLessThan(room);
  });

  it("matches the published 1.5 qt/lb ratio equivalent (3.0 L/kg)", () => {
    // 1.5 qt/lb × (1.057 L/qt) / (0.454 kg/lb) ≈ 3.49 L/kg — but the
    // *metric* version of the formula with the 0.4 constant is the one to
    // test against. Use a known call: 5 kg grain, 67 °C target, 20 °C grain,
    // 3.0 L/kg → 73.3 °C.
    expect(
      strikeWaterTempC({
        grainKg: 5,
        targetMashTempC: 67,
        grainTempC: 20,
        waterToGrainRatioLPerKg: 3.0,
      }),
    ).toBeCloseTo(73.3, 1);
  });

  it("thinner mash (3.5 L/kg) needs a cooler strike than a 3.0 L/kg mash", () => {
    const thick = strikeWaterTempC({
      grainKg: 5,
      targetMashTempC: 67,
      grainTempC: 20,
      waterToGrainRatioLPerKg: 2.5,
    });
    const thin = strikeWaterTempC({
      grainKg: 5,
      targetMashTempC: 67,
      grainTempC: 20,
      waterToGrainRatioLPerKg: 3.5,
    });
    expect(thin).toBeLessThan(thick);
  });

  it("thicker mash needs a hotter strike", () => {
    const thin = strikeWaterTempC({
      grainKg: 5,
      targetMashTempC: 67,
      grainTempC: 20,
      waterToGrainRatioLPerKg: 2.5,
    });
    const veryThick = strikeWaterTempC({
      grainKg: 5,
      targetMashTempC: 67,
      grainTempC: 20,
      waterToGrainRatioLPerKg: 2.0,
    });
    expect(veryThick).toBeGreaterThan(70);
    expect(veryThick).toBeGreaterThan(thin);
  });

  it("matches the formula algebraically (sanity check)", () => {
    const cases = [
      { grainKg: 4.5, target: 65, grain: 22, ratio: 2.8 },
      { grainKg: 6, target: 67, grain: 18, ratio: 3.2 },
      { grainKg: 8, target: 70, grain: 25, ratio: 3.0 },
    ];
    for (const c of cases) {
      const expected =
        c.target + (GRAIN_SPECIFIC_HEAT / c.ratio) * (c.target - c.grain);
      const actual = strikeWaterTempC({
        grainKg: c.grainKg,
        targetMashTempC: c.target,
        grainTempC: c.grain,
        waterToGrainRatioLPerKg: c.ratio,
      });
      expect(actual).toBeCloseTo(Math.round(expected * 10) / 10, 1);
    }
  });

  it("throws on a non-positive grain mass", () => {
    expect(() =>
      strikeWaterTempC({
        grainKg: 0,
        targetMashTempC: 67,
        grainTempC: 20,
      }),
    ).toThrow();
    expect(() =>
      strikeWaterTempC({
        grainKg: -1,
        targetMashTempC: 67,
        grainTempC: 20,
      }),
    ).toThrow();
  });

  it("throws on a non-finite temperature", () => {
    expect(() =>
      strikeWaterTempC({
        grainKg: 5,
        targetMashTempC: Number.NaN,
        grainTempC: 20,
      }),
    ).toThrow();
    expect(() =>
      strikeWaterTempC({
        grainKg: 5,
        targetMashTempC: 67,
        grainTempC: Number.NaN,
      }),
    ).toThrow();
    expect(() =>
      strikeWaterTempC({
        grainKg: 5,
        targetMashTempC: 67,
        grainTempC: Number.POSITIVE_INFINITY,
      }),
    ).toThrow();
  });

  it("throws on an out-of-range water-to-grain ratio", () => {
    expect(() =>
      strikeWaterTempC({
        grainKg: 5,
        targetMashTempC: 67,
        grainTempC: 20,
        waterToGrainRatioLPerKg: 0.5,
      }),
    ).toThrow();
    expect(() =>
      strikeWaterTempC({
        grainKg: 5,
        targetMashTempC: 67,
        grainTempC: 20,
        waterToGrainRatioLPerKg: 10,
      }),
    ).toThrow();
  });

  it("does not throw on an exact-boundary ratio", () => {
    expect(() =>
      strikeWaterTempC({
        grainKg: 5,
        targetMashTempC: 67,
        grainTempC: 20,
        waterToGrainRatioLPerKg: MIN_WATER_TO_GRAIN_RATIO,
      }),
    ).not.toThrow();
    expect(() =>
      strikeWaterTempC({
        grainKg: 5,
        targetMashTempC: 67,
        grainTempC: 20,
        waterToGrainRatioLPerKg: MAX_WATER_TO_GRAIN_RATIO,
      }),
    ).not.toThrow();
  });
});

describe("strikeWaterVolumeLiters", () => {
  it("5 kg grain at 3.0 L/kg → 15.0 L", () => {
    expect(
      strikeWaterVolumeLiters({
        grainKg: 5,
        targetMashTempC: 67,
        grainTempC: 20,
      }),
    ).toBe(15);
  });

  it("uses the provided ratio when given", () => {
    expect(
      strikeWaterVolumeLiters({
        grainKg: 4,
        targetMashTempC: 67,
        grainTempC: 20,
        waterToGrainRatioLPerKg: 2.75,
      }),
    ).toBe(11);
  });

  it("scales linearly with grain mass", () => {
    const a = strikeWaterVolumeLiters({
      grainKg: 3,
      targetMashTempC: 67,
      grainTempC: 20,
    });
    const b = strikeWaterVolumeLiters({
      grainKg: 6,
      targetMashTempC: 67,
      grainTempC: 20,
    });
    expect(b / a).toBeCloseTo(2, 6);
  });

  it("scales linearly with the ratio", () => {
    const thin = strikeWaterVolumeLiters({
      grainKg: 5,
      targetMashTempC: 67,
      grainTempC: 20,
      waterToGrainRatioLPerKg: 2.5,
    });
    const thick = strikeWaterVolumeLiters({
      grainKg: 5,
      targetMashTempC: 67,
      grainTempC: 20,
      waterToGrainRatioLPerKg: 5,
    });
    expect(thick / thin).toBeCloseTo(2, 6);
  });

  it("throws on a non-positive grain mass", () => {
    expect(() =>
      strikeWaterVolumeLiters({
        grainKg: 0,
        targetMashTempC: 67,
        grainTempC: 20,
      }),
    ).toThrow();
  });
});

describe("computeStrikeWater", () => {
  it("returns volume, strike temp, ratio, and round-trip echo", () => {
    const r = computeStrikeWater({
      grainKg: 5,
      targetMashTempC: 67,
      grainTempC: 20,
    });
    expect(r.volumeLiters).toBe(15);
    expect(r.strikeTempC).toBeCloseTo(73.3, 1);
    expect(r.waterToGrainRatioLPerKg).toBe(3.0);
    expect(r.input.grainKg).toBe(5);
    expect(r.input.targetMashTempC).toBe(67);
    expect(r.input.grainTempC).toBe(20);
  });

  it("echoes a custom ratio when one is provided", () => {
    const r = computeStrikeWater({
      grainKg: 4,
      targetMashTempC: 67,
      grainTempC: 20,
      waterToGrainRatioLPerKg: 2.75,
    });
    expect(r.waterToGrainRatioLPerKg).toBe(2.75);
    expect(r.input.waterToGrainRatioLPerKg).toBe(2.75);
  });
});

describe("totalGrainMassKg", () => {
  it("sums positive amounts and skips nulls / non-positive", () => {
    expect(
      totalGrainMassKg([
        { type: "grain", amountKg: 4.5 },
        { type: "grain", amountKg: 0.5 },
        { type: "extract", amountKg: 1.0 },
        { type: "grain", amountKg: 0 },
        { type: "grain", amountKg: -1 },
        { type: "grain", amountKg: Number.NaN }, // non-finite — skipped
      ]),
    ).toBe(6);
  });

  it("returns 0 for an empty fermentable list", () => {
    expect(totalGrainMassKg([])).toBe(0);
  });
});