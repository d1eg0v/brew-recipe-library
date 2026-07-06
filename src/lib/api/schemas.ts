// Zod schemas for the recipe HTTP API.
//
// The DB stores metric SI units; input is accepted in metric. Imperial <-> metric
// conversion for display happens in the presentation layer.

import { z } from "zod";

/** Allowed recipe categories. "beer" | "mead" | "wine" | "cider" | "other". */
export const RECIPE_CATEGORIES = [
  "beer",
  "mead",
  "wine",
  "cider",
  "other",
] as const;
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

/** Allowed fermentable types — see Prisma `Fermentable.type`. */
export const FERMENTABLE_TYPES = [
  "grain",
  "extract",
  "sugar",
  "adjunct",
  "honey",
  "juice",
  "concentrate",
  "fruit",
  "must",
] as const;

/** Allowed hop use values. */
export const HOP_USES = [
  "boil",
  "firstWort",
  "whirlpool",
  "dryHop",
  "mash",
] as const;

/** Allowed hop form values. */
export const HOP_FORMS = ["pellet", "leaf", "plug", "extract"] as const;

/** Allowed yeast form values. */
export const YEAST_FORMS = ["dry", "liquid", "slant", "culture"] as const;

/** Allowed yeast type values. */
export const YEAST_TYPES = [
  "ale",
  "lager",
  "wheat",
  "wine",
  "champagne",
  "other",
] as const;

/** Allowed mash step types. */
export const MASH_STEP_TYPES = ["infusion", "temperature", "decoction"] as const;

/** Allowed process step types. */
export const PROCESS_STEP_TYPES = [
  "primary",
  "secondary",
  "racking",
  "backsweetening",
  "stabilizing",
  "aging",
  "bottling",
  "other",
] as const;

/** Any non-negative finite number (allows 0). */
const nonNegativeNumber = z.number().finite().nonnegative();
/** Any positive finite number (rejects 0 and negatives). */
const positiveNumber = z.number().finite().positive();

const titleField = z.string().trim().min(1).max(200);
const nameField = z.string().trim().min(1).max(200);
const notesField = z.string().trim().max(10_000).optional();
const temperatureField = z.number().finite().gte(-50).lte(150); // °C; bounded guard
const percentageField = z.number().finite().gte(0).lte(100);

const fermentableInputSchema = z
  .object({
    id: z.string().optional(),
    name: nameField,
    type: z
      .string()
      .refine(
        (v) =>
          (FERMENTABLE_TYPES as readonly string[]).includes(v) ||
          v === "",
        { message: `must be one of: ${FERMENTABLE_TYPES.join(", ")}` },
      )
      .optional(),
    amountKg: nonNegativeNumber.optional(),
    amountLiters: nonNegativeNumber.optional(),
    colorLovibond: nonNegativeNumber.optional(),
    potentialPpg: nonNegativeNumber.optional(),
    notes: notesField,
    position: z.number().int().nonnegative().optional(),
  })
  .refine(
    (v) => v.amountKg != null || v.amountLiters != null,
    { message: "either amountKg or amountLiters must be set" },
  );

const hopInputSchema = z.object({
  id: z.string().optional(),
  name: nameField,
  amountGrams: positiveNumber,
  alphaAcidPct: z.number().finite().gte(0).lte(30).optional(),
  timeMinutes: z.number().finite().nonnegative(),
  use: z
    .string()
    .refine(
      (v) =>
        v === "" ||
        (HOP_USES as readonly string[]).includes(v),
      { message: `must be one of: ${HOP_USES.join(", ")}` },
    )
    .optional(),
  form: z
    .string()
    .refine(
      (v) =>
        v === "" ||
        (HOP_FORMS as readonly string[]).includes(v),
      { message: `must be one of: ${HOP_FORMS.join(", ")}` },
    )
    .optional(),
  notes: notesField,
  position: z.number().int().nonnegative().optional(),
});

const yeastInputSchema = z.object({
  id: z.string().optional(),
  name: nameField,
  laboratory: z.string().trim().max(200).optional(),
  productId: z.string().trim().max(100).optional(),
  type: z
    .string()
    .refine(
      (v) =>
        v === "" ||
        (YEAST_TYPES as readonly string[]).includes(v),
      { message: `must be one of: ${YEAST_TYPES.join(", ")}` },
    )
    .optional(),
  form: z
    .string()
    .refine(
      (v) =>
        v === "" ||
        (YEAST_FORMS as readonly string[]).includes(v),
      { message: `must be one of: ${YEAST_FORMS.join(", ")}` },
    )
    .optional(),
  attenuationPct: percentageField.optional(),
  temperatureCMin: temperatureField.optional(),
  temperatureCMax: temperatureField.optional(),
  notes: notesField,
  position: z.number().int().nonnegative().optional(),
});

const mashStepInputSchema = z.object({
  id: z.string().optional(),
  name: nameField,
  type: z
    .string()
    .refine(
      (v) =>
        v === "" ||
        (MASH_STEP_TYPES as readonly string[]).includes(v),
      { message: `must be one of: ${MASH_STEP_TYPES.join(", ")}` },
    )
    .optional(),
  stepTempC: temperatureField,
  stepTimeMinutes: z.number().finite().nonnegative().optional(),
  infuseAmountLiters: nonNegativeNumber.optional(),
  notes: notesField,
  position: z.number().int().nonnegative().optional(),
});

const processStepInputSchema = z.object({
  id: z.string().optional(),
  name: nameField,
  type: z
    .string()
    .refine(
      (v) =>
        v === "" ||
        (PROCESS_STEP_TYPES as readonly string[]).includes(v),
      { message: `must be one of: ${PROCESS_STEP_TYPES.join(", ")}` },
    )
    .optional(),
  tempC: temperatureField.optional(),
  durationDays: nonNegativeNumber.optional(),
  notes: notesField,
  position: z.number().int().nonnegative().optional(),
});

const additionInputSchema = z.object({
  id: z.string().optional(),
  name: nameField,
  amount: nonNegativeNumber.optional(),
  unit: z.string().trim().max(50).optional(),
  purpose: z.string().trim().max(500).optional(),
  timing: z.string().trim().max(500).optional(),
  notes: notesField,
  position: z.number().int().nonnegative().optional(),
});

/** Recipe fields shared by create and replace (PUT) bodies. */
export const recipeBodySchema = z
  .object({
    title: titleField,
    author: z.string().trim().max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    notes: z.string().trim().max(10_000).optional(),
    category: z
      .string()
      .refine(
        (v) => (RECIPE_CATEGORIES as readonly string[]).includes(v),
        { message: `must be one of: ${RECIPE_CATEGORIES.join(", ")}` },
      )
      .optional(),
    styleName: z.string().trim().max(200).optional(),
    bjcpCategory: z.string().trim().max(20).optional(),
    batchSizeLiters: positiveNumber,
    boilTimeMinutes: z.number().int().nonnegative().optional(),
    efficiencyPct: percentageField.optional(),
    targetOg: z.number().finite().gte(0.95).lte(1.2).optional(),
    targetFg: z.number().finite().gte(0.95).lte(1.2).optional(),
    targetAbv: z.number().finite().gte(0).lte(25).optional(),
    targetIbu: z.number().finite().gte(0).lte(200).optional(),
    targetSrm: z.number().finite().gte(0).lte(80).optional(),
    fermentables: z.array(fermentableInputSchema).default([]),
    hops: z.array(hopInputSchema).default([]),
    yeasts: z.array(yeastInputSchema).default([]),
    mashSteps: z.array(mashStepInputSchema).default([]),
    processSteps: z.array(processStepInputSchema).default([]),
    additions: z.array(additionInputSchema).default([]),
  })
  .refine(
    (r) => !(r.targetOg != null && r.targetFg != null) || r.targetOg >= r.targetFg,
    {
      message: "targetOg must be greater than or equal to targetFg",
      path: ["targetOg"],
    },
  );

/** Loose "all fields optional" recipe body for PATCH. */
export const recipePatchSchema = z
  .object({
    title: titleField.optional(),
    author: z.string().trim().max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    notes: z.string().trim().max(10_000).optional(),
    category: z
      .string()
      .refine(
        (v) => (RECIPE_CATEGORIES as readonly string[]).includes(v),
        { message: `must be one of: ${RECIPE_CATEGORIES.join(", ")}` },
      )
      .optional(),
    styleName: z.string().trim().max(200).optional(),
    bjcpCategory: z.string().trim().max(20).optional(),
    batchSizeLiters: positiveNumber.optional(),
    boilTimeMinutes: z.number().int().nonnegative().optional(),
    efficiencyPct: percentageField.optional(),
    targetOg: z.number().finite().gte(0.95).lte(1.2).optional(),
    targetFg: z.number().finite().gte(0.95).lte(1.2).optional().nullable(),
    targetAbv: z.number().finite().gte(0).lte(25).optional(),
    targetIbu: z.number().finite().gte(0).lte(200).optional(),
    targetSrm: z.number().finite().gte(0).lte(80).optional(),
    fermentables: z.array(fermentableInputSchema).optional(),
    hops: z.array(hopInputSchema).optional(),
    yeasts: z.array(yeastInputSchema).optional(),
    mashSteps: z.array(mashStepInputSchema).optional(),
    processSteps: z.array(processStepInputSchema).optional(),
    additions: z.array(additionInputSchema).optional(),
  })
  .strict();

export const recipeCreateSchema = recipeBodySchema.strict();
export const recipeReplaceSchema = recipeBodySchema.strict();

/** Supported unit systems. */
export const UNIT_SYSTEMS = ["metric", "imperial"] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

const positiveNumberOrString = z
  .union([z.number().finite().positive(), z.string().regex(/^\d+(\.\d+)?$/, "must be a positive number")]);

/** Query params for `GET /api/recipes` (search/filter). */
export const recipeListQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    category: z
      .string()
      .refine(
        (v) => (RECIPE_CATEGORIES as readonly string[]).includes(v),
        { message: `must be one of: ${RECIPE_CATEGORIES.join(", ")}` },
      )
      .optional(),
    style: z.string().trim().max(200).optional(),
    bjcpCategory: z.string().trim().max(20).optional(),
    ingredient: z.string().trim().max(200).optional(),
    abvMin: z.coerce.number().gte(0).lte(25).optional(),
    abvMax: z.coerce.number().gte(0).lte(25).optional(),
    limit: z.coerce.number().int().gte(1).lte(200).default(50),
    offset: z.coerce.number().int().gte(0).default(0),
  })
  .refine(
    (q) => q.abvMin == null || q.abvMax == null || q.abvMin <= q.abvMax,
    { message: "abvMin must be <= abvMax", path: ["abvMin"] },
  );

/** Query params for recipe-detail "scale" + "units" controls. */
export const recipeDetailQuerySchema = z.object({
  batchSize: positiveNumberOrString.optional(),
  units: z
    .string()
    .refine(
      (v) => (UNIT_SYSTEMS as readonly string[]).includes(v),
      { message: `must be one of: ${UNIT_SYSTEMS.join(", ")}` },
    )
    .optional(),
});

// -----------------------------------------------------------------------------
// Batch (brew log) schemas — mirror the Prisma `Batch` model. All metric.
// -----------------------------------------------------------------------------

const gravityField = z.number().finite().gte(1.0).lte(1.2);
const batchVolumeField = z.number().finite().positive();

const brewDateField = z
  .string()
  .datetime({ offset: true, message: "brewDate must be an ISO date string" })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "brewDate must be an ISO date string"));

export const batchCreateSchema = z
  .object({
    brewDate: brewDateField,
    measuredOg: gravityField.optional(),
    measuredFg: gravityField.optional(),
    volumeLiters: batchVolumeField.optional(),
    notes: z.string().trim().max(10_000).optional(),
  })
  .strict();

export const batchPatchSchema = z
  .object({
    brewDate: brewDateField.optional(),
    measuredOg: gravityField.optional().nullable(),
    measuredFg: gravityField.optional().nullable(),
    volumeLiters: batchVolumeField.optional().nullable(),
    notes: z.string().trim().max(10_000).optional().nullable(),
  })
  .strict();

export type BatchCreateBody = z.infer<typeof batchCreateSchema>;
export type BatchPatchBody = z.infer<typeof batchPatchSchema>;

export type RecipeCreateBody = z.infer<typeof recipeCreateSchema>;
export type RecipeReplaceBody = z.infer<typeof recipeReplaceSchema>;
export type RecipePatchBody = z.infer<typeof recipePatchSchema>;
export type RecipeListQuery = z.infer<typeof recipeListQuerySchema>;
export type RecipeDetailQuery = z.infer<typeof recipeDetailQuerySchema>;
