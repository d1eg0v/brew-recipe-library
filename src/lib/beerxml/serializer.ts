// Serialize a recipe (in its DB / API shape) to a BeerXML 1.0 document string.
//
// We emit a single recipe wrapped in <RECIPES>. That's the common case for
// most homebrew software (BeerSmith, Brewfather) and what round-trip tests
// expect.

import {
  fermentableTypeToBeerXml,
  hopFormToBeerXml,
  hopUseToBeerXml,
  mashStepTypeToBeerXml,
  yeastFormToBeerXml,
  yeastTypeToBeerXml,
} from "./mappings";

/**
 * Loose view of a recipe that we can serialize. Anything that satisfies the
 * field list below will serialize; we accept extra fields silently because
 * the API response carries additional imperial-mirror fields we want to skip.
 */
export interface BeerXmlSerializableRecipe {
  title: string;
  author?: string | null;
  description?: string | null;
  notes?: string | null;
  category: string;
  styleName?: string | null;
  bjcpCategory?: string | null;
  batchSizeLiters: number;
  boilTimeMinutes: number;
  efficiencyPct: number;
  targetOg?: number | null;
  targetFg?: number | null;
  targetAbv?: number | null;
  targetIbu?: number | null;
  targetSrm?: number | null;
  fermentables: BeerXmlSerializableFermentable[];
  hops: BeerXmlSerializableHop[];
  yeasts: BeerXmlSerializableYeast[];
  mashSteps: BeerXmlSerializableMashStep[];
}

export interface BeerXmlSerializableFermentable {
  name: string;
  type?: string | null;
  amountKg?: number | null;
  colorLovibond?: number | null;
  potentialPpg?: number | null;
  notes?: string | null;
}

export interface BeerXmlSerializableHop {
  name: string;
  amountGrams: number;
  alphaAcidPct?: number | null;
  timeMinutes: number;
  use?: string | null;
  form?: string | null;
  notes?: string | null;
}

export interface BeerXmlSerializableYeast {
  name: string;
  laboratory?: string | null;
  productId?: string | null;
  type?: string | null;
  form?: string | null;
  attenuationPct?: number | null;
  temperatureCMin?: number | null;
  temperatureCMax?: number | null;
  notes?: string | null;
}

export interface BeerXmlSerializableMashStep {
  name: string;
  type?: string | null;
  stepTempC: number;
  stepTimeMinutes?: number | null;
  infuseAmountLiters?: number | null;
  notes?: string | null;
}

/** Header line — emitted as-is. */
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>';

/**
 * Convert an internal PPG value to a BeerXML YIELD percent. The conventional
 * mapping assumes 100% yield = 46 PPG (the theoretical maximum for sucrose
 * solutions); this keeps round-trip lossless for our own exports.
 */
function ppgToYield(ppg: number): number {
  return roundTo((ppg / 46) * 100, 2);
}

/** Inverse of `ppgToYield`. Clamps to a sensible minimum so non-mappable
 *  values (e.g. legacy "100" ppg strings) still come back numerically. */
export function yieldToPpg(yieldPct: number): number {
  if (!Number.isFinite(yieldPct) || yieldPct <= 0) return 0;
  return roundTo((yieldPct / 100) * 46, 2);
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  // Trim trailing zeros so 1.500 becomes 1.5 etc.
  return Number(roundTo(value, 4)).toString();
}

/** Render a value into an XML-safe text node. */
function escapeText(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Render a simple element. Empty values become self-closing tags. */
function el(tag: string, value: string | number | null | undefined): string {
  if (value == null || value === "") {
    return `<${tag}/>`;
  }
  const text = typeof value === "number" ? formatNumber(value) : escapeText(value);
  return `<${tag}>${text}</${tag}>`;
}

function buildStyle(r: BeerXmlSerializableRecipe): string[] {
  const lines: string[] = ["<STYLE>"];
  lines.push(el("NAME", r.styleName ?? ""));
  if (r.bjcpCategory) {
    // BeerXML split a BJCP code into CATEGORY_NUMBER + STYLE_LETTER (e.g. "21A"
    // → CATEGORY_NUMBER="21", STYLE_LETTER="A"). We only store the combined
    // code, so split on the trailing letter group when we can.
    const match = /^(\d+)([A-Za-z]*)$/.exec(r.bjcpCategory.trim());
    if (match) {
      lines.push(el("CATEGORY_NUMBER", match[1]));
      lines.push(el("STYLE_LETTER", match[2]));
      lines.push(el("CATEGORY", r.bjcpCategory));
    } else {
      lines.push(el("CATEGORY", r.bjcpCategory));
    }
  }
  lines.push("</STYLE>");
  return lines;
}

function buildFermentables(items: BeerXmlSerializableFermentable[]): string[] {
  if (items.length === 0) return ["<FERMENTABLES/>"];
  const lines: string[] = ["<FERMENTABLES>"];
  items.forEach((f, i) => {
    lines.push(`<FERMENTABLE>`);
    lines.push(el("NAME", f.name));
    lines.push(el("TYPE", fermentableTypeToBeerXml(f.type)));
    lines.push(el("AMOUNT", f.amountKg ?? 0));
    if (f.potentialPpg != null && f.potentialPpg > 0) {
      lines.push(el("YIELD", ppgToYield(f.potentialPpg)));
    }
    if (f.colorLovibond != null) {
      lines.push(el("COLOR", f.colorLovibond));
    }
    lines.push(el("NOTES", f.notes ?? ""));
    lines.push(`</FERMENTABLE>`);
    void i;
  });
  lines.push("</FERMENTABLES>");
  return lines;
}

function buildHops(items: BeerXmlSerializableHop[]): string[] {
  if (items.length === 0) return ["<HOPS/>"];
  const lines: string[] = ["<HOPS>"];
  items.forEach((h) => {
    lines.push(`<HOP>`);
    lines.push(el("NAME", h.name));
    lines.push(el("AMOUNT", h.amountGrams));
    if (h.alphaAcidPct != null) lines.push(el("ALPHA", h.alphaAcidPct));
    lines.push(el("TIME", h.timeMinutes));
    lines.push(el("USE", hopUseToBeerXml(h.use)));
    lines.push(el("FORM", hopFormToBeerXml(h.form)));
    lines.push(el("NOTES", h.notes ?? ""));
    lines.push(`</HOP>`);
  });
  lines.push("</HOPS>");
  return lines;
}

function buildYeasts(items: BeerXmlSerializableYeast[]): string[] {
  if (items.length === 0) return ["<YEASTS/>"];
  const lines: string[] = ["<YEASTS>"];
  items.forEach((y) => {
    lines.push(`<YEAST>`);
    lines.push(el("NAME", y.name));
    lines.push(el("TYPE", yeastTypeToBeerXml(y.type)));
    lines.push(el("FORM", yeastFormToBeerXml(y.form)));
    if (y.attenuationPct != null) lines.push(el("ATTENUATION", y.attenuationPct));
    if (y.temperatureCMin != null) lines.push(el("MIN_TEMPERATURE", y.temperatureCMin));
    if (y.temperatureCMax != null) lines.push(el("MAX_TEMPERATURE", y.temperatureCMax));
    lines.push(el("LABORATORY", y.laboratory ?? ""));
    lines.push(el("PRODUCT_ID", y.productId ?? ""));
    lines.push(el("NOTES", y.notes ?? ""));
    lines.push(`</YEAST>`);
  });
  lines.push("</YEASTS>");
  return lines;
}

function buildMash(steps: BeerXmlSerializableMashStep[]): string[] {
  if (steps.length === 0) return ["<MASH/>"];
  const lines: string[] = ["<MASH>"];
  lines.push("<MASH_STEPS>");
  steps.forEach((s) => {
    lines.push(`<MASH_STEP>`);
    lines.push(el("NAME", s.name));
    lines.push(el("TYPE", mashStepTypeToBeerXml(s.type)));
    lines.push(el("STEP_TEMP", s.stepTempC));
    lines.push(el("STEP_TIME", s.stepTimeMinutes ?? 0));
    if (s.infuseAmountLiters != null) {
      lines.push(el("INFUSE_AMOUNT", s.infuseAmountLiters));
    }
    lines.push(el("NOTES", s.notes ?? ""));
    lines.push(`</MASH_STEP>`);
  });
  lines.push("</MASH_STEPS>");
  lines.push("</MASH>");
  return lines;
}

/**
 * Serialise a single recipe into a BeerXML document. Returns a UTF-8 XML
 * string with an `<?xml?>` declaration and the recipe wrapped in
 * `<RECIPES>` (the standard root for interchange files).
 */
export function serializeBeerXml(
  recipe: BeerXmlSerializableRecipe,
  options: { singleLine?: boolean } = {},
): string {
  const singleLine = options.singleLine ?? false;
  const nl = singleLine ? "" : "\n";
  const indent = singleLine ? "" : "  ";
  const indent2 = singleLine ? "" : "    ";
  const lines: string[] = [XML_DECL, "<RECIPES>", `${indent}<RECIPE>`];
  lines.push(`${indent2}${el("NAME", recipe.title)}`);
  lines.push(`${indent2}${el("VERSION", 1)}`);
  // Map our category onto the closest BeerXML TYPE.
  const type = recipe.category === "beer" ? "All Grain" : recipe.category;
  lines.push(`${indent2}${el("TYPE", type)}`);
  lines.push(`${indent2}${el("BREWER", recipe.author ?? "")}`);
  lines.push(`${indent2}${el("BATCH_SIZE", recipe.batchSizeLiters)}`);
  lines.push(`${indent2}${el("BOIL_TIME", recipe.boilTimeMinutes)}`);
  lines.push(`${indent2}${el("EFFICIENCY", recipe.efficiencyPct)}`);
  for (const block of buildStyle(recipe)) {
    lines.push(`${indent2}${block}`);
  }
  if (recipe.targetOg != null) lines.push(`${indent2}${el("OG", recipe.targetOg)}`);
  if (recipe.targetFg != null) lines.push(`${indent2}${el("FG", recipe.targetFg)}`);
  if (recipe.targetIbu != null) lines.push(`${indent2}${el("IBU", recipe.targetIbu)}`);
  if (recipe.targetSrm != null) lines.push(`${indent2}${el("COLOR", recipe.targetSrm)}`);
  if (recipe.targetAbv != null) lines.push(`${indent2}${el("ABV", recipe.targetAbv)}`);
  lines.push(`${indent2}${el("NOTES", recipe.description ?? "")}`);
  lines.push(`${indent2}${el("TASTE_NOTES", recipe.notes ?? "")}`);
  for (const block of buildFermentables(recipe.fermentables)) {
    lines.push(`${indent2}${block}`);
  }
  for (const block of buildHops(recipe.hops)) {
    lines.push(`${indent2}${block}`);
  }
  for (const block of buildYeasts(recipe.yeasts)) {
    lines.push(`${indent2}${block}`);
  }
  for (const block of buildMash(recipe.mashSteps)) {
    lines.push(`${indent2}${block}`);
  }
  lines.push(`${indent}</RECIPE>`, "</RECIPES>");
  return lines.join(nl) + nl;
}