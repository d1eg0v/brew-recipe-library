// Client-side validation for the recipe form.
//
// Reuses the server-side Zod schemas as the single source of truth so the
// client never diverges from what the API will accept. Converts the form
// state into the body shape, runs `safeParse`, and maps Zod issues back to
// human-readable field-level errors.

import {
  recipeCreateSchema,
  type RecipeCreateBody,
} from "@/lib/api/schemas";
import type {
  AdditionRowState,
  FermentableRowState,
  HopRowState,
  MashStepRowState,
  ProcessStepRowState,
  RecipeFormState,
  YeastRowState,
} from "./recipeFormState";

/** Map of dotted-path -> first error message. */
export type FormErrors = Record<string, string>;

const MAX_TITLE = 200;
const MAX_OPTIONAL_TEXT_SHORT = 200;
const MAX_OPTIONAL_TEXT_MEDIUM = 500;
const MAX_OPTIONAL_TEXT_DESCRIPTION = 5000;
const MAX_OPTIONAL_TEXT_NOTES = 10_000;
const MAX_OPTIONAL_TEXT_UNIT = 50;
const MAX_BJCP = 20;
const NUMBER_DECIMALS = 4;

function trimOrUndefined(v: string): string | undefined {
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function numberOrUndefined(v: number | null | undefined): number | undefined {
  return v == null ? undefined : v;
}

function roundNumber(n: number): number {
  return Math.round(n * Math.pow(10, NUMBER_DECIMALS)) /
    Math.pow(10, NUMBER_DECIMALS);
}

function numberOrUndefinedRounded(v: number | null | undefined): number | undefined {
  const n = numberOrUndefined(v);
  return n == null ? undefined : roundNumber(n);
}

function fermentableToBody(r: FermentableRowState) {
  const out: Record<string, unknown> = {};
  if (r.name.trim()) out.name = r.name.trim();
  if (r.type) out.type = r.type;
  const kg = numberOrUndefined(r.amountKg);
  if (kg != null) out.amountKg = roundNumber(kg);
  if (r.amountLiters != null) out.amountLiters = roundNumber(r.amountLiters);
  if (r.colorLovibond != null) {
    out.colorLovibond = roundNumber(r.colorLovibond);
  }
  if (r.potentialPpg != null) {
    out.potentialPpg = roundNumber(r.potentialPpg);
  }
  const notes = trimOrUndefined(r.notes);
  if (notes != null) out.notes = notes;
  return out;
}

function hopToBody(r: HopRowState) {
  const out: Record<string, unknown> = {};
  if (r.name.trim()) out.name = r.name.trim();
  if (r.amountGrams != null) out.amountGrams = roundNumber(r.amountGrams);
  if (r.alphaAcidPct != null) out.alphaAcidPct = roundNumber(r.alphaAcidPct);
  if (r.timeMinutes != null) out.timeMinutes = r.timeMinutes;
  if (r.use) out.use = r.use;
  if (r.form) out.form = r.form;
  const notes = trimOrUndefined(r.notes);
  if (notes != null) out.notes = notes;
  return out;
}

function yeastToBody(r: YeastRowState) {
  const out: Record<string, unknown> = {};
  if (r.name.trim()) out.name = r.name.trim();
  const lab = trimOrUndefined(r.laboratory);
  if (lab != null) out.laboratory = lab;
  const pid = trimOrUndefined(r.productId);
  if (pid != null) out.productId = pid;
  if (r.type) out.type = r.type;
  if (r.form) out.form = r.form;
  if (r.attenuationPct != null) {
    out.attenuationPct = roundNumber(r.attenuationPct);
  }
  if (r.abvTolerancePct != null) {
    out.abvTolerancePct = roundNumber(r.abvTolerancePct);
  }
  if (r.temperatureCMin != null) {
    out.temperatureCMin = roundNumber(r.temperatureCMin);
  }
  if (r.temperatureCMax != null) {
    out.temperatureCMax = roundNumber(r.temperatureCMax);
  }
  const notes = trimOrUndefined(r.notes);
  if (notes != null) out.notes = notes;
  return out;
}

function mashStepToBody(r: MashStepRowState) {
  const out: Record<string, unknown> = {};
  if (r.name.trim()) out.name = r.name.trim();
  if (r.type) out.type = r.type;
  if (r.stepTempC != null) out.stepTempC = roundNumber(r.stepTempC);
  if (r.stepTimeMinutes != null) out.stepTimeMinutes = r.stepTimeMinutes;
  if (r.infuseAmountLiters != null) {
    out.infuseAmountLiters = roundNumber(r.infuseAmountLiters);
  }
  const notes = trimOrUndefined(r.notes);
  if (notes != null) out.notes = notes;
  return out;
}

function processStepToBody(r: ProcessStepRowState) {
  const out: Record<string, unknown> = {};
  if (r.name.trim()) out.name = r.name.trim();
  if (r.type) out.type = r.type;
  if (r.tempC != null) out.tempC = roundNumber(r.tempC);
  if (r.durationDays != null) {
    out.durationDays = roundNumber(r.durationDays);
  }
  const notes = trimOrUndefined(r.notes);
  if (notes != null) out.notes = notes;
  return out;
}

function additionToBody(r: AdditionRowState) {
  const out: Record<string, unknown> = {};
  if (r.name.trim()) out.name = r.name.trim();
  if (r.amount != null) out.amount = roundNumber(r.amount);
  const unit = trimOrUndefined(r.unit);
  if (unit != null) out.unit = unit;
  const purpose = trimOrUndefined(r.purpose);
  if (purpose != null) out.purpose = purpose;
  const timing = trimOrUndefined(r.timing);
  if (timing != null) out.timing = timing;
  const notes = trimOrUndefined(r.notes);
  if (notes != null) out.notes = notes;
  return out;
}

/**
 * Convert form state into the body shape the server-side Zod schemas expect.
 * Strips local row keys and rounds numeric fields for transmission.
 */
export function toCreateBody(state: RecipeFormState): RecipeCreateBody {
  const body: Record<string, unknown> = {
    title: state.title.trim(),
  };
  const author = trimOrUndefined(state.author);
  if (author != null) body.author = author;
  const desc = trimOrUndefined(state.description);
  if (desc != null) body.description = desc;
  const notes = trimOrUndefined(state.notes);
  if (notes != null) body.notes = notes;
  if (state.category) body.category = state.category;
  const style = trimOrUndefined(state.styleName);
  if (style != null) body.styleName = style;
  const bjcp = trimOrUndefined(state.bjcpCategory);
  if (bjcp != null) body.bjcpCategory = bjcp;
  body.batchSizeLiters = roundNumber(state.batchSizeLiters);
  if (state.boilTimeMinutes != null) body.boilTimeMinutes = state.boilTimeMinutes;
  if (state.efficiencyPct != null) {
    body.efficiencyPct = roundNumber(state.efficiencyPct);
  }
  const og = numberOrUndefinedRounded(state.targetOg);
  if (og != null) body.targetOg = og;
  const fg = numberOrUndefinedRounded(state.targetFg);
  if (fg != null) body.targetFg = fg;
  const ph = numberOrUndefinedRounded(state.targetPh);
  if (ph != null) body.targetPh = ph;
  const abv = numberOrUndefinedRounded(state.targetAbv);
  if (abv != null) body.targetAbv = abv;
  const ibu = numberOrUndefinedRounded(state.targetIbu);
  if (ibu != null) body.targetIbu = ibu;
  const srm = numberOrUndefinedRounded(state.targetSrm);
  if (srm != null) body.targetSrm = srm;
  body.fermentables = state.fermentables.map(fermentableToBody);
  body.hops = state.hops.map(hopToBody);
  body.yeasts = state.yeasts.map(yeastToBody);
  body.mashSteps = state.mashSteps.map(mashStepToBody);
  body.processSteps = state.processSteps.map(processStepToBody);
  body.additions = state.additions.map(additionToBody);
  return body as unknown as RecipeCreateBody;
}

/** Map a dotted Zod issue path (e.g. "hops.0.amountGrams") to a friendly key. */
function issuePathToKey(path: ReadonlyArray<PropertyKey>): string {
  return path
    .map((p) => (typeof p === "symbol" ? "" : String(p)))
    .filter((p) => p.length > 0)
    .join(".");
}

/**
 * Validate a recipe form state by running the server-side schema and returning
 * a `{ ok, errors, body }` tuple. `body` is the normalised submission payload
 * ready to POST/PUT — undefined when validation failed.
 */
export function validateRecipeForm(state: RecipeFormState): {
  ok: boolean;
  errors: FormErrors;
  body?: RecipeCreateBody;
} {
  const errors: FormErrors = {};

  // Pre-flight checks for the most-visible fields so the user gets friendly
  // messages before Zod's stricter copies can confuse the issue trail.
  const title = state.title.trim();
  if (!title) errors["title"] = "Title is required.";
  else if (title.length > MAX_TITLE) errors["title"] = `Title is too long (max ${MAX_TITLE}).`;
  if (state.author.length > MAX_OPTIONAL_TEXT_SHORT) {
    errors["author"] = `Author is too long (max ${MAX_OPTIONAL_TEXT_SHORT}).`;
  }
  if (state.description.length > MAX_OPTIONAL_TEXT_DESCRIPTION) {
    errors["description"] = `Description is too long (max ${MAX_OPTIONAL_TEXT_DESCRIPTION}).`;
  }
  if (state.notes.length > MAX_OPTIONAL_TEXT_NOTES) {
    errors["notes"] = `Notes is too long (max ${MAX_OPTIONAL_TEXT_NOTES}).`;
  }
  if (state.styleName.length > MAX_OPTIONAL_TEXT_SHORT) {
    errors["styleName"] = `Style is too long (max ${MAX_OPTIONAL_TEXT_SHORT}).`;
  }
  if (state.bjcpCategory.length > MAX_BJCP) {
    errors["bjcpCategory"] = `BJCP category is too long (max ${MAX_BJCP}).`;
  }

  const body = toCreateBody(state);
  const parsed = recipeCreateSchema.safeParse(body);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issuePathToKey(issue.path);
      if (key && !(key in errors)) {
        errors[key] = issue.message;
      }
    }
  }

  return Object.keys(errors).length === 0
    ? { ok: true, errors, body }
    : { ok: false, errors };
}

/**
 * Format the field name of a nested list row for an error message
 * (e.g. "hops[1]") — purely cosmetic for inline error display.
 */
export function prettyFieldName(path: string): string {
  if (!path) return "form";
  return path
    .split(".")
    .map((seg) => (/^\d+$/.test(seg) ? `[${seg}]` : seg))
    .join(".");
}

/** Suppress the unused-vars warning for max-length constants we keep for docs. */
export const _INTERNAL_LIMITS = {
  MAX_TITLE,
  MAX_OPTIONAL_TEXT_SHORT,
  MAX_OPTIONAL_TEXT_MEDIUM,
  MAX_OPTIONAL_TEXT_DESCRIPTION,
  MAX_OPTIONAL_TEXT_NOTES,
  MAX_OPTIONAL_TEXT_UNIT,
  MAX_BJCP,
} as const;
