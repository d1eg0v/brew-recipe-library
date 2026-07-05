// Shared input/output shapes for the brewing calculation functions.
//
// These intentionally use plain, structural interfaces (not the generated
// Prisma model types) so the calculation layer stays pure and independently
// testable. The field names and units mirror the Prisma schema: masses in kg
// (fermentables) / grams (hops), volumes in litres, temperatures in Celsius.
// Gravity is expressed as specific gravity (e.g. 1.056).

/** A single grain-bill / extract / sugar entry, as needed for gravity+colour math. */
export interface FermentableInput {
  /** grain | extract | sugar | adjunct — determines whether efficiency applies. */
  type?: string;
  /** Mass in kilograms. */
  amountKg: number;
  /** Gravity potential in points-per-pound-per-gallon. Defaults applied by type when omitted. */
  potentialPpg?: number | null;
  /** Malt colour in degrees Lovibond. */
  colorLovibond?: number | null;
}

/** A single hop addition, as needed for IBU math. */
export interface HopInput {
  /** Mass in grams. */
  amountGrams: number;
  /** Alpha-acid content as a percentage (e.g. 12 for 12%). */
  alphaAcidPct?: number | null;
  /** Contact time in minutes (boil minutes; ignored for dry hops). */
  timeMinutes: number;
  /** boil | firstWort | whirlpool | dryHop | mash — only boil/firstWort add bitterness here. */
  use?: string;
}

/** Minimal yeast info needed to estimate final gravity. */
export interface YeastInput {
  /** Apparent attenuation as a percentage (e.g. 75 for 75%). */
  attenuationPct?: number | null;
}

/** Everything needed to compute the full target set for a recipe. */
export interface RecipeCalcInput {
  batchSizeLiters: number;
  efficiencyPct?: number;
  fermentables: FermentableInput[];
  hops: HopInput[];
  yeasts?: YeastInput[];
}

/** Computed target measurements for a recipe. */
export interface RecipeTargets {
  og: number;
  fg: number;
  abv: number;
  ibu: number;
  srm: number;
}
