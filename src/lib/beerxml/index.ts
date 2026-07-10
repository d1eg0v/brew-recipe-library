// Public entry point for the BeerXML import/export module.
//
// Two pure helpers:
//   - `serializeBeerXml(recipe)` — Recipe (or anything with the same shape) →
//     a BeerXML 1.0 string.
//   - `parseBeerXml(xml)` — BeerXML string → `RecipeCreateBody` (or throws a
//     descriptive error).
//
// Both functions convert metric-internal quantities only at the boundary; the
// rest of the app keeps its canonical units.

export * from "./mappings";
export { serializeBeerXml } from "./serializer";
export { parseBeerXml, BeerXmlParseError } from "./parser";
export type {
  BeerXmlRecipe,
  BeerXmlFermentable,
  BeerXmlHop,
  BeerXmlYeast,
  BeerXmlMashStep,
} from "./types";