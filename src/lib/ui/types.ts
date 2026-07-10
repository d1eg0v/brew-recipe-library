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
  averageRating: number | null;
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
  /** BRE-43: `true` when the recipe has an active share token. */
  shareable: boolean;
  /** BRE-43: absolute public URL of the shareable view, or `null`. Only set
   *  when the API was called with an `origin` and the recipe is shareable. */
  shareUrl: string | null;
  averageRating: number | null;
  createdAt: string;
  updatedAt: string;
  /** BRE-44: BJCP style-guideline comparison block. Null when the recipe
   *  has no `bjcpCategory` or the code doesn't match a seeded style. */
  style: RecipeStyleComparison | null;
}

/** Per-metric comparison result echoed from the API (BRE-44). Mirrors
 *  `StyleMetricResult` from `@/lib/brewing/bjcp` so the client can stay
 *  strict without importing the brewing module. */
export interface StyleMetricResult {
  status: "inRange" | "below" | "above" | "noData" | "noRange";
  value: number | null;
  min: number | null;
  max: number | null;
}

/** Full BRE-44 style comparison block. */
export interface RecipeStyleComparison {
  style: BjcpStyleSummary | null;
  comparison: StyleComparisonBlock | null;
}

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

export interface StyleComparisonBlock {
  og: StyleMetricResult;
  fg: StyleMetricResult;
  ibu: StyleMetricResult;
  srm: StyleMetricResult;
  abv: StyleMetricResult;
  hasAnyRange: boolean;
  allInRange: boolean | null;
  outOfRangeCount: number | null;
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
// Strike-water / mash-infusion calculator (BRE-34).
// ---------------------------------------------------------------------------

/** Server-derived result of the strike-water calculation. */
export interface StrikeWaterResult {
  volumeLiters: number;
  strikeTempC: number;
  waterToGrainRatioLPerKg: number;
  input: {
    grainKg: number;
    targetMashTempC: number;
    grainTempC: number;
    waterToGrainRatioLPerKg: number;
  };
}

/** `GET /api/strike-water` response shape. */
export interface StrikeWaterResponse {
  data: {
    result: StrikeWaterResult;
    imperial?: {
      volumeGallons: number;
      strikeTempF: number;
    } | null;
    source: "standalone" | "recipe";
    recipe?: {
      id: string;
      title: string;
      grainKg: number;
    } | null;
  };
}

// ---------------------------------------------------------------------------
// Yeast pitch-rate / starter calculator (BRE-33).
// ---------------------------------------------------------------------------

export type PitchRateBeerType = "ale" | "lager";
export type PitchRateYeastForm = "dry" | "liquid";

export interface PitchRateResult {
  recommendedCells: number;
  viableCellsPerPack: number;
  packsNeeded: number;
  starterVolumeLiters: number;
  starterRecommended: boolean;
  viability: number;
  degreesPlato: number;
  input: {
    og: number;
    batchSizeLiters: number;
    beerType: PitchRateBeerType;
    yeastForm: PitchRateYeastForm;
    daysSinceProduction?: number;
    viabilityOverride?: number;
    cellsPerPackOverride?: number;
  };
}

export interface PitchRateResponse {
  data: {
    result: PitchRateResult;
  };
}

// ---------------------------------------------------------------------------
// Quick ABV-from-OG/FG calculator (BRE-35).

export type AbvFormula = "linear" | "highGravity";

export interface MeasuredAbvResult {
  abvPct: number;
  apparentAttenuationPct: number;
  gravityPointsDropped: number;
  formulaUsed: AbvFormula;
  isHighGravity: boolean;
  input: {
    measuredOg: number;
    measuredFg: number;
    formula: AbvFormula;
  };
}

export interface MeasuredAbvResponse {
  data: {
    result: MeasuredAbvResult;
    source: "standalone" | "recipe";
    recipe?: {
      id: string;
      title: string;
      targetOg: number | null;
      targetFg: number | null;
    } | null;
  };
}

// ---------------------------------------------------------------------------
// Inventory / pantry (BRE-40).
// ---------------------------------------------------------------------------

export type InventoryCategory = "fermentables" | "hops" | "yeast" | "additions";
export type InventoryStatus = "full" | "partial" | "missing";

export interface InventoryItemView {
  id: string;
  category: InventoryCategory;
  name: string;
  detail: string;
  unit: string;
  amountOnHand: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryListResponse {
  data: InventoryItemView[];
}

export interface InventoryItemResponse {
  data: InventoryItemView;
}

export interface ShoppingListItemWithInventory extends ShoppingListItem {
  onHand: number;
  stillNeed: number;
  status: InventoryStatus;
  matchedInventoryIds: string[];
}

export interface ShoppingListCrossReference {
  rows: ShoppingListItemWithInventory[];
  counts: {
    total: number;
    full: number;
    partial: number;
    missing: number;
    toBuy: number;
  };
}

export interface ShoppingListResponseWithInventory extends ShoppingListResponse {
  data: ShoppingList & {
    crossReference?: ShoppingListCrossReference;
  };
}

// ---------------------------------------------------------------------------
// Water chemistry calculator (BRE-31).
// ---------------------------------------------------------------------------

export type SaltType =
  | "gypsum"
  | "calciumChloride"
  | "epsomSalt"
  | "canningSalt"
  | "bakingSoda"
  | "chalk";

export interface SaltAdditionInput {
  saltType: SaltType;
  grams: number;
}

export interface WaterProfileResult {
  calcium: number;
  magnesium: number;
  sodium: number;
  sulfate: number;
  chloride: number;
  bicarbonate: number;
}

export interface SaltContributionResult {
  saltType: SaltType;
  grams: number;
  label: string;
  formula: string;
  calcium: number;
  magnesium: number;
  sodium: number;
  sulfate: number;
  chloride: number;
  bicarbonate: number;
}

export interface WaterChemistryResult {
  resultingProfile: WaterProfileResult;
  contributions: SaltContributionResult[];
  alkalinityAsCaCO3: number;
  residualAlkalinity: number;
  estimatedMashPh: number;
  sulfateChlorideRatio: number | null;
}

export interface NamedProfile {
  name: string;
  description: string;
  calcium: number;
  magnesium: number;
  sodium: number;
  sulfate: number;
  chloride: number;
  bicarbonate: number;
}

export interface WaterChemistryResponse {
  data: {
    result: WaterChemistryResult;
    profiles: NamedProfile[];
  };
}
