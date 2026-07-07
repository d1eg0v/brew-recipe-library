// Parse a BeerXML 1.0 document into a `RecipeCreateBody`.
//
// The parser is intentionally tolerant of real-world noise: whitespace,
// namespace declarations, optional fields, and variations in categorical
// strings. It produces a payload that the existing recipe-create schema
// (`recipeCreateSchema`) will accept. Throws `BeerXmlParseError` on
// structural failures with a human-readable message.

import { XMLParser } from "fast-xml-parser";

import {
  mapFermentableType,
  mapHopForm,
  mapHopUse,
  mapMashStepType,
  mapYeastForm,
  mapYeastType,
  recipeTypeToCategory,
} from "./mappings";
import type { RecipeCreateBody } from "@/lib/api/schemas";
import type {
  BeerXmlRecipe,
  BeerXmlFermentable,
  BeerXmlHop,
  BeerXmlYeast,
  BeerXmlMashStep,
} from "./types";

const PARSER_OPTIONS = {
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: true,
  parseAttributeValue: false,
  trimValues: true,
  allowBooleanAttributes: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
  processEntities: true,
  textNodeName: "#text",
  isArray: (name: string, jpath: unknown) => {
    // Lists in BeerXML: a single element or a list of elements — treat every
    // member position as an array so we always get an array downstream.
    const path = typeof jpath === "string" ? jpath : "";
    if (path.endsWith("RECIPE")) return true;
    if (path.endsWith("FERMENTABLE")) return true;
    if (path.endsWith("HOP")) return true;
    if (path.endsWith("YEAST")) return true;
    if (path.endsWith("MASH_STEP")) return true;
    return false;
  },
};

const parser = new XMLParser(PARSER_OPTIONS);

export class BeerXmlParseError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "BeerXmlParseError";
    this.cause = cause;
  }
}

/** Parse a BeerXML string into our internal recipe create payload. */
export function parseBeerXml(input: string): RecipeCreateBody {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new BeerXmlParseError("BeerXML input is empty");
  }

  let parsed: unknown;
  try {
    parsed = parser.parse(input);
  } catch (err) {
    throw new BeerXmlParseError("Failed to parse BeerXML document", err);
  }

  const recipe = extractRecipe(parsed);
  if (!recipe) {
    throw new BeerXmlParseError(
      "BeerXML document is missing a <RECIPE> element",
    );
  }
  if (!recipe.NAME || typeof recipe.NAME !== "string") {
    throw new BeerXmlParseError(
      "BeerXML <RECIPE> is missing the required <NAME> element",
    );
  }

  return buildRecipeBody(recipe);
}

function extractRecipe(parsed: unknown): BeerXmlRecipe | null {
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;
  const recipesBlock = root.RECIPES ?? root.recipes;
  if (!recipesBlock || typeof recipesBlock !== "object") return null;
  const inner = recipesBlock as Record<string, unknown>;
  const list = inner.RECIPE ?? inner.recipe;
  if (!list) return null;
  const arr = Array.isArray(list) ? list : [list];
  const first = arr[0];
  if (!first || typeof first !== "object") return null;
  return first as BeerXmlRecipe;
}

function asNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : undefined;
}

function asString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  return String(value);
}

function childList<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function ppgFromYield(yieldPct: number): number {
  // Same conversion the serializer uses, in reverse.
  if (!Number.isFinite(yieldPct) || yieldPct <= 0) return 0;
  return roundTo((yieldPct / 100) * 46, 2);
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function buildFermentables(
  list: { FERMENTABLE: BeerXmlFermentable | BeerXmlFermentable[] } | undefined,
) {
  const items = childList(list?.FERMENTABLE);
  return items
    .filter((f) => f && typeof f === "object" && typeof f.NAME === "string")
    .map((f, idx) => {
      const amount = asNumber(f.AMOUNT);
      const yieldPct = asNumber(f.YIELD);
      const color = asNumber(f.COLOR);
      const ppg = yieldPct != null ? ppgFromYield(yieldPct) : undefined;
      const out: Record<string, unknown> = {
        name: f.NAME,
        type: mapFermentableType(asString(f.TYPE)),
        position: idx,
      };
      if (amount != null && amount > 0) out.amountKg = roundTo(amount, 4);
      if (color != null && color >= 0) out.colorLovibond = color;
      if (ppg != null && ppg > 0) out.potentialPpg = ppg;
      const notes = asString(f.NOTES);
      if (notes) out.notes = notes;
      return out;
    });
}

function buildHops(
  list: { HOP: BeerXmlHop | BeerXmlHop[] } | undefined,
) {
  const items = childList(list?.HOP);
  return items
    .filter((h) => h && typeof h === "object" && typeof h.NAME === "string")
    .map((h, idx) => {
      const amount = asNumber(h.AMOUNT) ?? 0;
      const time = asNumber(h.TIME) ?? 0;
      const alpha = asNumber(h.ALPHA);
      const use = mapHopUse(asString(h.USE));
      const form = mapHopForm(asString(h.FORM));
      const out: Record<string, unknown> = {
        name: h.NAME,
        amountGrams: roundTo(Math.max(amount, 0), 4),
        timeMinutes: clamp(time, 0, 1e6),
        position: idx,
      };
      if (alpha != null && alpha >= 0) out.alphaAcidPct = alpha;
      if (use) out.use = use;
      if (form) out.form = form;
      const notes = asString(h.NOTES);
      if (notes) out.notes = notes;
      return out;
    });
}

function buildYeasts(
  list: { YEAST: BeerXmlYeast | BeerXmlYeast[] } | undefined,
) {
  const items = childList(list?.YEAST);
  return items
    .filter((y) => y && typeof y === "object" && typeof y.NAME === "string")
    .map((y, idx) => {
      const att = asNumber(y.ATTENUATION);
      const minT = asNumber(y.MIN_TEMPERATURE);
      const maxT = asNumber(y.MAX_TEMPERATURE);
      const type = mapYeastType(asString(y.TYPE));
      const form = mapYeastForm(asString(y.FORM));
      const lab = asString(y.LABORATORY);
      const pid = asString(y.PRODUCT_ID);
      const notes = asString(y.NOTES);
      const out: Record<string, unknown> = {
        name: y.NAME,
        position: idx,
      };
      if (type) out.type = type;
      if (form) out.form = form;
      if (att != null && att > 0) out.attenuationPct = att;
      if (minT != null) out.temperatureCMin = minT;
      if (maxT != null) out.temperatureCMax = maxT;
      if (lab) out.laboratory = lab;
      if (pid) out.productId = pid;
      if (notes) out.notes = notes;
      return out;
    });
}

function buildMashSteps(
  block:
    | {
        MASH_STEPS?: {
          MASH_STEP: BeerXmlMashStep | BeerXmlMashStep[];
        };
      }
    | undefined,
) {
  const items = childList(block?.MASH_STEPS?.MASH_STEP);
  return items
    .filter((m) => m && typeof m === "object" && typeof m.NAME === "string")
    .map((m, idx) => {
      const temp = asNumber(m.STEP_TEMP) ?? 0;
      const time = asNumber(m.STEP_TIME) ?? 0;
      const infuse = asNumber(m.INFUSE_AMOUNT);
      const type = mapMashStepType(asString(m.TYPE));
      const notes = asString(m.NOTES);
      const out: Record<string, unknown> = {
        name: m.NAME,
        stepTempC: temp,
        stepTimeMinutes: clamp(time, 0, 1e6),
        position: idx,
      };
      if (type) out.type = type;
      if (infuse != null && infuse > 0) out.infuseAmountLiters = roundTo(infuse, 4);
      if (notes) out.notes = notes;
      return out;
    });
}

function buildRecipeBody(recipe: BeerXmlRecipe): RecipeCreateBody {
  const batchSize = asNumber(recipe.BATCH_SIZE);
  if (batchSize == null || batchSize <= 0) {
    throw new BeerXmlParseError(
      "BeerXML <BATCH_SIZE> must be a positive number",
    );
  }

  const efficiency = asNumber(recipe.EFFICIENCY);
  const boilTime = asNumber(recipe.BOIL_TIME);
  const og = asNumber(recipe.OG);
  const fg = asNumber(recipe.FG);
  const abv = asNumber(recipe.ABV);
  const ibu = asNumber(recipe.IBU);
  const srm = asNumber(recipe.COLOR);

  const style = recipe.STYLE ?? {};
  const styleName = asString(style.NAME);
  const bjcpCategory = asString(style.CATEGORY);

  const notes = asString(recipe.NOTES) ?? "";
  const tasteNotes = asString(recipe.TASTE_NOTES) ?? "";

  const out: Record<string, unknown> = {
    title: recipe.NAME,
    batchSizeLiters: roundTo(batchSize, 3),
    category: recipeTypeToCategory(asString(recipe.TYPE)),
    fermentables: buildFermentables(recipe.FERMENTABLES),
    hops: buildHops(recipe.HOPS),
    yeasts: buildYeasts(recipe.YEASTS),
    mashSteps: buildMashSteps(recipe.MASH),
    processSteps: [],
    additions: [],
  };

  const brewer = asString(recipe.BREWER);
  if (brewer) out.author = brewer;
  if (styleName) out.styleName = styleName;
  if (bjcpCategory) out.bjcpCategory = bjcpCategory;
  if (boilTime != null && boilTime >= 0) out.boilTimeMinutes = Math.round(boilTime);
  if (efficiency != null && efficiency > 0 && efficiency <= 100) {
    out.efficiencyPct = efficiency;
  }
  if (og != null && og >= 0.95 && og <= 1.2) out.targetOg = roundTo(og, 3);
  if (fg != null && fg >= 0.95 && fg <= 1.2) out.targetFg = roundTo(fg, 3);
  if (abv != null && abv >= 0 && abv <= 25) out.targetAbv = roundTo(abv, 2);
  if (ibu != null && ibu >= 0 && ibu <= 200) out.targetIbu = roundTo(ibu, 1);
  if (srm != null && srm >= 0 && srm <= 80) out.targetSrm = roundTo(srm, 2);

  const combinedNotes = notes && tasteNotes
    ? `${notes}\n\n${tasteNotes}`
    : notes || tasteNotes;
  if (combinedNotes) out.notes = combinedNotes;

  return out as unknown as RecipeCreateBody;
}