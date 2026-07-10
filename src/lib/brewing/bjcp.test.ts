import { describe, expect, it } from "vitest";

import {
  classifyMetric,
  compareToStyle,
  type StyleRange,
} from "./bjcp";

describe("classifyMetric", () => {
  it("returns inRange when value is inside [min, max]", () => {
    const r = classifyMetric(1.062, 1.060, 1.070);
    expect(r.status).toBe("inRange");
    expect(r.value).toBe(1.062);
    expect(r.min).toBe(1.060);
    expect(r.max).toBe(1.070);
  });

  it("treats the min/max endpoints as in range (inclusive)", () => {
    expect(classifyMetric(1.060, 1.060, 1.070).status).toBe("inRange");
    expect(classifyMetric(1.070, 1.060, 1.070).status).toBe("inRange");
  });

  it("returns below when value is strictly less than min", () => {
    expect(classifyMetric(1.058, 1.060, 1.070).status).toBe("below");
  });

  it("returns above when value is strictly greater than max", () => {
    expect(classifyMetric(1.075, 1.060, 1.070).status).toBe("above");
  });

  it("returns noData when value is null/undefined/non-finite", () => {
    expect(classifyMetric(null, 1.060, 1.070).status).toBe("noData");
    expect(classifyMetric(undefined, 1.060, 1.070).status).toBe("noData");
    expect(classifyMetric(Number.NaN, 1.060, 1.070).status).toBe("noData");
    expect(classifyMetric(Number.POSITIVE_INFINITY, 1.060, 1.070).status).toBe(
      "noData",
    );
  });

  it("returns noRange when both bounds are absent", () => {
    expect(classifyMetric(50, null, null).status).toBe("noRange");
    expect(classifyMetric(50, undefined, undefined).status).toBe("noRange");
  });

  it("treats a missing bound on one side as open (no upper → never above)", () => {
    expect(classifyMetric(99, 50, null).status).toBe("inRange");
    expect(classifyMetric(99, 50, undefined).status).toBe("inRange");
  });

  it("treats a missing lower bound as no lower check", () => {
    expect(classifyMetric(0, null, 10).status).toBe("inRange");
    expect(classifyMetric(11, null, 10).status).toBe("above");
  });

  it("survives non-finite bounds by treating them as missing", () => {
    expect(classifyMetric(50, Number.NaN, 100).status).toBe("inRange");
    expect(classifyMetric(50, 0, Number.NaN).status).toBe("inRange");
  });
});

describe("compareToStyle", () => {
  // BJCP 2021 21A American IPA — the canonical reference for the seed.
  const americanIpa: StyleRange = {
    ogMin: 1.060,
    ogMax: 1.070,
    fgMin: 1.010,
    fgMax: 1.015,
    ibuMin: 50,
    ibuMax: 70,
    srmMin: 6,
    srmMax: 14,
    abvMin: 5.5,
    abvMax: 7.5,
  };

  it("flags every metric as in range for a textbook American IPA", () => {
    const c = compareToStyle(
      { og: 1.064, fg: 1.012, ibu: 60, srm: 7, abv: 6.7 },
      americanIpa,
    );
    expect(c.og.status).toBe("inRange");
    expect(c.fg.status).toBe("inRange");
    expect(c.ibu.status).toBe("inRange");
    expect(c.srm.status).toBe("inRange");
    expect(c.abv.status).toBe("inRange");
    expect(c.hasAnyRange).toBe(true);
    expect(c.allInRange).toBe(true);
    expect(c.outOfRangeCount).toBe(0);
  });

  it("flags metrics that fall outside the range (low OG, high IBU, low SRM)", () => {
    const c = compareToStyle(
      { og: 1.055, fg: 1.012, ibu: 90, srm: 3, abv: 6.7 },
      americanIpa,
    );
    expect(c.og.status).toBe("below");
    expect(c.ibu.status).toBe("above");
    expect(c.srm.status).toBe("below");
    expect(c.fg.status).toBe("inRange");
    expect(c.abv.status).toBe("inRange");
    expect(c.allInRange).toBe(false);
    expect(c.outOfRangeCount).toBe(3);
  });

  it("reports allInRange=null and outOfRangeCount=null when no metrics are populated", () => {
    const c = compareToStyle({}, americanIpa);
    expect(c.hasAnyRange).toBe(true);
    expect(c.allInRange).toBeNull();
    expect(c.outOfRangeCount).toBeNull();
    // Range was defined, but every metric is noData.
    expect(c.og.status).toBe("noData");
  });

  it("ignores metrics whose style range is absent (e.g. mead has no IBU)", () => {
    // M1A — Traditional Mead range; IBU and SRM are null on both sides.
    const mead: StyleRange = {
      ogMin: 1.035,
      ogMax: 1.115,
      fgMin: 0.990,
      fgMax: 1.030,
      ibuMin: null,
      ibuMax: null,
      srmMin: null,
      srmMax: null,
      abvMin: 3.5,
      abvMax: 15.0,
    };
    const c = compareToStyle(
      { og: 1.060, fg: 1.010, ibu: 0, srm: 0, abv: 12 },
      mead,
    );
    expect(c.og.status).toBe("inRange");
    expect(c.fg.status).toBe("inRange");
    expect(c.ibu.status).toBe("noRange");
    expect(c.srm.status).toBe("noRange");
    expect(c.abv.status).toBe("inRange");
    expect(c.hasAnyRange).toBe(true);
    // The two `noRange` metrics are excluded from the rollup.
    expect(c.outOfRangeCount).toBe(0);
    expect(c.allInRange).toBe(true);
  });

  it("reports hasAnyRange=false when the style defines no ranges at all", () => {
    const c = compareToStyle(
      { og: 1.05, fg: 1.01, abv: 5 },
      { ogMin: null, ogMax: null, fgMin: null, fgMax: null, abvMin: null, abvMax: null },
    );
    expect(c.hasAnyRange).toBe(false);
    expect(c.outOfRangeCount).toBe(0);
    expect(c.allInRange).toBe(true);
  });

  it("rounds gravity to 3dp, IBU/SRM to 1dp, ABV to 2dp", () => {
    const c = compareToStyle(
      { og: 1.0619, fg: 1.0126, ibu: 60.4567, srm: 7.234, abv: 6.6789 },
      americanIpa,
    );
    expect(c.og.value).toBe(1.062);
    expect(c.fg.value).toBe(1.013);
    expect(c.ibu.value).toBe(60.5);
    expect(c.srm.value).toBe(7.2);
    expect(c.abv.value).toBe(6.68);
  });

  it("treats null recipe vitals as noData, not noRange", () => {
    const c = compareToStyle(
      { og: null, fg: null, ibu: null, srm: null, abv: null },
      americanIpa,
    );
    expect(c.og.status).toBe("noData");
    expect(c.ibu.status).toBe("noData");
    expect(c.srm.status).toBe("noData");
    // Rollup: nothing populated → null.
    expect(c.allInRange).toBeNull();
  });

  it("handles a cider range (no IBU/SRM, only OG/FG/ABV)", () => {
    const cider: StyleRange = {
      ogMin: 1.045,
      ogMax: 1.065,
      fgMin: 1.000,
      fgMax: 1.020,
      ibuMin: null,
      ibuMax: null,
      srmMin: null,
      srmMax: null,
      abvMin: 5.0,
      abvMax: 8.0,
    };
    const c = compareToStyle(
      { og: 1.055, fg: 1.005, abv: 6.5 },
      cider,
    );
    expect(c.og.status).toBe("inRange");
    expect(c.fg.status).toBe("inRange");
    expect(c.abv.status).toBe("inRange");
    expect(c.ibu.status).toBe("noRange");
    expect(c.srm.status).toBe("noRange");
    expect(c.allInRange).toBe(true);
  });
});
