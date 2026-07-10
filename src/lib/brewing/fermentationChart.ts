// Pure helpers for the fermentation gravity chart (BRE-38).
//
// All calculations live here as deterministic functions so they can be unit
// tested independently of the React layer. The chart itself is a small inline
// SVG, so we only need:
//   - axis range computation (min/max gravity + start/end timestamp)
//   - a projection from a (timestamp, gravity) reading to an SVG (x, y) point
//   - a polyline path string for the readings (drops nulls; skips non-monotonic
//     dates by sorting ascending first)
//
// Gravity units are dimensionless specific gravity (e.g. 1.054). Timestamps
// are Unix milliseconds. The chart is rendered in metric units; the UI handles
// any imperial display alongside (we don't expose °F for gravity because
// gravity has no imperial equivalent — only temperature does).

export interface GravityReading {
  /** Unix milliseconds (matches `Date.parse(logDate)`). */
  timestamp: number;
  /** Specific gravity (1.0–1.2). */
  gravity: number;
}

export interface ChartGeometry {
  /** Pixel width of the plot area (excluding y-axis label gutter). */
  width: number;
  /** Pixel height of the plot area (excluding x-axis label gutter). */
  height: number;
  /** Padding on every side of the plot area, in pixels. */
  padding: number;
}

export const DEFAULT_GEOMETRY: ChartGeometry = {
  width: 560,
  height: 200,
  padding: 28,
};

/** Inclusive y-axis bounds. Always at least 0.005 wide so we never divide by zero. */
export interface GravityAxis {
  min: number;
  max: number;
}

/** Inclusive x-axis bounds (Unix milliseconds). Always at least 1ms wide. */
export interface TimeAxis {
  min: number;
  max: number;
}

/**
 * Filter a raw log payload down to readings the chart can plot:
 * - drops entries with no gravity number
 * - drops unparseable dates
 * - sorts ascending by timestamp
 * - de-duplicates identical timestamps by keeping the last value
 */
export function toGravityReadings(
  rows: ReadonlyArray<{ logDate: string; gravity: number | null }>,
): GravityReading[] {
  const parsed: GravityReading[] = [];
  for (const row of rows) {
    if (row.gravity == null) continue;
    if (!Number.isFinite(row.gravity)) continue;
    const ts = Date.parse(row.logDate);
    if (!Number.isFinite(ts)) continue;
    parsed.push({ timestamp: ts, gravity: row.gravity });
  }
  parsed.sort((a, b) => a.timestamp - b.timestamp);
  // De-duplicate by timestamp (keep last occurrence).
  const dedup: GravityReading[] = [];
  for (const r of parsed) {
    if (
      dedup.length > 0 &&
      dedup[dedup.length - 1]!.timestamp === r.timestamp
    ) {
      dedup[dedup.length - 1] = r;
    } else {
      dedup.push(r);
    }
  }
  return dedup;
}

/**
 * Compute a gravity y-axis that brackets the readings with a little headroom.
 * Uses a brewer-friendly step (0.002) so axis labels read like
 * "1.010 / 1.030 / 1.050 / 1.070".
 *
 * - At least one reading must exist; otherwise defaults to [1.000, 1.020].
 * - `padRatio` adds proportional slack above and below (default 5%).
 * - Always snaps to the 0.002 grid so values feel predictable to brewers.
 */
export function gravityAxis(
  readings: ReadonlyArray<GravityReading>,
  padRatio = 0.05,
): GravityAxis {
  if (readings.length === 0) return { min: 1.0, max: 1.02 };

  let min = Infinity;
  let max = -Infinity;
  for (const r of readings) {
    if (r.gravity < min) min = r.gravity;
    if (r.gravity > max) max = r.gravity;
  }
  const span = Math.max(max - min, 0.001);
  const pad = span * padRatio;
  let lo = min - pad;
  let hi = max + pad;
  // Snap to 0.002 grid.
  lo = Math.floor(lo / 0.002) * 0.002;
  hi = Math.ceil(hi / 0.002) * 0.002;
  if (hi - lo < 0.002) hi = lo + 0.002;
  return { min: lo, max: hi };
}

/**
 * Compute a time x-axis that brackets the readings. Falls back to "today
 * + 1 day" when there are no readings so the empty-state chart still has a
 * sensible shape.
 */
export function timeAxis(
  readings: ReadonlyArray<GravityReading>,
  nowMs: number,
): TimeAxis {
  if (readings.length === 0) return { min: nowMs - 24 * 3600 * 1000, max: nowMs };
  let min = Infinity;
  let max = -Infinity;
  for (const r of readings) {
    if (r.timestamp < min) min = r.timestamp;
    if (r.timestamp > max) max = r.timestamp;
  }
  const span = max - min;
  if (span <= 0) {
    // Single-point chart: center the point and add one day of padding on each side.
    return { min: min - 24 * 3600 * 1000, max: min + 24 * 3600 * 1000 };
  }
  // 5% padding on each side so dots don't sit on the edge.
  const pad = span * 0.05;
  return { min: min - pad, max: max + pad };
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Map a single reading into SVG pixel coordinates inside the plot area.
 * Returns null if the reading's coordinates are outside the supplied axes
 * (shouldn't happen if `gravityAxis`/`timeAxis` are derived from the same set).
 */
export function project(
  reading: GravityReading,
  gravity: GravityAxis,
  time: TimeAxis,
  geom: ChartGeometry = DEFAULT_GEOMETRY,
): Point | null {
  const xSpan = time.max - time.min;
  const ySpan = gravity.max - gravity.min;
  if (xSpan <= 0 || ySpan <= 0) return null;

  const usableW = geom.width - geom.padding * 2;
  const usableH = geom.height - geom.padding * 2;
  if (usableW <= 0 || usableH <= 0) return null;

  const xRatio = (reading.timestamp - time.min) / xSpan;
  const yRatio = (reading.gravity - gravity.min) / ySpan;
  return {
    x: geom.padding + xRatio * usableW,
    y: geom.padding + (1 - yRatio) * usableH,
  };
}

/**
 * Build an SVG `points` string for a polyline. Drops null projections.
 * Useful for the `<polyline>` `points` attribute and the matching
 * circle-marker loop.
 */
export function polylinePoints(
  readings: ReadonlyArray<GravityReading>,
  gravity: GravityAxis,
  time: TimeAxis,
  geom: ChartGeometry = DEFAULT_GEOMETRY,
): { points: Array<{ reading: GravityReading; point: Point }> } {
  const out: Array<{ reading: GravityReading; point: Point }> = [];
  for (const r of readings) {
    const p = project(r, gravity, time, geom);
    if (p) out.push({ reading: r, point: p });
  }
  return { points: out };
}

/**
 * Build y-axis tick marks on the 0.002 grid, clamped to the axis range.
 * Returns at most ~6 ticks to keep the chart legible on small widths.
 */
export function gravityTicks(axis: GravityAxis): number[] {
  const out: number[] = [];
  const start = Math.ceil(axis.min / 0.002) * 0.002;
  for (let v = start; v <= axis.max + 1e-9; v += 0.002) {
    out.push(Number(v.toFixed(3)));
    if (out.length >= 7) break;
  }
  return out;
}

/**
 * Build x-axis tick marks. Aim for 4–6 evenly spaced ticks. Spacing is
 * picked from a sensible duration ladder (hours, days, weeks).
 */
export function timeTicks(
  axis: TimeAxis,
  targetCount = 5,
): { value: number; label: string }[] {
  const span = axis.max - axis.min;
  if (span <= 0) return [];
  const rawStep = span / Math.max(targetCount, 1);

  // Choose the smallest ladder step that gives us ~targetCount ticks.
  const HOUR = 3600 * 1000;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const ladder = [
    HOUR,
    6 * HOUR,
    DAY,
    2 * DAY,
    WEEK,
    2 * WEEK,
    4 * WEEK,
  ] as const;
  let step = ladder[ladder.length - 1]!;
  for (const candidate of ladder) {
    if (candidate >= rawStep) {
      step = candidate;
      break;
    }
  }

  const out: { value: number; label: string }[] = [];
  const first = Math.ceil(axis.min / step) * step;
  for (let t = first; t <= axis.max + 1; t += step) {
    out.push({ value: t, label: formatTickLabel(t, step) });
    if (out.length >= 8) break;
  }
  return out;
}

/** Format a tick label as "MM/DD" for ≥1d steps, "MM/DD HH:00" for hourly. */
function formatTickLabel(ms: number, step: number): string {
  const d = new Date(ms);
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hour = String(d.getUTCHours()).padStart(2, "0");
  return step < 24 * 3600 * 1000
    ? `${month}/${day} ${hour}:00`
    : `${month}/${day}`;
}