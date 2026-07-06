// Form-state shape and helpers for the recipe create/edit UI.
//
// Mirrors the Zod `recipeBodySchema` so the same validation logic applies on the
// client (instant inline feedback) before the server re-validates on submit.
// `null` means the user explicitly cleared the field; `undefined` distinguishes
// "not set" for fields the server treats as optional and absent.

import {
  FERMENTABLE_TYPES,
  HOP_FORMS,
  HOP_USES,
  MASH_STEP_TYPES,
  PROCESS_STEP_TYPES,
  RECIPE_CATEGORIES,
  YEAST_FORMS,
  YEAST_TYPES,
} from "@/lib/api/schemas";

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];
export type FermentableType = (typeof FERMENTABLE_TYPES)[number];
export type HopUse = (typeof HOP_USES)[number];
export type HopForm = (typeof HOP_FORMS)[number];
export type YeastType = (typeof YEAST_TYPES)[number];
export type YeastForm = (typeof YEAST_FORMS)[number];
export type MashStepType = (typeof MASH_STEP_TYPES)[number];
export type ProcessStepType = (typeof PROCESS_STEP_TYPES)[number];

/** Stable local key for a list row (separate from the DB `id`). */
export type RowKey = string;

export interface FermentableRowState {
  key: RowKey;
  name: string;
  type: FermentableType | "";
  amountKg: number | null;
  amountLiters: number | null;
  colorLovibond: number | null;
  potentialPpg: number | null;
  notes: string;
}

export interface HopRowState {
  key: RowKey;
  name: string;
  amountGrams: number | null;
  alphaAcidPct: number | null;
  timeMinutes: number | null;
  use: HopUse | "";
  form: HopForm | "";
  notes: string;
}

export interface YeastRowState {
  key: RowKey;
  name: string;
  laboratory: string;
  productId: string;
  type: YeastType | "";
  form: YeastForm | "";
  attenuationPct: number | null;
  temperatureCMin: number | null;
  temperatureCMax: number | null;
  notes: string;
}

export interface MashStepRowState {
  key: RowKey;
  name: string;
  type: MashStepType | "";
  stepTempC: number | null;
  stepTimeMinutes: number | null;
  infuseAmountLiters: number | null;
  notes: string;
}

export interface ProcessStepRowState {
  key: RowKey;
  name: string;
  type: ProcessStepType | "";
  tempC: number | null;
  durationDays: number | null;
  notes: string;
}

export interface AdditionRowState {
  key: RowKey;
  name: string;
  amount: number | null;
  unit: string;
  purpose: string;
  timing: string;
  notes: string;
}

export interface RecipeFormState {
  title: string;
  author: string;
  description: string;
  notes: string;
  category: RecipeCategory | "";
  styleName: string;
  bjcpCategory: string;
  batchSizeLiters: number;
  boilTimeMinutes: number | null;
  efficiencyPct: number | null;
  targetOg: number | null;
  targetFg: number | null;
  targetAbv: number | null;
  targetIbu: number | null;
  targetSrm: number | null;
  fermentables: FermentableRowState[];
  hops: HopRowState[];
  yeasts: YeastRowState[];
  mashSteps: MashStepRowState[];
  processSteps: ProcessStepRowState[];
  additions: AdditionRowState[];
}

/** Generate a stable client-side key for a row — server doesn't see this. */
export function newRowKey(): RowKey {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Deterministic fallback for SSR/test environments without crypto.
  return `row-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function emptyFermentable(): FermentableRowState {
  return {
    key: newRowKey(),
    name: "",
    type: "",
    amountKg: null,
    amountLiters: null,
    colorLovibond: null,
    potentialPpg: null,
    notes: "",
  };
}

export function emptyHop(): HopRowState {
  return {
    key: newRowKey(),
    name: "",
    amountGrams: null,
    alphaAcidPct: null,
    timeMinutes: null,
    use: "",
    form: "",
    notes: "",
  };
}

export function emptyYeast(): YeastRowState {
  return {
    key: newRowKey(),
    name: "",
    laboratory: "",
    productId: "",
    type: "",
    form: "",
    attenuationPct: null,
    temperatureCMin: null,
    temperatureCMax: null,
    notes: "",
  };
}

export function emptyMashStep(): MashStepRowState {
  return {
    key: newRowKey(),
    name: "",
    type: "",
    stepTempC: null,
    stepTimeMinutes: null,
    infuseAmountLiters: null,
    notes: "",
  };
}

export function emptyProcessStep(): ProcessStepRowState {
  return {
    key: newRowKey(),
    name: "",
    type: "",
    tempC: null,
    durationDays: null,
    notes: "",
  };
}

export function emptyAddition(): AdditionRowState {
  return {
    key: newRowKey(),
    name: "",
    amount: null,
    unit: "",
    purpose: "",
    timing: "",
    notes: "",
  };
}

/** A new, blank recipe form state with sensible defaults. */
export function blankRecipeFormState(): RecipeFormState {
  return {
    title: "",
    author: "",
    description: "",
    notes: "",
    category: "",
    styleName: "",
    bjcpCategory: "",
    batchSizeLiters: 20,
    boilTimeMinutes: 60,
    efficiencyPct: 75,
    targetOg: null,
    targetFg: null,
    targetAbv: null,
    targetIbu: null,
    targetSrm: null,
    fermentables: [],
    hops: [],
    yeasts: [],
    mashSteps: [],
    processSteps: [],
    additions: [],
  };
}
