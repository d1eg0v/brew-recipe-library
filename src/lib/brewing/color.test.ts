import { describe, expect, it } from "vitest";
import { estimateSrm, maltColorUnits, srmToHex, srmToRgb } from "./color";
import { gallonsToLiters } from "./units";
import type { FermentableInput } from "./types";

describe("estimateSrm", () => {
  it("computes a pale-ale colour for a light grain bill", () => {
    // 1 kg (2.2 lb) @ 3 L in 1 gallon -> MCU ~6.6 -> SRM ~5.5 (Morey)
    const srm = estimateSrm(
      [{ type: "grain", amountKg: 1, colorLovibond: 3 }],
      gallonsToLiters(1),
    );
    expect(srm).toBeCloseTo(5.5, 1);
  });

  it("returns 0 when no colour data is present", () => {
    expect(estimateSrm([{ type: "grain", amountKg: 5 }], 20)).toBe(0);
    expect(estimateSrm([], 20)).toBe(0);
  });

  it("darker/more grain yields higher SRM", () => {
    const pale = estimateSrm([{ amountKg: 4, colorLovibond: 2 }], 20);
    const roasty = estimateSrm(
      [
        { amountKg: 4, colorLovibond: 2 },
        { amountKg: 0.5, colorLovibond: 500 },
      ],
      20,
    );
    expect(roasty).toBeGreaterThan(pale);
  });

  it("MCU scales with grain mass and inversely with volume", () => {
    const bill: FermentableInput[] = [{ amountKg: 5, colorLovibond: 10 }];
    expect(maltColorUnits(bill, 10)).toBeCloseTo(maltColorUnits(bill, 20) * 2, 6);
  });

  it("throws on a non-positive batch size", () => {
    expect(() => estimateSrm([{ amountKg: 5, colorLovibond: 10 }], 0)).toThrow();
  });
});

describe("srmToRgb", () => {
  it("returns the lightest reference colour for non-positive or zero input", () => {
    const zero = srmToRgb(0);
    expect(zero).toEqual({ r: 255, g: 245, b: 198 });
    expect(srmToRgb(-1)).toEqual(zero);
  });

  it("returns exact reference values for tabulated SRMs", () => {
    expect(srmToRgb(1)).toEqual({ r: 255, g: 245, b: 198 });
    expect(srmToRgb(2)).toEqual({ r: 255, g: 234, b: 170 });
    expect(srmToRgb(8)).toEqual({ r: 229, g: 169, b: 75 });
    expect(srmToRgb(20)).toEqual({ r: 162, g: 62, b: 27 });
    expect(srmToRgb(40)).toEqual({ r: 90, g: 16, b: 15 });
  });

  it("clamps to the darkest reference at and above SRM 80", () => {
    expect(srmToRgb(80)).toEqual({ r: 20, g: 2, b: 5 });
    expect(srmToRgb(120)).toEqual({ r: 20, g: 2, b: 5 });
  });

  it("linearly interpolates between tabulated entries", () => {
    // Halfway between SRM 10 (211,146,62) and SRM 12 (199,124,48).
    const mid = srmToRgb(11);
    expect(mid.r).toBe(205);
    expect(mid.g).toBe(135);
    expect(mid.b).toBe(55);
  });

  it("interpolates within a span that has no intermediate table row", () => {
    // Between SRM 22 (154,55,25) and SRM 25 (140,44,22) at t=1/3.
    const c = srmToRgb(23);
    expect(c.r).toBe(149);
    expect(c.g).toBe(51);
    expect(c.b).toBe(24);
  });

  it("always returns channels in the 0–255 range", () => {
    for (const srm of [-5, 0, 1, 5, 15, 30, 50, 80, 200]) {
      const { r, g, b } = srmToRgb(srm);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(255);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(255);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(255);
    }
  });

  it("normalises non-finite inputs to the lightest reference", () => {
    expect(srmToRgb(Number.NaN)).toEqual({ r: 255, g: 245, b: 198 });
    // Both positive and negative infinity short-circuit to 0, then clamp
    // to the first table row. This keeps the function total.
    expect(srmToRgb(Number.POSITIVE_INFINITY)).toEqual({ r: 255, g: 245, b: 198 });
    expect(srmToRgb(Number.NEGATIVE_INFINITY)).toEqual({ r: 255, g: 245, b: 198 });
  });

  it("darkens monotonically as SRM rises", () => {
    // Luminance (Rec. 601) decreases from pale to brown.
    const luminance = (c: { r: number; g: number; b: number }) =>
      0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    const samples = [1, 5, 10, 20, 30, 40, 60].map(srmToRgb);
    for (let i = 1; i < samples.length; i += 1) {
      expect(luminance(samples[i])).toBeLessThan(luminance(samples[i - 1]));
    }
  });
});

describe("srmToHex", () => {
  it("emits zero-padded #rrggbb for a tabulated SRM", () => {
    expect(srmToHex(8)).toBe("#e5a94b");
    expect(srmToHex(40)).toBe("#5a100f");
  });

  it("formats interpolated values to two-digit channels", () => {
    // SRM 11: r=205, g=135, b=55 -> #cd8737
    expect(srmToHex(11)).toBe("#cd8737");
  });

  it("clamps out-of-range values", () => {
    expect(srmToHex(0)).toBe("#fff5c6");
    expect(srmToHex(200)).toBe("#140205");
  });
});
