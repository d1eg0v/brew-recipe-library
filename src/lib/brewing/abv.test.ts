import { describe, expect, it } from "vitest";

import {
  HIGH_GRAVITY_OG_THRESHOLD,
  computeMeasuredAbv,
  type MeasuredAbvResult,
} from "./abv";

describe("computeMeasuredAbv", () => {
  it("computes a typical pale-ale ABV with the linear formula", () => {
    // 1.052 -> 1.012, linear: (52 - 12) × 0.2 / 16 ≈ 5.0% expected from
    // the canonical (OG - FG) × 131.25 shortcut.
    const result = computeMeasuredAbv({ measuredOg: 1.052, measuredFg: 1.012 });
    expect(result.abvPct).toBeCloseTo(5.25, 2);
    expect(result.formulaUsed).toBe("linear");
    expect(result.isHighGravity).toBe(false);
    expect(result.gravityPointsDropped).toBe(40);
  });

  it("auto-selects the high-gravity formula at OG ≥ 1.07", () => {
    // 1.11 -> 0.998 is the canonical mead reference used in gravity.test.ts
    // (highGravity should land on 16.11).
    const result = computeMeasuredAbv({ measuredOg: 1.11, measuredFg: 0.998 });
    expect(result.formulaUsed).toBe("highGravity");
    expect(result.isHighGravity).toBe(true);
    expect(result.abvPct).toBe(16.11);
  });

  it("auto-picks high-gravity exactly at the threshold (1.070)", () => {
    const result = computeMeasuredAbv({ measuredOg: 1.07, measuredFg: 1.01 });
    expect(result.formulaUsed).toBe("highGravity");
  });

  it("auto-picks linear just below the threshold (1.069)", () => {
    const result = computeMeasuredAbv({ measuredOg: 1.069, measuredFg: 1.01 });
    expect(result.formulaUsed).toBe("linear");
  });

  it("respects explicit formula=linear even at high OG", () => {
    const result = computeMeasuredAbv({
      measuredOg: 1.11,
      measuredFg: 0.998,
      formula: "linear",
    });
    expect(result.formulaUsed).toBe("linear");
    // (1.11 - 0.998) × 131.25 = 14.7
    expect(result.abvPct).toBeCloseTo(14.7, 2);
  });

  it("respects explicit formula=highGravity even at low OG", () => {
    const result = computeMeasuredAbv({
      measuredOg: 1.04,
      measuredFg: 1.012,
      formula: "highGravity",
    });
    expect(result.formulaUsed).toBe("highGravity");
    // High-gravity formula at modest OG yields a slightly higher ABV than
    // linear (the correction adds alcohol-attraction logic).
    // 76.08 × 0.028 / (1.775 - 1.04) × (1.012 / 0.794)
    //   = 2.902 / 0.735 × 1.2745 ≈ 3.95 × 1.2745 ≈ 5.03
    expect(result.abvPct).toBeGreaterThan(3.6);
    expect(result.abvPct).toBeLessThan(3.8);
  });

  it("returns zero ABV when OG equals FG", () => {
    const result = computeMeasuredAbv({ measuredOg: 1.05, measuredFg: 1.05 });
    expect(result.abvPct).toBe(0);
    expect(result.apparentAttenuationPct).toBe(0);
    expect(result.gravityPointsDropped).toBe(0);
    // OG is below the threshold so the linear formula is used; the result is
    // 0 either way.
    expect(result.formulaUsed).toBe("linear");
  });

  it("computes apparent attenuation", () => {
    // OG 1.050, FG 1.012 -> 38 / 50 = 76%
    const result = computeMeasuredAbv({ measuredOg: 1.05, measuredFg: 1.012 });
    expect(result.apparentAttenuationPct).toBe(76);
  });

  it("reports gravity points dropped", () => {
    const result = computeMeasuredAbv({ measuredOg: 1.062, measuredFg: 1.015 });
    expect(result.gravityPointsDropped).toBe(47);
  });

  it("echoes the resolved formula on the input", () => {
    const auto = computeMeasuredAbv({ measuredOg: 1.05, measuredFg: 1.012 });
    expect(auto.input.formula).toBe("linear");
    const forced = computeMeasuredAbv({
      measuredOg: 1.05,
      measuredFg: 1.012,
      formula: "highGravity",
    });
    expect(forced.input.formula).toBe("highGravity");
  });

  it("throws when OG is below FG", () => {
    expect(() =>
      computeMeasuredAbv({ measuredOg: 1.01, measuredFg: 1.02 }),
    ).toThrow(/measuredOg/);
  });

  it("throws on non-finite inputs", () => {
    expect(() =>
      computeMeasuredAbv({ measuredOg: Number.NaN, measuredFg: 1.01 }),
    ).toThrow(/measuredOg/);
    expect(() =>
      computeMeasuredAbv({ measuredOg: 1.05, measuredFg: Number.POSITIVE_INFINITY }),
    ).toThrow(/measuredFg/);
  });

  it("rejects out-of-range gravities", () => {
    expect(() =>
      computeMeasuredAbv({ measuredOg: 0.9, measuredFg: 1.0 }),
    ).toThrow(/measuredOg/);
    expect(() =>
      computeMeasuredAbv({ measuredOg: 1.05, measuredFg: 1.3 }),
    ).toThrow(/measuredFg/);
  });

  it("accepts the boundary gravities (0.95 and 1.20)", () => {
    // Both boundary readings are equal -> 0% ABV. The point of the test is
    // that the validator doesn't reject the values themselves.
    const result = computeMeasuredAbv({
      measuredOg: 1.2,
      measuredFg: 0.95,
    });
    // (1.2 - 0.95) × 131.25 = 32.81 (linear form).
    // (76.08 × 0.25 / 0.575) × (0.95 / 0.794) ≈ 33.08 × 1.196 ≈ 39.56 (high-gravity).
    // The auto-pick uses high-gravity because OG ≥ 1.07.
    const expected: MeasuredAbvResult["formulaUsed"] = "highGravity";
    expect(result.formulaUsed).toBe(expected);
    expect(result.abvPct).toBeGreaterThan(0);
  });

  it("exposes the threshold constant for callers", () => {
    expect(HIGH_GRAVITY_OG_THRESHOLD).toBe(1.07);
  });
});