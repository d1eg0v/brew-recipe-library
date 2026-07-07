// Type-shape views of a BeerXML document as a JS object tree.
//
// We deliberately keep these loose (no enums, all optional strings/numbers)
// because we receive real-world files from BeerSmith/Brewfather/etc. that may
// omit or rename fields. The parser coerces these to the strict `RecipeCreateBody`
// shape; the serializer builds them from a typed Recipe record.

export interface BeerXmlRecipe {
  NAME: string;
  VERSION?: number | string;
  TYPE?: string;
  BREWER?: string;
  BATCH_SIZE?: number;
  BOIL_SIZE?: number;
  BOIL_TIME?: number;
  EFFICIENCY?: number;
  OG?: number;
  FG?: number;
  IBU?: number;
  COLOR?: number; // SRM
  ABV?: number;
  STYLE?: {
    NAME?: string;
    CATEGORY?: string; // e.g. "21A"
    CATEGORY_NUMBER?: string | number;
    STYLE_LETTER?: string;
    STYLE_GUIDE?: string;
  };
  NOTES?: string;
  TASTE_NOTES?: string;
  FERMENTABLES?: { FERMENTABLE: BeerXmlFermentable | BeerXmlFermentable[] };
  HOPS?: { HOP: BeerXmlHop | BeerXmlHop[] };
  YEASTS?: { YEAST: BeerXmlYeast | BeerXmlYeast[] };
  MASH?: { MASH_STEPS?: { MASH_STEP: BeerXmlMashStep | BeerXmlMashStep[] } };
}

export interface BeerXmlFermentable {
  NAME: string;
  TYPE?: string;
  AMOUNT?: number; // kilograms
  YIELD?: number; // percent
  COLOR?: number; // degrees Lovibond
  NOTES?: string;
}

export interface BeerXmlHop {
  NAME: string;
  AMOUNT?: number; // grams
  ALPHA?: number; // %
  TIME?: number; // minutes
  USE?: string;
  FORM?: string;
  NOTES?: string;
}

export interface BeerXmlYeast {
  NAME: string;
  TYPE?: string;
  FORM?: string;
  ATTENUATION?: number;
  MIN_TEMPERATURE?: number;
  MAX_TEMPERATURE?: number;
  LABORATORY?: string;
  PRODUCT_ID?: string;
  NOTES?: string;
}

export interface BeerXmlMashStep {
  NAME: string;
  TYPE?: string;
  STEP_TEMP?: number;
  STEP_TIME?: number;
  INFUSE_AMOUNT?: number;
  NOTES?: string;
}