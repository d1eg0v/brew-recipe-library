// Mappings between BeerXML's categorical strings and our internal enums.
//
// BeerXML 1.0 (http://www.beerxml.com/) defines specific values for fields
// like hop <USE>, fermentable <TYPE>, yeast <TYPE>/<FORM>, and mash step <TYPE>.
// Our model uses lowercase camelCase tokens (see src/lib/api/schemas.ts). These
// maps translate both directions and tolerate the case/punctuation variations
// other tools produce.

import {
  FERMENTABLE_TYPES,
  HOP_FORMS,
  HOP_USES,
  MASH_STEP_TYPES,
  YEAST_FORMS,
  YEAST_TYPES,
} from "@/lib/api/schemas";

type Set = readonly string[];

function normalise(value: string | null | undefined): string {
  if (!value) return "";
  return value.toLowerCase().replace(/[\s_\-]+/g, "");
}

/**
 * Translate a BeerXML hop USE value to one of our `HOP_USES`. Unknown values
 * fall back to "" (let the API validator apply its own "or empty" rule).
 */
export function mapHopUse(input: string | null | undefined): string {
  const n = normalise(input);
  switch (n) {
    case "boil":
    case "aroma": // BeerSmith labels late "aroma" boils as Boil; map there
      return "boil";
    case "firstwort":
    case "firstworting":
      return "firstWort";
    case "whirlpool":
      return "whirlpool";
    case "dryhop":
    case "dry":
      return "dryHop";
    case "mash":
      return "mash";
    default:
      return "";
  }
}

/** Inverse of `mapHopUse` — internal hop use → BeerXML string. */
export function hopUseToBeerXml(internal: string | null | undefined): string {
  if (!internal) return "";
  const allowed: Set = HOP_USES;
  if ((allowed as readonly string[]).includes(internal)) {
    switch (internal) {
      case "boil":
        return "Boil";
      case "firstWort":
        return "First Wort";
      case "whirlpool":
        return "Whirlpool";
      case "dryHop":
        return "Dry Hop";
      case "mash":
        return "Mash";
    }
  }
  return "";
}

/** Translate a BeerXML hop FORM value to one of our `HOP_FORMS`. */
export function mapHopForm(input: string | null | undefined): string {
  const n = normalise(input);
  switch (n) {
    case "pellet":
      return "pellet";
    case "leaf":
    case "whole":
      return "leaf";
    case "plug":
      return "plug";
    case "extract":
      return "extract";
    default:
      return "";
  }
}

/** Inverse of `mapHopForm`. */
export function hopFormToBeerXml(internal: string | null | undefined): string {
  if (!internal) return "";
  const allowed: Set = HOP_FORMS;
  if ((allowed as readonly string[]).includes(internal)) {
    switch (internal) {
      case "pellet":
        return "Pellet";
      case "leaf":
        return "Leaf";
      case "plug":
        return "Plug";
      case "extract":
        return "Extract";
    }
  }
  return "";
}

/** Translate a BeerXML fermentable TYPE to one of our `FERMENTABLE_TYPES`. */
export function mapFermentableType(input: string | null | undefined): string {
  const n = normalise(input);
  switch (n) {
    case "grain":
    case "malts":
      return "grain";
    case "extract":
    case "liquidextract":
      return "extract";
    case "dryextract":
      return "extract";
    case "sugar":
      return "sugar";
    case "adjunct":
      return "adjunct";
    case "honey":
      return "honey";
    case "juice":
      return "juice";
    case "concentrate":
    case "concentratedjuice":
      return "concentrate";
    case "fruit":
      return "fruit";
    case "must":
    case "grape":
      return "must";
    default:
      // "Other" and unmapped values land as grain, since grain is the closest
      // generic type that the validator always accepts.
      return "grain";
  }
}

/** Inverse of `mapFermentableType`. */
export function fermentableTypeToBeerXml(
  internal: string | null | undefined,
): string {
  if (!internal) return "Grain";
  const allowed: Set = FERMENTABLE_TYPES;
  if (!(allowed as readonly string[]).includes(internal)) return "Grain";
  switch (internal) {
    case "grain":
      return "Grain";
    case "extract":
      return "Extract";
    case "sugar":
      return "Sugar";
    case "adjunct":
      return "Adjunct";
    case "honey":
      return "Honey";
    case "juice":
      return "Juice";
    case "concentrate":
      return "Concentrate";
    case "fruit":
      return "Fruit";
    case "must":
      return "Must";
    default:
      return "Grain";
  }
}

/** Translate a BeerXML yeast FORM value to one of our `YEAST_FORMS`. */
export function mapYeastForm(input: string | null | undefined): string {
  const n = normalise(input);
  switch (n) {
    case "dry":
    case "powder":
      return "dry";
    case "liquid":
    case "wet":
      return "liquid";
    case "slant":
      return "slant";
    case "culture":
      return "culture";
    default:
      return "";
  }
}

/** Inverse of `mapYeastForm`. */
export function yeastFormToBeerXml(internal: string | null | undefined): string {
  if (!internal) return "";
  const allowed: Set = YEAST_FORMS;
  if ((allowed as readonly string[]).includes(internal)) {
    switch (internal) {
      case "dry":
        return "Dry";
      case "liquid":
        return "Liquid";
      case "slant":
        return "Slant";
      case "culture":
        return "Culture";
    }
  }
  return "";
}

/** Translate a BeerXML yeast TYPE to one of our `YEAST_TYPES`. */
export function mapYeastType(input: string | null | undefined): string {
  const n = normalise(input);
  switch (n) {
    case "ale":
      return "ale";
    case "lager":
      return "lager";
    case "wheat":
      return "wheat";
    case "wine":
      return "wine";
    case "champagne":
      return "champagne";
    case "other":
      return "other";
    default:
      return "";
  }
}

/** Inverse of `mapYeastType`. */
export function yeastTypeToBeerXml(internal: string | null | undefined): string {
  if (!internal) return "";
  const allowed: Set = YEAST_TYPES;
  if ((allowed as readonly string[]).includes(internal)) {
    switch (internal) {
      case "ale":
        return "Ale";
      case "lager":
        return "Lager";
      case "wheat":
        return "Wheat";
      case "wine":
        return "Wine";
      case "champagne":
        return "Champagne";
      case "other":
        return "Other";
    }
  }
  return "";
}

/** Translate a BeerXML mash step TYPE to one of our `MASH_STEP_TYPES`. */
export function mapMashStepType(input: string | null | undefined): string {
  const n = normalise(input);
  switch (n) {
    case "infusion":
      return "infusion";
    case "temperature":
    case "temperatured":
    case "rest":
      return "temperature";
    case "decoction":
      return "decoction";
    default:
      return "";
  }
}

/** Inverse of `mapMashStepType`. */
export function mashStepTypeToBeerXml(
  internal: string | null | undefined,
): string {
  if (!internal) return "";
  const allowed: Set = MASH_STEP_TYPES;
  if ((allowed as readonly string[]).includes(internal)) {
    switch (internal) {
      case "infusion":
        return "Infusion";
      case "temperature":
        return "Temperature";
      case "decoction":
        return "Decoction";
    }
  }
  return "";
}

/**
 * BeerXML recipes carry an outer recipe TYPE ("All Grain", "Extract", etc.).
 * Our internal model only cares about the broad category (beer/mead/wine/…).
 * BeerXML itself is beer-centric; non-beer recipes are mapped to "other".
 */
export function recipeTypeToCategory(input: string | null | undefined): string {
  if (!input) return "beer";
  const n = normalise(input);
  // Anything that looks like a brewing process is beer in our model.
  switch (n) {
    case "allgrain":
    case "extract":
    case "partialmash":
    case "miniextract":
    case "beers":
      return "beer";
    case "mead":
      return "mead";
    case "wine":
      return "wine";
    case "cider":
      return "cider";
    default:
      return "beer";
  }
}