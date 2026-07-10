// Unit tests for the BRE-44 style comparison presenter.

import { describe, expect, it } from "vitest";

import {
  presentStyleComparison,
  toBjcpStyleSummary,
} from "./presentStyle";

const americanIpa = {
  code: "21A",
  name: "American IPA",
  category: "beer",
  ogMin: 1.06,
  ogMax: 1.07,
  fgMin: 1.01,
  fgMax: 1.015,
  ibuMin: 50,
  ibuMax: 70,
  srmMin: 6,
  srmMax: 14,
  abvMin: 5.5,
  abvMax: 7.5,
  notes: null,
};

describe("toBjcpStyleSummary", () => {
  it("preserves all fields verbatim", () => {
    const summary = toBjcpStyleSummary(americanIpa);
    expect(summary.code).toBe("21A");
    expect(summary.name).toBe("American IPA");
    expect(summary.category).toBe("beer");
    expect(summary.ogMin).toBe(1.06);
    expect(summary.ogMax).toBe(1.07);
    expect(summary.fgMin).toBe(1.01);
    expect(summary.fgMax).toBe(1.015);
    expect(summary.ibuMin).toBe(50);
    expect(summary.ibuMax).toBe(70);
    expect(summary.srmMin).toBe(6);
    expect(summary.srmMax).toBe(14);
    expect(summary.abvMin).toBe(5.5);
    expect(summary.abvMax).toBe(7.5);
  });
});

describe("presentStyleComparison", () => {
  it("returns null style + null comparison when the style row is null", () => {
    const result = presentStyleComparison(
      {
        targetOg: 1.06,
        targetFg: 1.012,
        targetIbu: 60,
        targetSrm: 7,
        targetAbv: 6.7,
      },
      null,
    );
    expect(result.style).toBeNull();
    expect(result.comparison).toBeNull();
  });

  it("builds a comparison block for a recipe that matches the style", () => {
    const result = presentStyleComparison(
      {
        targetOg: 1.064,
        targetFg: 1.012,
        targetIbu: 60,
        targetSrm: 7,
        targetAbv: 6.7,
      },
      americanIpa,
    );
    expect(result.style?.code).toBe("21A");
    expect(result.comparison?.allInRange).toBe(true);
    expect(result.comparison?.outOfRangeCount).toBe(0);
  });

  it("passes null vitals straight through to classifyMetric", () => {
    const result = presentStyleComparison(
      {
        targetOg: null,
        targetFg: null,
        targetIbu: null,
        targetSrm: null,
        targetAbv: null,
      },
      americanIpa,
    );
    expect(result.comparison?.og.status).toBe("noData");
    expect(result.comparison?.ibu.status).toBe("noData");
    expect(result.comparison?.allInRange).toBeNull();
    expect(result.comparison?.outOfRangeCount).toBeNull();
  });

  it("respects null style bounds (e.g. mead has no IBU/SRM)", () => {
    const mead = {
      ...americanIpa,
      code: "M1A",
      name: "Traditional Mead",
      category: "mead",
      ibuMin: null,
      ibuMax: null,
      srmMin: null,
      srmMax: null,
    };
    const result = presentStyleComparison(
      {
        targetOg: 1.06,
        targetFg: 1.01,
        targetIbu: 0,
        targetSrm: 0,
        targetAbv: 7.0,
      },
      mead,
    );
    expect(result.comparison?.ibu.status).toBe("noRange");
    expect(result.comparison?.srm.status).toBe("noRange");
    // Only OG/FG/ABV contribute to the rollup.
    expect(result.comparison?.allInRange).toBe(true);
    expect(result.comparison?.outOfRangeCount).toBe(0);
  });
});
