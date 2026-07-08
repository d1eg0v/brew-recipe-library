// Shared UI types for the recipe library.
//
// Mirrors the API response shapes so client components can stay strict without
// having to import generated Prisma types. All `id`/`recipeId`/timestamp
// fields from the DB are kept; consumers that don't need them can ignore.

export type RecipeCategory = "beer" | "mead" | "wine" | "cider" | "other";

export type UnitSystem = "metric" | "imperial";

/** A tag row attached to a recipe (BRE-29). */
export interface TagSummary {
  id: string;
  name: string;
}

/** Minimal recipe row used by the browse list view. */
export interface RecipeListItem {
  id: string;
  title: string;
  author: string | null;
  category: string;
  beverageType?: string | null;
  styleName: string | null;
  bjcpCategory: string | null;
  batchSizeLiters: number;
  targetAbv: number | null;
  targetIbu: number | null;
  targetSrm: number | null;
  targetOg: number | null;
  targetFg: number | null;
  targetPh: number | null;
  description: string | null;
  /** Sorted, normalised tag names. Empty array when the recipe has none. */
  tags: string[];
  /** Per-tag ids (parallel to `tags`). */
  tagDetails: TagSummary[];
  updatedAt: string;
}

/** Fermentable row as returned by the API. Imperial fields are present
 * alongside the metric ones when `?units=imperial` is requested. */
export interface FermentableRow {
  id: string;
  name: string;
  type: string | null;
  amountKg: number | null;
  amountLiters: number | null;
  amountLbs?: number | null;
  amountGallons?: number | null;
  colorLovibond: number | null;
  potentialPpg: number | null;
  notes: string | null;
  position: number;
}

export interface HopRow {
  id: string;
  name: string;
  amountGrams: number;
  amountOz?: number | null;
  alphaAcidPct: number | null;
  timeMinutes: number;
  use: string | null;
  form: string | null;
  notes: string | null;
  position: number;
}

export interface YeastRow {
  id: string;
  name: string;
  laboratory: string | null;
  productId: string | null;
  type: string | null;
  form: string | null;
  attenuationPct: number | null;
  abvTolerancePct: number | null;
  temperatureCMin: number | null;
  temperatureCMax: number | null;
  temperatureFMin?: number | null;
  temperatureFMax?: number | null;
  notes: string | null;
  position: number;
}

export interface MashStepRow {
  id: string;
  name: string;
  type: string | null;
  stepTempC: number;
  stepTempF?: number | null;
  stepTimeMinutes: number | null;
  infuseAmountLiters: number | null;
  infuseAmountGallons?: number | null;
  notes: string | null;
  position: number;
}

export interface ProcessStepRow {
  id: string;
  name: string;
  type: string | null;
  tempC: number | null;
  tempF?: number | null;
  durationDays: number | null;
  notes: string | null;
  position: number;
}

export interface AdditionRow {
  id: string;
  name: string;
  amount: number | null;
  unit: string | null;
  purpose: string | null;
  timing: string | null;
  notes: string | null;
  position: number;
}

/** Full recipe payload returned by `GET /api/recipes/[id]`. */
export interface RecipeDetail {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  notes: string | null;
  category: string;
  beverageType?: string | null;
  styleName: string | null;
  bjcpCategory: string | null;
  batchSizeLiters: number;
  batchSizeGallons?: number | null;
  boilTimeMinutes: number;
  efficiencyPct: number;
  targetOg: number | null;
  targetFg: number | null;
  targetPh: number | null;
  targetAbv: number | null;
  targetIbu: number | null;
  targetSrm: number | null;
  fermentables: FermentableRow[];
  hops: HopRow[];
  yeasts: YeastRow[];
  mashSteps: MashStepRow[];
  processSteps: ProcessStepRow[];
  additions: AdditionRow[];
  /** Sorted, normalised tag names. Empty array when the recipe has none. */
  tags: string[];
  /** Per-tag ids (parallel to `tags`). */
  tagDetails: TagSummary[];
  createdAt: string;
  updatedAt: string;
}

/** Calculated targets derived from a recipe on the server. */
export interface ComputedTargets {
  og: number | null;
  fg: number | null;
  abv: number | null;
  ibu: number | null;
  srm: number | null;
}

export interface RecipeListResponse {
  data: RecipeListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface RecipeDetailResponse {
  data: RecipeDetail;
}

export interface BatchLogRow {
  id: string;
  recipeId: string;
  batchId: string | null;
  logDate: string;
  type: string;
  gravity: number | null;
  ph: number | null;
  temperatureC: number | null;
  volumeLiters: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One row of the shopping list as returned by `GET /api/recipes/[id]/shopping-list`. */
export interface ShoppingListItem {
  category: "fermentables" | "hops" | "yeast" | "additions";
  name: string;
  amount: number;
  /** Canonical metric unit ("kg", "L", "g", "packets", or a free-text addition unit). */
  unit: string;
  /** Sub-bucket — hop use ("boil", "dryHop") or yeast form ("dry", "liquid"); "" otherwise. */
  detail: string;
  /** Display-only imperial equivalent when `?units=imperial` was requested. */
  imperialAmount?: number | null;
  /** Imperial unit for `imperialAmount`. */
  imperialUnit?: string | null;
}

/** Per-category and total counts for the UI summary line. */
export interface ShoppingListSummary {
  fermentables: number;
  hops: number;
  yeast: number;
  additions: number;
  total: number;
}

export interface ShoppingList {
  recipeBatchSizeLiters: number;
  items: ShoppingListItem[];
  counts: ShoppingListSummary;
}

export interface ShoppingListResponse {
  data: ShoppingList;
}

// -----------------------------------------------------------------------------
// Batch (brew log) types — mirror the response from
// `GET /api/recipes/[id]/batches` and `GET /api/batches/[id]`. The list and
// detail endpoints return the same row shape, with a `derived` block
// (actualAbv / apparentAttenuation / brewhouseEfficiency) attached by the
// presentation layer.
// -----------------------------------------------------------------------------

/** Derived metrics attached to a Batch row by `presentBatch`. */
export interface BatchDerived {
  actualAbv: number | null;
  apparentAttenuation: number | null;
  brewhouseEfficiency: number | null;
}

/** One logged brew as returned by both batch endpoints. */
export interface BatchSummary {
  id: string;
  recipeId: string;
  /** ISO timestamp of brew day. */
  brewDate: string;
  measuredOg: number | null;
  measuredFg: number | null;
  volumeLiters: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  derived: BatchDerived;
}

export interface BatchListResponse {
  data: BatchSummary[];
}

export interface BatchResponse {
  data: BatchSummary;
}

// ---------------------------------------------------------------------------
// Priming-sugar / carbonation calculator (BRE-32).
// ---------------------------------------------------------------------------

/** Sugar options the calculator accepts. */
export type PrimingSugarType = "cornSugar" | "tableSugar" | "dme";

/** Server-derived result of the priming-sugar calculation. */
export interface PrimingSugarResult {
  weightGrams: number;
  weightOz: number;
  residualVolumes: number;
  volumesToAdd: number;
  sugarType: PrimingSugarType;
  input: {
    volumeLiters: number;
    targetVolumes: number;
    temperatureC: number;
    sugarType: PrimingSugarType;
  };
}

/** `GET /api/priming-sugar` response shape. */
export interface PrimingSugarResponse {
  data: {
    result: PrimingSugarResult;
    imperial?: { weightOz: number } | null;
    source: "standalone" | "recipe";
    recipe?: { id: string; title: string; batchSizeLiters: number } | null;
  };
}

// ---------------------------------------------------------------------------
// Quick ABV-from-OG/FG calculator (BRE-35).
// ---------------------------------------------------------------------------

/** Which formula the ABV calc used. Matches `AbvFormula` in `@/lib/brewing/abv`. */
export type AbvFormula = "linear" | "highGravity";

/** Server-derived result of the ABV calculation. */
export interface MeasuredAbvResult {
  /** Alcohol by volume, percent. */
  abvPct: number;
  /** Apparent attenuation, percent (0–100). */
  apparentAttenuationPct: number;
  /** Gravity points dropped during fermentation (OG − FG, in points × 1000). */
  gravityPointsDropped: number;
  /** Which formula was used. */
  formulaUsed: AbvFormula;
  /** True when the high-gravity formula was used (either forced or auto-picked). */
  isHighGravity: boolean;
  input: {
    measuredOg: number;
    measuredFg: number;
    formula: AbvFormula;
  };
}

/** `GET /api/abv` response shape. */
export interface MeasuredAbvResponse {
  data: {
    result: MeasuredAbvResult;
    /** Echoed source — "standalone" when no recipe was involved. */
    source: "standalone" | "recipe";
    /** Optional pre-fill context (the recipe that fed OG/FG). */
    recipe?: {
      id: string;
      title: string;
      targetOg: number | null;
      targetFg: number | null;
    } | null;
  };
}
