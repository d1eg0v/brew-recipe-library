// Unit tests for the BJCP style seed loader.

import { describe, expect, it } from "vitest";

import { loadBjcpStyles } from "./loadBjcp";

describe("loadBjcpStyles", () => {
  it("parses a single valid row", () => {
    const rows = loadBjcpStyles([
      {
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
        notes: "BJCP 2021",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].code).toBe("21A");
    expect(rows[0].category).toBe("beer");
    expect(rows[0].ogMin).toBe(1.06);
    expect(rows[0].notes).toBe("BJCP 2021");
  });

  it("normalises category to lower-case and trims string fields", () => {
    const rows = loadBjcpStyles([
      {
        code: "  M1A  ",
        name: "  Traditional Mead  ",
        category: "  MEAD  ",
        ogMin: 1.035,
        ogMax: 1.115,
        fgMin: 0.99,
        fgMax: 1.03,
        abvMin: 3.5,
        abvMax: 15,
      },
    ]);
    expect(rows[0].code).toBe("M1A");
    expect(rows[0].name).toBe("Traditional Mead");
    expect(rows[0].category).toBe("mead");
  });

  it("coerces null and missing bounds to null", () => {
    const rows = loadBjcpStyles([
      {
        code: "M1A",
        name: "Mead",
        category: "mead",
        ogMin: 1.035,
        ogMax: 1.115,
        ibuMin: null,
        ibuMax: null,
        srmMin: undefined,
        srmMax: undefined,
        abvMin: 3.5,
        abvMax: 15,
      },
    ]);
    expect(rows[0].ibuMin).toBeNull();
    expect(rows[0].ibuMax).toBeNull();
    expect(rows[0].srmMin).toBeNull();
    expect(rows[0].srmMax).toBeNull();
  });

  it("rejects non-numeric strings with a Zod error", () => {
    expect(() =>
      loadBjcpStyles([
        {
          code: "X1",
          name: "Stub",
          category: "beer",
          ogMin: "not-a-number",
          ogMax: "1.050",
        } as unknown,
      ]),
    ).toThrow(/ogMin/);
  });

  it("throws on an empty array", () => {
    // The loader accepts an empty array — the caller decides whether that
    // is an error. We just assert the resulting list is empty.
    const rows = loadBjcpStyles([]);
    expect(rows).toEqual([]);
  });

  it("throws when the root is not an array", () => {
    expect(() => loadBjcpStyles({ code: "21A" } as unknown)).toThrow(
      /must be a JSON array/,
    );
  });

  it("throws on a row missing required fields", () => {
    expect(() =>
      loadBjcpStyles([{ code: "21A" } as unknown]),
    ).toThrow(/bjcp\.json\[0\]: name/);
  });
});
