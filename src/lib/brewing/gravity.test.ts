import { describe, expect, it } from "vitest";
import {
  attenuationFromYeasts,
  brixToGravity,
  estimateAbv,
  estimateFg,
  estimateHighGravityAbv,
  estimateOg,
  totalGravityPoints,
} from "./gravity";
import { gallonsToLiters } from "./units";
import type { FermentableInput } from "./types";

describe("estimateOg", () => {
  it("computes OG for a single grain at 100% efficiency in a 1-gallon batch", () => {
    // 1 kg (2.2046 lb) grain @ 36 ppg, 1 gallon, 100% eff -> ~79.4 points.
    const og = estimateOg(
      [{ type: "grain", amountKg: 1, potentialPpg: 36 }],
      gallonsToLiters(1),
      100,
    );
    expect(og).toBeCloseTo(1.079, 3);
  });

  it("applies brewhouse efficiency to grain but not to sugar", () => {
    const grain: FermentableInput[] = [{ type: "grain", amountKg: 2, potentialPpg: 36 }];
    const sugar: FermentableInput[] = [{ type: "sugar", amountKg: 2, potentialPpg: 36 }];
    const eff = 75;
    // grain points scale by 0.75, sugar by 1.0
    expect(totalGravityPoints(grain, eff)).toBeCloseTo(
      totalGravityPoints(sugar, eff) * 0.75,
      6,
    );
  });

  it("uses type-based default potential when none is given", () => {
    const og = estimateOg([{ type: "grain", amountKg: 5 }], 20, 75);
    expect(og).toBeGreaterThan(1.0);
    expect(og).toBeLessThan(1.09);
  });

  it("throws on a non-positive batch size", () => {
    expect(() => estimateOg([{ type: "grain", amountKg: 5 }], 0, 75)).toThrow();
  });

  it("returns 1.000 for an empty grain bill", () => {
    expect(estimateOg([], 20, 75)).toBe(1);
  });

  it("scales gravity inversely with batch size", () => {
    const bill: FermentableInput[] = [{ type: "grain", amountKg: 5, potentialPpg: 36 }];
    const small = estimateOg(bill, 10, 75);
    const large = estimateOg(bill, 40, 75);
    // Half the water -> roughly double the gravity points.
    expect(small - 1).toBeGreaterThan((large - 1) * 3.5);
  });
});

describe("estimateFg", () => {
  it("computes FG from OG and attenuation", () => {
    // OG 1.060 -> 60 points, 75% attenuation -> 15 points remain -> 1.015
    expect(estimateFg(1.06, 75)).toBeCloseTo(1.015, 3);
  });

  it("returns OG when attenuation is 0 and 1.000 when attenuation is 100", () => {
    expect(estimateFg(1.05, 0)).toBeCloseTo(1.05, 3);
    expect(estimateFg(1.05, 100)).toBeCloseTo(1.0, 3);
  });
});

describe("attenuationFromYeasts", () => {
  it("returns the first yeast with real data", () => {
    expect(attenuationFromYeasts([{ attenuationPct: 81 }])).toBe(81);
    expect(attenuationFromYeasts([{ attenuationPct: null }, { attenuationPct: 68 }])).toBe(68);
  });

  it("falls back to the default when no data is present", () => {
    expect(attenuationFromYeasts(undefined)).toBe(75);
    expect(attenuationFromYeasts([])).toBe(75);
    expect(attenuationFromYeasts([{ attenuationPct: null }])).toBe(75);
  });
});

describe("estimateAbv", () => {
  it("computes ABV from OG and FG", () => {
    expect(estimateAbv(1.05, 1.01)).toBeCloseTo(5.25, 2);
    expect(estimateAbv(1.079, 1.02)).toBeCloseTo(7.74, 2);
  });

  it("is zero when nothing fermented", () => {
    expect(estimateAbv(1.05, 1.05)).toBe(0);
  });
});

describe("estimateHighGravityAbv", () => {
  it("uses the nonlinear high-gravity formula for strong mead and wine", () => {
    expect(estimateHighGravityAbv(1.11, 0.998)).toBe(16.11);
  });
});

describe("brixToGravity", () => {
  it("converts refractometer Brix readings to specific gravity", () => {
    expect(brixToGravity(24)).toBe(1.101);
  });

  it("rejects negative readings", () => {
    expect(() => brixToGravity(-1)).toThrow(/brix/);
  });
});
