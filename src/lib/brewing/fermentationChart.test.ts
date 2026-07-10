// Unit tests for the fermentation-chart pure module (BRE-38).
//
// Reference values chosen by hand from a typical primary-fermentation curve:
// OG ~ 1.054 → FG ~ 1.012 over ~10 days. The functions are pure so these are
// stable: the only thing under test is the math + ordering, not the DOM.

import { describe, it, expect } from "vitest";

import {
  DEFAULT_GEOMETRY,
  gravityAxis,
  gravityTicks,
  polylinePoints,
  project,
  timeAxis,
  timeTicks,
  toGravityReadings,
  type GravityReading,
} from "./fermentationChart";

const ONE_DAY = 24 * 3600 * 1000;

function reading(daysAgo: number, gravity: number, baseMs: number): GravityReading {
  return { timestamp: baseMs - daysAgo * ONE_DAY, gravity };
}

describe("toGravityReadings", () => {
  it("drops rows with no gravity", () => {
    const out = toGravityReadings([
      { logDate: "2026-06-01T00:00:00.000Z", gravity: null },
      { logDate: "2026-06-02T00:00:00.000Z", gravity: 1.04 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.gravity).toBe(1.04);
  });

  it("drops rows with unparseable dates", () => {
    const out = toGravityReadings([
      { logDate: "not a date", gravity: 1.05 },
      { logDate: "2026-06-02T00:00:00.000Z", gravity: 1.04 },
    ]);
    expect(out).toHaveLength(1);
  });

  it("sorts ascending by timestamp", () => {
    const out = toGravityReadings([
      { logDate: "2026-06-05T00:00:00.000Z", gravity: 1.02 },
      { logDate: "2026-06-01T00:00:00.000Z", gravity: 1.054 },
      { logDate: "2026-06-03T00:00:00.000Z", gravity: 1.035 },
    ]);
    expect(out.map((r) => r.gravity)).toEqual([1.054, 1.035, 1.02]);
  });

  it("de-duplicates identical timestamps, keeping the last value", () => {
    const out = toGravityReadings([
      { logDate: "2026-06-01T00:00:00.000Z", gravity: 1.054 },
      { logDate: "2026-06-01T00:00:00.000Z", gravity: 1.052 },
      { logDate: "2026-06-02T00:00:00.000Z", gravity: 1.04 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]!.gravity).toBe(1.052);
  });

  it("returns an empty list for an empty input", () => {
    expect(toGravityReadings([])).toEqual([]);
  });
});

describe("gravityAxis", () => {
  const base = Date.UTC(2026, 5, 1);
  it("falls back to a narrow default when there are no readings", () => {
    const axis = gravityAxis([]);
    expect(axis.max - axis.min).toBeGreaterThanOrEqual(0.002);
    expect(axis.min).toBeLessThanOrEqual(1.0);
  });

  it("snaps bounds to the 0.002 grid and adds headroom", () => {
    const readings = [reading(0, 1.054, base), reading(10, 1.012, base)];
    const axis = gravityAxis(readings);
    // 5% of span (~0.021) added to both sides, then snapped.
    expect(axis.min).toBeLessThanOrEqual(1.012);
    expect(axis.max).toBeGreaterThanOrEqual(1.054);
    // Multiples of 0.002.
    expect((axis.min * 1000) % 2).toBeCloseTo(0, 5);
    expect((axis.max * 1000) % 2).toBeCloseTo(0, 5);
  });

  it("never produces a zero-width axis", () => {
    const axis = gravityAxis([reading(0, 1.05, base)]);
    expect(axis.max - axis.min).toBeGreaterThanOrEqual(0.002);
  });
});

describe("timeAxis", () => {
  const base = Date.UTC(2026, 5, 1);
  it("falls back to a 24-hour window when there are no readings", () => {
    const axis = timeAxis([], base);
    expect(axis.max - axis.min).toBe(24 * 3600 * 1000);
    expect(axis.max).toBe(base);
  });

  it("pads the span by 5% on each side for multi-point readings", () => {
    // chronological order: older first (10d ago), newer last (now)
    const readings = [reading(10, 1.05, base), reading(0, 1.01, base)];
    const axis = timeAxis(readings, base);
    const span = 10 * ONE_DAY;
    // min = (base - 10d) - 5%*span, max = base + 5%*span
    expect(axis.min).toBeCloseTo(base - 10 * ONE_DAY - span * 0.05, -2);
    expect(axis.max).toBeCloseTo(base + span * 0.05, -2);
  });

  it("uses ±1 day padding for a single-point reading", () => {
    const axis = timeAxis([reading(0, 1.05, base)], base);
    expect(axis.max - axis.min).toBe(2 * ONE_DAY);
  });
});

describe("project", () => {
  const base = Date.UTC(2026, 5, 1);
  const geom = DEFAULT_GEOMETRY;

  it("places the earliest reading near the left edge and the latest near the right edge", () => {
    // chronological order: older first, newer last. The time axis adds 5%
    // padding on each side, so the readings sit slightly inside the gutters.
    // With original span S and padding 0.05*S on each side, the total span
    // is 1.10*S, so each reading is at 0.05/1.10 along the padded axis.
    const readings = [reading(10, 1.054, base), reading(0, 1.012, base)];
    const g = gravityAxis(readings);
    const t = timeAxis(readings, base);
    const first = project(readings[0]!, g, t, geom);
    const last = project(readings[1]!, g, t, geom);
    expect(first).not.toBeNull();
    expect(last).not.toBeNull();
    const usableW = geom.width - 2 * geom.padding;
    const ratio = 0.05 / 1.1;
    expect(first!.x).toBeCloseTo(geom.padding + ratio * usableW, 0);
    expect(last!.x).toBeCloseTo(geom.width - geom.padding - ratio * usableW, 0);
  });

  it("places higher gravity at lower y (gravity axis is inverted in SVG)", () => {
    const readings = [reading(10, 1.054, base), reading(0, 1.012, base)];
    const g = gravityAxis(readings);
    const t = timeAxis(readings, base);
    const top = project(readings[0]!, g, t, geom);
    const bottom = project(readings[1]!, g, t, geom);
    expect(top!.y).toBeLessThan(bottom!.y);
  });

  it("returns null when the axes are degenerate", () => {
    const p = project(
      { timestamp: base, gravity: 1.05 },
      { min: 1.05, max: 1.05 },
      { min: base, max: base },
      geom,
    );
    expect(p).toBeNull();
  });
});

describe("polylinePoints", () => {
  const base = Date.UTC(2026, 5, 1);
  it("returns one entry per reading in chronological order", () => {
    const readings = [reading(0, 1.054, base), reading(5, 1.025, base), reading(10, 1.012, base)];
    const g = gravityAxis(readings);
    const t = timeAxis(readings, base);
    const { points } = polylinePoints(readings, g, t);
    expect(points.map((p) => p.reading.gravity)).toEqual([1.054, 1.025, 1.012]);
  });

  it("produces strictly increasing x values for a chronological sequence", () => {
    // chronological order: oldest first (10d ago), newest last (now)
    const readings = [reading(10, 1.054, base), reading(5, 1.025, base), reading(0, 1.012, base)];
    const g = gravityAxis(readings);
    const t = timeAxis(readings, base);
    const { points } = polylinePoints(readings, g, t);
    for (let i = 1; i < points.length; i++) {
      expect(points[i]!.point.x).toBeGreaterThan(points[i - 1]!.point.x);
    }
  });
});

describe("gravityTicks", () => {
  it("produces 0.002-aligned ticks within the axis range", () => {
    const axis = gravityAxis([{ timestamp: 0, gravity: 1.05 }]);
    const ticks = gravityTicks(axis);
    expect(ticks.length).toBeGreaterThan(0);
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(axis.min - 1e-9);
      expect(t).toBeLessThanOrEqual(axis.max + 1e-9);
      // multiples of 0.002
      expect((t * 1000) % 2).toBeCloseTo(0, 5);
    }
  });

  it("caps at 7 ticks", () => {
    const axis = { min: 0.99, max: 1.2 };
    expect(gravityTicks(axis).length).toBeLessThanOrEqual(7);
  });
});

describe("timeTicks", () => {
  const base = Date.UTC(2026, 5, 1);

  it("returns daily labels for a multi-day span", () => {
    const readings = [reading(14, 1.05, base), reading(0, 1.01, base)];
    const t = timeAxis(readings, base);
    const ticks = timeTicks(t, 5);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks[0]!.label).toMatch(/^\d{2}\/\d{2}$/);
  });

  it("returns hourly labels when the span is sub-day", () => {
    const t = { min: base, max: base + 6 * 3600 * 1000 };
    const ticks = timeTicks(t, 5);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks[0]!.label).toMatch(/^\d{2}\/\d{2} \d{2}:00$/);
  });
});