// Maps validated request bodies to Prisma create/update inputs.
//
// We use "UncheckedCreateInput" / "UncheckedUpdateInput" shapes so children are
// created in a single nested `create` call against the parent recipe. Position
// fields are back-filled from array index when missing so ordering survives.

import type {
  RecipeCreateBody,
  RecipeReplaceBody,
  RecipePatchBody,
} from "./schemas";
import { normalizeTagNames } from "@/lib/tags";

type Child<T> = T & { position?: number };

function withPosition<T>(items: Child<T>[] | undefined): Array<Omit<T, never> & {
  position: number;
}> {
  if (!items) return [];
  return items.map((item, i) => {
    const { position, ...rest } = item as Child<T> & { position?: number };
    return {
      ...(rest as T),
      position: typeof position === "number" ? position : i,
    } as Omit<T, never> & { position: number };
  });
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

/** Build the `create` payload for a child list under a new recipe. */
function childCreateMany<T extends Record<string, unknown>>(
  items: Child<T>[] | undefined,
) {
  return withPosition(items);
}

/**
 * Build a Prisma `recipeTags` payload that re-uses existing `Tag` rows by name
 * and creates the rest. The shape uses the nested `tag` relation so Prisma
 * can wire both the join and the Tag row in a single write.
 * Duplicates inside the same input are deduped by `normalizeTagNames`.
 */
function buildTagPayload(names: readonly string[] | undefined) {
  const unique = normalizeTagNames(names);
  if (unique.length === 0) return undefined;
  return {
    create: unique.map((name) => ({
      tag: {
        connectOrCreate: {
          where: { name },
          create: { name },
        },
      },
    })),
  };
}

/**
 * Convert a POST or PUT body into `Prisma.RecipeUncheckedCreateInput`. Children
 * are passed via nested `create:` for atomic creation.
 */
export function recipeToCreateInput(body: RecipeCreateBody | RecipeReplaceBody) {
  const {
    fermentables,
    hops,
    yeasts,
    mashSteps,
    processSteps,
    additions,
    tags,
    ...rest
  } = body;
  const out: Record<string, unknown> = stripUndefined({
    ...rest,
    fermentables: { create: childCreateMany(fermentables) },
    hops: { create: childCreateMany(hops) },
    yeasts: { create: childCreateMany(yeasts) },
    mashSteps: { create: childCreateMany(mashSteps) },
    processSteps: { create: childCreateMany(processSteps) },
    additions: { create: childCreateMany(additions) },
  });
  const tagPayload = buildTagPayload(tags);
  if (tagPayload) out.recipeTags = tagPayload;
  return out;
}

/**
 * For PATCH, only sets the scalar fields that were provided. Children are
 * passed as `deleteMany + create` when their array is supplied — this replaces
 * the list entirely. Returns `null` when nothing was provided.
 */
export function recipePatchToUpdateInput(body: RecipePatchBody) {
  const {
    fermentables,
    hops,
    yeasts,
    mashSteps,
    processSteps,
    additions,
    tags,
    ...scalars
  } = body;

  const data: Record<string, unknown> = stripUndefined(scalars);
  if (fermentables !== undefined) {
    data.fermentables = {
      deleteMany: {},
      create: childCreateMany(fermentables),
    };
  }
  if (hops !== undefined) {
    data.hops = { deleteMany: {}, create: childCreateMany(hops) };
  }
  if (yeasts !== undefined) {
    data.yeasts = { deleteMany: {}, create: childCreateMany(yeasts) };
  }
  if (mashSteps !== undefined) {
    data.mashSteps = { deleteMany: {}, create: childCreateMany(mashSteps) };
  }
  if (processSteps !== undefined) {
    data.processSteps = {
      deleteMany: {},
      create: childCreateMany(processSteps),
    };
  }
  if (additions !== undefined) {
    data.additions = { deleteMany: {}, create: childCreateMany(additions) };
  }
  if (tags !== undefined) {
    // Replace the tag set for this recipe: drop all joins, then create the
    // supplied names through the nested tag relation. Empty array clears all.
    data.recipeTags = {
      deleteMany: {},
      ...(buildTagPayload(tags) ?? {}),
    };
  }

  return Object.keys(data).length === 0 ? null : data;
}
