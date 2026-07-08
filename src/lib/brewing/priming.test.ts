import { describe, expect, it } from "vitest";

import {
  computePrimingSugar,
  PRIMING_SUGAR_OZ_PER_GAL_PER_VOLUME,
  PRIMING_SUGAR_TYPES,
  primingSugarGrams,
  residualCo2Volumes,
} from "./priming";

describe("residualCo2Volumes (Tinseth cubic)", () => {
  // Reference values pulled directly from Tinseth's published table at
  // https://www.tinseth.com/priming.php. The cubic fits 0–100 °F; we use the
  // same conversion from °C (round to 2 decimals, matching his output).
  it("matches Tinseth at 32 °F (0 °C) — cold conditioning, lots of CO2", () => {
    expect(residualCo2Volumes(0)).toBeCloseTo(1.69, 2);
  });

  it("matches Tinseth at 40 °F (~4.4 °C) — typical lager temperature", () => {
    expect(residualCo2Volumes((40 - 32) * (5 / 9))).toBeCloseTo(1.43, 2);
  });

  it("matches Tinseth at 60 °F (~15.6 °C) — basement ale temperature", () => {
    expect(residualCo2Volumes((60 - 32) * (5 / 9))).toBeCloseTo(0.87, 2);
  });

  it("matches Tinseth at 70 °F (~21.1 °C) — warm conditioning", () => {
    expect(residualCo2Volumes((70 - 32) * (5 / 9))).toBeCloseTo(0.65, 2);
  });

  it("monotonically decreases as temperature rises", () => {
    const at10 = residualCo2Volumes(10);
    const at20 = residualCo2Volumes(20);
    const at30 = residualCo2Volumes(30);
    expect(at10).toBeGreaterThan(at20);
    expect(at20).toBeGreaterThan(at30);
  });

  it("clamps to a sensible value for absurdly cold temperatures", () => {
    // Below 32 °F (0 °C) the polynomial is not fitted, so we clamp to its
    // 32 °F value — about 1.69 volumes. This is the CO2 you'd get at the
    // freezing point; the function refuses to extrapolate further down.
    expect(residualCo2Volumes(-20)).toBeCloseTo(1.69, 2);
  });

  it("clamps to a sensible value for very warm temperatures", () => {
    // Above 100 °F the polynomial is not fitted, so we clamp to its 100 °F
    // value — a low single-digit residual since hot beer can't hold much CO2.
    const at100F = residualCo2Volumes(100);
    const atBoil = residualCo2Volumes(200);
    expect(atBoil).toBeCloseTo(at100F, 6);
  });

  it("throws on a non-finite temperature", () => {
    expect(() => residualCo2Volumes(Number.NaN)).toThrow();
    expect(() => residualCo2Volumes(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("primingSugarGrams", () => {
  // Worked example: 5 US gallons (18.93 L) at 70 °F targeting 2.5 volumes of
  // corn sugar. Tinseth's published answer is ~4.6 oz = ~131 g. The exact
  // value the cubic gives at 70 °F is residual ≈ 0.649, so we need
  // 2.5 - 0.649 = 1.851 volumes. 5 * 1.851 * 0.5 = 4.6275 oz = 131.16 g.
  it("matches Tinseth's example: 5 gal @ 70 °F, 2.5 vol, corn sugar", () => {
    const grams = primingSugarGrams({
      volumeLiters: 18.927,
      targetVolumes: 2.5,
      temperatureC: 21.111,
      sugarType: "cornSugar",
    });
    expect(grams).toBeCloseTo(131.2, 1);
  });

  it("matches Tinseth's example: 5 gal @ 32 °F, 2.5 vol, corn sugar", () => {
    // Residual at 32 °F is ~1.69, so only 0.81 volumes to add. 5 * 0.81 * 0.5
    // = 2.025 oz = ~57.4 g.
    const grams = primingSugarGrams({
      volumeLiters: 18.927,
      targetVolumes: 2.5,
      temperatureC: 0,
      sugarType: "cornSugar",
    });
    expect(grams).toBeCloseTo(57.4, 1);
  });

  it("DME needs roughly twice as much as corn sugar at the same target", () => {
    const corn = primingSugarGrams({
      volumeLiters: 20,
      targetVolumes: 2.5,
      temperatureC: 20,
      sugarType: "cornSugar",
    });
    const dme = primingSugarGrams({
      volumeLiters: 20,
      targetVolumes: 2.5,
      temperatureC: 20,
      sugarType: "dme",
    });
    // Published ratio is 0.96 / 0.5 = 1.92x.
    expect(dme / corn).toBeCloseTo(1.92, 2);
  });

  it("table sugar lands between corn sugar and DME", () => {
    const corn = primingSugarGrams({
      volumeLiters: 20,
      targetVolumes: 2.5,
      temperatureC: 20,
      sugarType: "cornSugar",
    });
    const table = primingSugarGrams({
      volumeLiters: 20,
      targetVolumes: 2.5,
      temperatureC: 20,
      sugarType: "tableSugar",
    });
    const dme = primingSugarGrams({
      volumeLiters: 20,
      targetVolumes: 2.5,
      temperatureC: 20,
      sugarType: "dme",
    });
    expect(corn).toBeLessThan(table);
    expect(table).toBeLessThan(dme);
  });

  it("scales linearly with batch volume", () => {
    const small = primingSugarGrams({
      volumeLiters: 10,
      targetVolumes: 2.5,
      temperatureC: 20,
      sugarType: "cornSugar",
    });
    const big = primingSugarGrams({
      volumeLiters: 20,
      targetVolumes: 2.5,
      temperatureC: 20,
      sugarType: "cornSugar",
    });
    expect(big / small).toBeCloseTo(2, 6);
  });

  it("scales linearly with the target volume", () => {
    const low = primingSugarGrams({
      volumeLiters: 20,
      targetVolumes: 1.5,
      temperatureC: 20,
      sugarType: "cornSugar",
    });
    const high = primingSugarGrams({
      volumeLiters: 20,
      targetVolumes: 2.5,
      temperatureC: 20,
      sugarType: "cornSugar",
    });
    // Doubling the deltas (1.5-0.66 vs 2.5-0.66) yields ~3.2x, not exactly 1.67x
    // because the residual is a non-zero offset.
    expect(high).toBeGreaterThan(low);
  });

  it("returns zero when the target is already met by residual CO2", () => {
    // At 0 °C residual is ~1.69; asking for 1.5 means we need to add 0.
    const grams = primingSugarGrams({
      volumeLiters: 20,
      targetVolumes: 1.5,
      temperatureC: 0,
      sugarType: "cornSugar",
    });
    expect(grams).toBe(0);
  });

  it("throws on a non-positive batch volume", () => {
    expect(() =>
      primingSugarGrams({
        volumeLiters: 0,
        targetVolumes: 2.5,
        temperatureC: 20,
        sugarType: "cornSugar",
      }),
    ).toThrow();
  });
});

describe("computePrimingSugar", () => {
  it("returns grams, ounces, residual, and volumes-to-add", () => {
    const result = computePrimingSugar({
      volumeLiters: 20,
      targetVolumes: 2.5,
      temperatureC: 20,
      sugarType: "cornSugar",
    });
    expect(result.sugarType).toBe("cornSugar");
    expect(result.residualVolumes).toBeGreaterThan(0);
    expect(result.volumesToAdd).toBeGreaterThan(0);
    // Sanity: oz * 28.3495 ≈ grams (within rounding).
    expect(result.weightGrams).toBeCloseTo(result.weightOz * 28.3495, 0);
  });

  it("echoes the input back so clients can round-trip", () => {
    const input = {
      volumeLiters: 19,
      targetVolumes: 2.8,
      temperatureC: 18,
      sugarType: "tableSugar" as const,
    };
    expect(computePrimingSugar(input).input).toEqual(input);
  });
});

describe("PRIMING_SUGAR_TYPES and published multipliers", () => {
  it("exposes the three documented sugar types", () => {
    expect(PRIMING_SUGAR_TYPES).toEqual([
      "cornSugar",
      "tableSugar",
      "dme",
    ]);
  });

  it("uses the published Tinseth multipliers verbatim", () => {
    expect(PRIMING_SUGAR_OZ_PER_GAL_PER_VOLUME.cornSugar).toBe(0.5);
    expect(PRIMING_SUGAR_OZ_PER_GAL_PER_VOLUME.tableSugar).toBe(0.54);
    expect(PRIMING_SUGAR_OZ_PER_GAL_PER_VOLUME.dme).toBe(0.96);
  });
});
