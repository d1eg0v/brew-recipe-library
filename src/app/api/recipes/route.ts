// `GET  /api/recipes` — paginated list with filters (category, style, ABV, ingredient, full-text)
// `POST /api/recipes` — create a new recipe

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import {
  readJson,
  validationError,
  badRequest,
  internalError,
} from "@/lib/api/errors";
import { presentRecipe } from "@/lib/api/present";
import { recipeToCreateInput } from "@/lib/api/recipeMapper";
import {
  buildRecipeWhere,
  RECIPE_DEFAULT_ORDER,
} from "@/lib/api/search";
import {
  recipeCreateSchema,
  recipeListQuerySchema,
} from "@/lib/api/schemas";

import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = recipeListQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    style: url.searchParams.get("style") ?? undefined,
    bjcpCategory: url.searchParams.get("bjcpCategory") ?? undefined,
    ingredient: url.searchParams.get("ingredient") ?? undefined,
    abvMin: url.searchParams.get("abvMin") ?? undefined,
    abvMax: url.searchParams.get("abvMax") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });
  if (!parsed.success) {
    return validationError(parsed.error);
  }
  const q = parsed.data;
  const where = buildRecipeWhere(q);

  try {
    const [total, recipes] = await Promise.all([
      prisma.recipe.count({ where }),
      prisma.recipe.findMany({
        where,
        orderBy: RECIPE_DEFAULT_ORDER,
        skip: q.offset,
        take: q.limit,
      }),
    ]);
    return NextResponse.json({
      data: recipes,
      total,
      limit: q.limit,
      offset: q.offset,
    });
  } catch (err) {
    console.error("GET /api/recipes failed:", err);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = recipeCreateSchema.safeParse(body.value);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const created = await prisma.recipe.create({
      data: recipeToCreateInput(parsed.data) as unknown as Prisma.RecipeUncheckedCreateInput,
      include: {
        fermentables: { orderBy: { position: "asc" } },
        hops: { orderBy: { position: "asc" } },
        yeasts: { orderBy: { position: "asc" } },
        mashSteps: { orderBy: { position: "asc" } },
        processSteps: { orderBy: { position: "asc" } },
        additions: { orderBy: { position: "asc" } },
      },
    });
    return NextResponse.json(
      { data: presentRecipe(created, { units: "metric" }) },
      { status: 201 },
    );
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return badRequest("A unique field already exists with that value");
    }
    console.error("POST /api/recipes failed:", err);
    return internalError();
  }
}
