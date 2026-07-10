// Presentation layer for BJCP style-guideline comparison (BRE-44).
//
// Pure helpers: take a recipe's vital stats and a `BjcpStyle` row, and return
// the JSON-serialisable block the API/UI consume. The actual classification
// lives in `@/lib/brewing/bjcp` — this module is purely about shaping the
// response (decimals, field selection, response shape) so the route handler
// can pass the result straight to `NextResponse.json`.

import { compareToStyle, type StyleComparison } from "@/lib/brewing/bjcp";
import type { BjcpStyleRow } from "@/lib/seed/loadBjcp";

/** The subset of `BjcpStyle` the API exposes to the client. */
export interface BjcpStyleSummary {
  code: string;
  name: string;
  category: string;
  ogMin: number | null;
  ogMax: number | null;
  fgMin: number | null;
  fgMax: number | null;
  ibuMin: number | null;
  ibuMax: number | null;
  srmMin: number | null;
  srmMax: number | null;
  abvMin: number | null;
  abvMax: number | null;
}

/** The full BRE-44 response block, attached to `RecipeDetail.style`. */
export interface RecipeStyleComparison {
  /** The matched style row, or null when the recipe has no `bjcpCategory`. */
  style: BjcpStyleSummary | null;
  /** Per-metric comparison; null when no style is attached. */
  comparison: StyleComparison | null;
}

/** Convert a `BjcpStyle` DB row to its API summary. Bounds are kept as-is
 *  (`number | null`); the comparison block does the rounding for display. */
export function toBjcpStyleSummary(row: BjcpStyleRow): BjcpStyleSummary {
  return {
    code: row.code,
    name: row.name,
    category: row.category,
    ogMin: row.ogMin,
    ogMax: row.ogMax,
    fgMin: row.fgMin,
    fgMax: row.fgMax,
    ibuMin: row.ibuMin,
    ibuMax: row.ibuMax,
    srmMin: row.srmMin,
    srmMax: row.srmMax,
    abvMin: row.abvMin,
    abvMax: row.abvMax,
  };
}

/** Build the BRE-44 block from a recipe's vitals and a (possibly null)
 *  matched style row. Returns a null style + null comparison when the
 *  recipe has no `bjcpCategory` or the code doesn't match any seeded row. */
export function presentStyleComparison(
  vitals: {
    targetOg: number | null;
    targetFg: number | null;
    targetIbu: number | null;
    targetSrm: number | null;
    targetAbv: number | null;
  },
  style: BjcpStyleRow | null,
): RecipeStyleComparison {
  if (!style) {
    return { style: null, comparison: null };
  }
  return {
    style: toBjcpStyleSummary(style),
    comparison: compareToStyle(
      {
        og: vitals.targetOg,
        fg: vitals.targetFg,
        ibu: vitals.targetIbu,
        srm: vitals.targetSrm,
        abv: vitals.targetAbv,
      },
      style,
    ),
  };
}
