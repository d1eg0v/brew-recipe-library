// Type-shape views of a BeerXML document as a JS object tree.
//
// We deliberately keep these loose (no enums, all optional strings/numbers)
// because we receive real-world files from BeerSmith/Brewfather/etc. that may
// omit or rename fields. The parser coerces these to the strict `RecipeCreateBody`
// shape; the serializer builds them from a typed Recipe record.
//
// Numeric fields are typed `number | string` because the parser runs with
// `parseTagValue: false` — element text is never coerced, so these arrive as
// strings and are converted by `asNumber`. Declaring them `number` alone would
// describe a shape the parser never actually produces.

export interface BeerXmlRecipe {
  NAME: string;
  VERSION?: number | string;
  TYPE?: string;
  BREWER?: string;
  BATCH_SIZE?: number | string;
  BOIL_SIZE?: number | string;
  BOIL_TIME?: number | string;
  EFFICIENCY?: number | string;
  OG?: number | string;
  FG?: number | string;
  IBU?: number | string;
  COLOR?: number | string; // SRM
  ABV?: number | string;
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
  AMOUNT?: number | string; // kilograms
  YIELD?: number | string; // percent
  COLOR?: number | string; // degrees Lovibond
  NOTES?: string;
}

export interface BeerXmlHop {
  NAME: string;
  AMOUNT?: number | string; // grams
  ALPHA?: number | string; // %
  TIME?: number | string; // minutes
  USE?: string;
  FORM?: string;
  NOTES?: string;
}

export interface BeerXmlYeast {
  NAME: string;
  TYPE?: string;
  FORM?: string;
  ATTENUATION?: number | string;
  MIN_TEMPERATURE?: number | string;
  MAX_TEMPERATURE?: number | string;
  LABORATORY?: string;
  PRODUCT_ID?: string;
  NOTES?: string;
}

export interface BeerXmlMashStep {
  NAME: string;
  TYPE?: string;
  STEP_TEMP?: number | string;
  STEP_TIME?: number | string;
  INFUSE_AMOUNT?: number | string;
  NOTES?: string;
}