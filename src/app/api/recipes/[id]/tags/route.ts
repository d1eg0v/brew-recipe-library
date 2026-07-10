// `GET   /api/recipes/[id]/tags`  — list a recipe's tags
// `PUT   /api/recipes/[id]/tags`  — replace the recipe's tag set
// `POST  /api/recipes/[id]/tags`  — add a single tag (idempotent)

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import {
  badRequest,
  internalError,
  notFound,
  readJson,
  validationError,
} from "@/lib/api/errors";
import { presentTag } from "@/lib/api/presentTags";
import {
  recipeTagAddSchema,
  recipeTagsReplaceSchema,
} from "@/lib/api/schemas";
import { normalizeTagNames } from "@/lib/tags";

export const dynamic = "force-dynamic";

async function ensureRecipeExists(id: string) {
  const row = await prisma.recipe.findUnique({
    where: { id },
    select: { id: true },
  });
  return row != null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    if (!(await ensureRecipeExists(id))) return notFound("Recipe not found");
    const links = await prisma.recipeTag.findMany({
      where: { recipeId: id },
      include: { tag: true },
      orderBy: { tag: { name: "asc" } },
    });
    return NextResponse.json({
      data: links.map((l) => presentTag(l.tag)),
    });
  } catch (err) {
    console.error("GET /api/recipes/[id]/tags failed:", err);
    return internalError();
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = recipeTagsReplaceSchema.safeParse(body.value);
  if (!parsed.success) return validationError(parsed.error);
  const names = normalizeTagNames(parsed.data.tags);

  try {
    if (!(await ensureRecipeExists(id))) return notFound("Recipe not found");

    // Replace: drop the existing joins, then create the new set through the
    // nested `tag` relation. The connectOrCreate lookup means we re-use any
    // existing Tag row and only create the missing ones — the unique index on
    // `Tag.name` makes this race-safe.
    const result = await prisma.recipe.update({
      where: { id },
      data: {
        recipeTags: {
          deleteMany: {},
          ...(names.length > 0
            ? {
                create: names.map((name) => ({
                  tag: {
                    connectOrCreate: {
                      where: { name },
                      create: { name },
                    },
                  },
                })),
              }
            : {}),
        },
      },
      include: { recipeTags: { include: { tag: true } } },
    });

    const tags = result.recipeTags
      .map((rt) => rt.tag)
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ data: tags.map(presentTag) });
  } catch (err) {
    console.error("PUT /api/recipes/[id]/tags failed:", err);
    return internalError();
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = recipeTagAddSchema.safeParse(body.value);
  if (!parsed.success) return validationError(parsed.error);
  const name = parsed.data.name;
  if (!name) {
    return badRequest("name is required");
  }

  try {
    if (!(await ensureRecipeExists(id))) return notFound("Recipe not found");

    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    // Use `connectOrCreate` so a re-add is a no-op.
    await prisma.recipe.update({
      where: { id },
      data: {
        recipeTags: {
          connectOrCreate: {
            where: {
              recipeId_tagId: { recipeId: id, tagId: tag.id },
            },
            create: { tagId: tag.id },
          },
        },
      },
    });
    return NextResponse.json({ data: presentTag(tag) }, { status: 201 });
  } catch (err) {
    console.error("POST /api/recipes/[id]/tags failed:", err);
    return internalError();
  }
}
