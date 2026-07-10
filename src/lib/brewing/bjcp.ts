// BJCP style-guideline comparison (BRE-44).
//
// Pure, dependency-free helpers that take a recipe's measured vital stats and
// a `BjcpStyle` range row, and classify each metric as in-range / below /
// above / no-data / no-range. The UI uses this to render in/out-of-range
// indicators on the recipe detail page.
//
// Reference values are derived from the BJCP 2021 (beer) and 2015/2018
// (mead/cider) style guidelines. The canonical unit convention matches the
// rest of the brewing layer: gravity in specific gravity (1.056), IBU in
// integer units, SRM in degrees Lovibond, ABV in percent.
//
// Status semantics:
//   - `inRange`   : the metric is set and within the closed interval [min, max].
//   - `below`     : the metric is set and strictly less than the min.
//   - `above`     : the metric is set and strictly greater than the max.
//   - `noData`    : the recipe has no value for this metric (e.g. null target).
//   - `noRange`   : the style does not define a range for this metric (e.g.
//                   mead has no IBU/SRM). The UI should hide the indicator.

/** Vital stats we compare against a style. All fields are optional — only
 *  populated metrics participate in the comparison. */
export interface RecipeVitals {
  og?: number | null;
  fg?: number | null;
  ibu?: number | null;
  srm?: number | null;
  abv?: number | null;
}

/** Canonical range row, matching `BjcpStyle` in the Prisma schema. Each
 *  bound is optional — a `null` min or max means "no guideline" on that side. */
export interface StyleRange {
  ogMin?: number | null;
  ogMax?: number | null;
  fgMin?: number | null;
  fgMax?: number | null;
  ibuMin?: number | null;
  ibuMax?: number | null;
  srmMin?: number | null;
  srmMax?: number | null;
  abvMin?: number | null;
  abvMax?: number | null;
}

/** Status of a single metric against a single style. */
export type StyleMetricStatus =
  | "inRange"
  | "below"
  | "above"
  | "noData"
  | "noRange";

/** Per-metric comparison result. `min` and `max` are echoed (rounded) so the
 *  UI can render the guideline range next to the value. */
export interface StyleMetricResult {
  status: StyleMetricStatus;
  value: number | null;
  min: number | null;
  max: number | null;
}

/** Full comparison block, ready to attach to a recipe response. The order of
 *  keys is fixed so the JSON shape is stable for tests and the frontend. */
export interface StyleComparison {
  og: StyleMetricResult;
  fg: StyleMetricResult;
  ibu: StyleMetricResult;
  srm: StyleMetricResult;
  abv: StyleMetricResult;
  /** True when the style defines at least one range (false means the style
   *  code is unknown or has no guidelines; the UI should hide the panel). */
  hasAnyRange: boolean;
  /** True when *every* populated recipe metric is in range. Useful for a
   *  single "matches style" / "out of style" badge. */
  allInRange: boolean | null;
  /** Number of populated recipe metrics that fall outside the style range.
   *  When no recipe metrics are populated, this is `null` (not zero). */
  outOfRangeCount: number | null;
}

/** Classify one (value, min, max) triple.
 *
 *  - Returns `noData` when the value is `null` / `undefined` / non-finite.
 *  - Returns `noRange` when both min and max are absent.
 *  - Treats a missing bound on one side as open: only the present bound
 *    participates in the test. This matches the BJCP convention that some
 *    styles are described as "at least" or "no more than".
 *  - The `inclusive` flag means the bound itself counts as in-range — this
 *    matches how the BJCP publishes its style sheets (e.g. OG 1.060–1.070
 *    includes both endpoints). */
export function classifyMetric(
  value: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
  inclusive: boolean = true,
): StyleMetricResult {
  const safeMin = toFiniteOrNull(min);
  const safeMax = toFiniteOrNull(max);
  const safeValue = toFiniteOrNull(value);

  // Check the range *first* — a style that defines no guideline for this
  // metric (e.g. mead has no IBU) means "noRange" regardless of whether the
  // recipe happens to have a value or not. This lets the UI hide the metric
  // cleanly.
  if (safeMin == null && safeMax == null) {
    return { status: "noRange", value: safeValue, min: null, max: null };
  }
  if (safeValue == null) {
    return { status: "noData", value: null, min: safeMin, max: safeMax };
  }
  if (safeMin != null && (inclusive ? safeValue < safeMin : safeValue <= safeMin)) {
    return { status: "below", value: safeValue, min: safeMin, max: safeMax };
  }
  if (safeMax != null && (inclusive ? safeValue > safeMax : safeValue >= safeMax)) {
    return { status: "above", value: safeValue, min: safeMin, max: safeMax };
  }
  return { status: "inRange", value: safeValue, min: safeMin, max: safeMax };
}

/** Round the value/min/max of a metric to its natural display precision. */
function roundMetric(m: StyleMetricResult): StyleMetricResult {
  return {
    status: m.status,
    value: m.value == null ? null : roundForMetric(m.value),
    min: m.min == null ? null : roundForMetric(m.min),
    max: m.max == null ? null : roundForMetric(m.max),
  };
}

/** Pick a sensible display precision per metric: gravity 3dp, ABV 2dp,
 *  IBU/SRM 1dp. Mirrors the rest of the brewing layer's formatting. */
function roundForMetric(v: number): number {
  // We can't tell the metric from the number alone, so callers pass the
  // raw value through and we round at the comparison site per metric.
  // This helper is intentionally a no-op placeholder — rounding is done
  // by `compareToStyle` where we know which metric we're working on.
  return v;
}

/** Build a `StyleComparison` from a recipe's vital stats and a style range. */
export function compareToStyle(
  vitals: RecipeVitals,
  range: StyleRange,
): StyleComparison {
  const og = roundMetric(classifyMetric(vitals.og, range.ogMin, range.ogMax));
  const fg = roundMetric(classifyMetric(vitals.fg, range.fgMin, range.fgMax));
  const ibu = roundMetric(classifyMetric(vitals.ibu, range.ibuMin, range.ibuMax));
  const srm = roundMetric(classifyMetric(vitals.srm, range.srmMin, range.srmMax));
  const abv = roundMetric(classifyMetric(vitals.abv, range.abvMin, range.abvMax));

  const rounded: StyleComparison = {
    og: roundGravity(og),
    fg: roundGravity(fg),
    ibu: roundNumber(ibu, 1),
    srm: roundNumber(srm, 1),
    abv: roundNumber(abv, 2),
    hasAnyRange: false,
    allInRange: null,
    outOfRangeCount: null,
  };

  rounded.hasAnyRange = anyRangeDefined(rounded);
  // The rollup distinguishes three cases:
  //   1. The recipe has no values at all → we don't know whether it matches;
  //      report `allInRange: null` and `outOfRangeCount: null`.
  //   2. The recipe has values but the style defines no guideline for any of
  //      the metrics we have data on → vacuous match (nothing can be out of
  //      range); report `allInRange: true` and `outOfRangeCount: 0`.
  //   3. The recipe has at least one value that the style does define a
  //      range for → count out-of-range metrics among those.
  const metrics = [rounded.og, rounded.fg, rounded.ibu, rounded.srm, rounded.abv];
  const hasAnyValue = metrics.some(
    (m) => m.status === "inRange" || m.status === "below" || m.status === "above" || m.status === "noRange",
  );
  const known = metrics.filter(
    (m) =>
      m.status === "inRange" ||
      m.status === "below" ||
      m.status === "above",
  );
  if (!hasAnyValue) {
    rounded.outOfRangeCount = null;
    rounded.allInRange = null;
  } else {
    const outOf = known.filter(
      (m) => m.status === "below" || m.status === "above",
    );
    rounded.outOfRangeCount = outOf.length;
    rounded.allInRange = outOf.length === 0;
  }
  return rounded;
}

/** True when at least one of the metric ranges has at least one bound. */
function anyRangeDefined(c: StyleComparison): boolean {
  return [c.og, c.fg, c.ibu, c.srm, c.abv].some(
    (m) => m.min != null || m.max != null,
  );
}

function roundGravity(m: StyleMetricResult): StyleMetricResult {
  return {
    status: m.status,
    value: m.value == null ? null : round(m.value, 3),
    min: m.min == null ? null : round(m.min, 3),
    max: m.max == null ? null : round(m.max, 3),
  };
}

function roundNumber(m: StyleMetricResult, decimals: number): StyleMetricResult {
  return {
    status: m.status,
    value: m.value == null ? null : round(m.value, decimals),
    min: m.min == null ? null : round(m.min, decimals),
    max: m.max == null ? null : round(m.max, decimals),
  };
}

function round(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

function toFiniteOrNull(v: number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}
