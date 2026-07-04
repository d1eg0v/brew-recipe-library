import { describe, expect, it } from "vitest";
import { estimateSrm, maltColorUnits } from "./color";
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
