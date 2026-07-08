// Zod schemas for the recipe HTTP API.
//
// The DB stores metric SI units; input is accepted in metric. Imperial <-> metric
// conversion for display happens in the presentation layer.

import { z } from "zod";

import { normalizeTagName } from "@/lib/tags";

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
const beverageTypeField = z
  .string()
  .refine(
    (v) => (RECIPE_CATEGORIES as readonly string[]).includes(v),
    { message: `must be one of: ${RECIPE_CATEGORIES.join(", ")}` },
  );

/**
 * One freeform tag name as accepted on the wire (BRE-29). Validates shape only;
 * canonicalisation (trim + lower-case) happens in the mapper so the unique DB
 * index can dedupe case-insensitively. Empty / whitespace-only names are
 * rejected here so the client gets a useful error instead of silent drops.
 */
const tagNameField = z
  .string()
  .trim()
  .min(1, "tag cannot be empty")
  .max(50, "tag is too long");

/** An ordered list of tag names. Empty / duplicates are tolerated; the mapper
 *  collapses them. We bound the count to keep payloads reasonable. */
const tagsField = z
  .array(tagNameField)
  .max(50, "too many tags")
  .default([]);

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
  abvTolerancePct: percentageField.optional(),
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
    category: beverageTypeField.optional(),
    beverageType: beverageTypeField.optional(),
    styleName: z.string().trim().max(200).optional(),
    bjcpCategory: z.string().trim().max(20).optional(),
    batchSizeLiters: positiveNumber,
    boilTimeMinutes: z.number().int().nonnegative().optional(),
    efficiencyPct: percentageField.optional(),
    targetOg: z.number().finite().gte(0.95).lte(1.2).optional(),
    targetFg: z.number().finite().gte(0.95).lte(1.2).optional(),
    targetPh: z.number().finite().gte(2).lte(7).optional(),
    targetAbv: z.number().finite().gte(0).lte(25).optional(),
    targetIbu: z.number().finite().gte(0).lte(200).optional(),
    targetSrm: z.number().finite().gte(0).lte(80).optional(),
    fermentables: z.array(fermentableInputSchema).default([]),
    hops: z.array(hopInputSchema).default([]),
    yeasts: z.array(yeastInputSchema).default([]),
    mashSteps: z.array(mashStepInputSchema).default([]),
    processSteps: z.array(processStepInputSchema).default([]),
    additions: z.array(additionInputSchema).default([]),
    tags: tagsField,
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
    category: beverageTypeField.optional(),
    beverageType: beverageTypeField.optional(),
    styleName: z.string().trim().max(200).optional(),
    bjcpCategory: z.string().trim().max(20).optional(),
    batchSizeLiters: positiveNumber.optional(),
    boilTimeMinutes: z.number().int().nonnegative().optional(),
    efficiencyPct: percentageField.optional(),
    targetOg: z.number().finite().gte(0.95).lte(1.2).optional(),
    targetFg: z.number().finite().gte(0.95).lte(1.2).optional().nullable(),
    targetPh: z.number().finite().gte(2).lte(7).optional().nullable(),
    targetAbv: z.number().finite().gte(0).lte(25).optional(),
    targetIbu: z.number().finite().gte(0).lte(200).optional(),
    targetSrm: z.number().finite().gte(0).lte(80).optional(),
    fermentables: z.array(fermentableInputSchema).optional(),
    hops: z.array(hopInputSchema).optional(),
    yeasts: z.array(yeastInputSchema).optional(),
    mashSteps: z.array(mashStepInputSchema).optional(),
    processSteps: z.array(processStepInputSchema).optional(),
    additions: z.array(additionInputSchema).optional(),
    tags: z.array(tagNameField).max(50).optional(),
  })
  .strict();

export const recipeCreateSchema = recipeBodySchema.strict();
export const recipeReplaceSchema = recipeBodySchema.strict();

/** Supported unit systems. */
export const UNIT_SYSTEMS = ["metric", "imperial"] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

const positiveNumberOrString = z
  .union([z.number().finite().positive(), z.string().regex(/^\d+(\.\d+)?$/, "must be a positive number")]);

/** Allowed sort fields for `GET /api/recipes`. `gravity` aliases to
 *  `targetOg`; `date` is the recipe's creation time (date added). */
export const RECIPE_SORT_FIELDS = [
  "name",
  "abv",
  "ibu",
  "gravity",
  "date",
] as const;
export type RecipeSortField = (typeof RECIPE_SORT_FIELDS)[number];

/** Allowed sort directions. */
export const RECIPE_SORT_DIRS = ["asc", "desc"] as const;
export type RecipeSortDir = (typeof RECIPE_SORT_DIRS)[number];

/** Query params for `GET /api/recipes` (search/filter/sort). */
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
    tag: z.string().trim().max(50).optional(),
    abvMin: z.coerce.number().gte(0).lte(25).optional(),
    abvMax: z.coerce.number().gte(0).lte(25).optional(),
    ibuMin: z.coerce.number().gte(0).lte(200).optional(),
    ibuMax: z.coerce.number().gte(0).lte(200).optional(),
    srmMin: z.coerce.number().gte(0).lte(80).optional(),
    srmMax: z.coerce.number().gte(0).lte(80).optional(),
    ogMin: z.coerce.number().gte(0.95).lte(1.2).optional(),
    ogMax: z.coerce.number().gte(0.95).lte(1.2).optional(),
    sort: z.enum(RECIPE_SORT_FIELDS).default("date"),
    dir: z.enum(RECIPE_SORT_DIRS).default("desc"),
    limit: z.coerce.number().int().gte(1).lte(200).default(50),
    offset: z.coerce.number().int().gte(0).default(0),
  })
  .refine(
    (q) => q.abvMin == null || q.abvMax == null || q.abvMin <= q.abvMax,
    { message: "abvMin must be <= abvMax", path: ["abvMin"] },
  )
  .refine(
    (q) => q.ibuMin == null || q.ibuMax == null || q.ibuMin <= q.ibuMax,
    { message: "ibuMin must be <= ibuMax", path: ["ibuMin"] },
  )
  .refine(
    (q) => q.srmMin == null || q.srmMax == null || q.srmMin <= q.srmMax,
    { message: "srmMin must be <= srmMax", path: ["srmMin"] },
  )
  .refine(
    (q) => q.ogMin == null || q.ogMax == null || q.ogMin <= q.ogMax,
    { message: "ogMin must be <= ogMax", path: ["ogMin"] },
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

export const BATCH_LOG_TYPES = [
  "note",
  "gravity",
  "ph",
  "temperature",
  "racking",
  "addition",
  "tasting",
  "other",
] as const;

const batchLogTypeField = z
  .string()
  .refine(
    (v) => (BATCH_LOG_TYPES as readonly string[]).includes(v),
    { message: `must be one of: ${BATCH_LOG_TYPES.join(", ")}` },
  );

export const batchLogCreateSchema = z
  .object({
    batchId: z.string().optional(),
    logDate: brewDateField.optional(),
    type: batchLogTypeField.default("note"),
    gravity: z.number().finite().gte(0.95).lte(1.2).optional(),
    ph: z.number().finite().gte(2).lte(7).optional(),
    temperatureC: temperatureField.optional(),
    volumeLiters: batchVolumeField.optional(),
    notes: z.string().trim().max(10_000).optional(),
  })
  .strict();

export const batchLogPatchSchema = batchLogCreateSchema.partial().strict();

export type BatchCreateBody = z.infer<typeof batchCreateSchema>;
export type BatchPatchBody = z.infer<typeof batchPatchSchema>;

// -----------------------------------------------------------------------------
// Priming-sugar (carbonation) calculator — query params for GET /api/priming-sugar.
// All physical quantities are metric (litres, °C); imperial display happens in
// the presentation layer.
// -----------------------------------------------------------------------------

/** Sugar types supported by the priming-sugar calculator. */
export const PRIMING_SUGAR_TYPES = [
  "cornSugar",
  "tableSugar",
  "dme",
] as const;
export type PrimingSugarType = (typeof PRIMING_SUGAR_TYPES)[number];

/** Query params for `GET /api/priming-sugar`. */
export const primingSugarQuerySchema = z
  .object({
    /** Batch volume at bottling, in litres. Coerced from string when needed. */
    volumeLiters: z.coerce.number().finite().positive().optional(),
    /** Target CO2 in volumes. Typical: 1.0–1.5 for low, 2.0–2.5 for ales, 2.5–3.5 for Belgian. */
    targetVolumes: z.coerce.number().finite().gte(0).lte(6),
    /** Conditioning temperature in °C. Typical: 0–25 °C. */
    temperatureC: z.coerce.number().finite().gte(-20).lte(60),
    /** Which sugar to dose with. */
    sugarType: z
      .string()
      .refine(
        (v) => (PRIMING_SUGAR_TYPES as readonly string[]).includes(v),
        { message: `must be one of: ${PRIMING_SUGAR_TYPES.join(", ")}` },
      ),
    /** Optional recipe id — when present, the route looks up the batch size
     *  to pre-fill the volume. */
    recipeId: z.string().trim().min(1).max(200).optional(),
    /** Display unit system. "metric" returns g; "imperial" returns g + oz. */
    units: z
      .string()
      .refine(
        (v) => (UNIT_SYSTEMS as readonly string[]).includes(v),
        { message: `must be one of: ${UNIT_SYSTEMS.join(", ")}` },
      )
      .optional(),
  })
  .refine(
    (q) => q.recipeId != null || q.volumeLiters != null,
    {
      message: "either recipeId or volumeLiters is required",
      path: ["volumeLiters"],
    },
  );

export type PrimingSugarQuery = z.infer<typeof primingSugarQuerySchema>;

// -----------------------------------------------------------------------------
// Quick ABV-from-OG/FG calculator (BRE-35) — query params for GET /api/abv.
//
// The brewer's measured readings are gravity (dimensionless), so there are
// no metric/imperial conversions here — the same numbers work in either
// unit system. The optional `recipeId` is for pre-filling the inputs from
// a recipe's target OG/FG, matching the pre-fill pattern used by
// `primingSugarQuerySchema` and `strikeWaterQuerySchema`.
// -----------------------------------------------------------------------------

const abvFormulaField = z
  .string()
  .refine(
    (v) => v === "auto" || v === "linear" || v === "highGravity",
    { message: "must be one of: auto, linear, highGravity" },
  )
  .optional();

/** Query params for `GET /api/abv`. */
export const abvQuerySchema = z
  .object({
    /** Measured original gravity. Coerced from string when needed. */
    measuredOg: z.coerce.number().finite().gte(0.95).lte(1.2).optional(),
    /** Measured final gravity. Coerced from string when needed. */
    measuredFg: z.coerce.number().finite().gte(0.95).lte(1.2).optional(),
    /**
     * Formula override. "auto" (default) picks the high-gravity correction
     * at OG ≥ 1.07; "linear" always uses the standard (OG - FG) × 131.25;
     * "highGravity" always uses the Daniels/Papazian nonlinear form.
     */
    formula: abvFormulaField,
    /**
     * Optional recipe id — when present, the route looks up the recipe's
     * targetOg / targetFg to pre-fill `measuredOg` / `measuredFg`. A
     * caller-provided value always wins over the recipe target.
     */
    recipeId: z.string().trim().min(1).max(200).optional(),
  })
  .refine(
    (q) =>
      q.recipeId != null ||
      (q.measuredOg != null && q.measuredFg != null),
    {
      message:
        "either recipeId or both measuredOg and measuredFg are required",
      path: ["measuredOg"],
    },
  )
  .refine(
    // Cross-field OG/FG check is enforced by the pure calc; we still reject
    // the obvious mis-entry here so the caller gets a useful error rather
    // than a generic 500 from the validator.
    (q) =>
      q.measuredOg == null ||
      q.measuredFg == null ||
      q.measuredOg >= q.measuredFg,
    {
      message: "measuredOg must be greater than or equal to measuredFg",
      path: ["measuredOg"],
    },
  );

export type AbvQuery = z.infer<typeof abvQuerySchema>;

export type RecipeCreateBody = z.infer<typeof recipeCreateSchema>;
export type RecipeReplaceBody = z.infer<typeof recipeReplaceSchema>;
export type RecipePatchBody = z.infer<typeof recipePatchSchema>;
export type RecipeListQuery = z.infer<typeof recipeListQuerySchema>;
export type RecipeDetailQuery = z.infer<typeof recipeDetailQuerySchema>;
export type BatchLogCreateBody = z.infer<typeof batchLogCreateSchema>;
export type BatchLogPatchBody = z.infer<typeof batchLogPatchSchema>;

// -----------------------------------------------------------------------------
// Tag schemas (BRE-29) — freeform recipe labels.
// -----------------------------------------------------------------------------

/** Body for `PUT /api/recipes/[id]/tags` (replace the tag set wholesale). */
export const recipeTagsReplaceSchema = z
  .object({
    tags: z.array(tagNameField).max(50),
  })
  .strict();

/** Body for `POST /api/recipes/[id]/tags` (add a single tag, idempotent). */
export const recipeTagAddSchema = z
  .object({
    name: tagNameField,
  })
  .strict()
  .transform((v) => ({ name: normalizeTagName(v.name) ?? v.name }));

/** Body for `POST /api/tags` (admin-style create; same shape as add). */
export const tagCreateSchema = recipeTagAddSchema;

export type RecipeTagsReplaceBody = z.infer<typeof recipeTagsReplaceSchema>;
export type RecipeTagAddBody = z.infer<typeof recipeTagAddSchema>;
export type TagCreateBody = z.infer<typeof tagCreateSchema>;

/** Query params for `GET /api/tags` — supports sorting and a min count. */
export const tagListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  minCount: z.coerce.number().int().gte(0).optional(),
  limit: z.coerce.number().int().gte(1).lte(500).default(200),
});
export type TagListQuery = z.infer<typeof tagListQuerySchema>;
