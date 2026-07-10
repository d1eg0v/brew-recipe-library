// `POST /api/recipes/import/baseline` — add missing curated FermentDB recipes
// from prisma/seed/recipes.json without deleting existing user data.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { internalError } from "@/lib/api/errors";
import { recipeToCreateInput } from "@/lib/api/recipeMapper";
import { recipeCreateSchema } from "@/lib/api/schemas";
import { loadSeedRecipes } from "@/lib/seed/load";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function POST() {
  const source = path.resolve(process.cwd(), "prisma/seed/recipes.json");
  try {
    const recipes = loadSeedRecipes(JSON.parse(await readFile(source, "utf8")));
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const recipe of recipes) {
      const parsed = recipeCreateSchema.safeParse(recipe);
      if (!parsed.success) {
        errors.push(`${recipe.title}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
        continue;
      }
      const exists = await prisma.recipe.findFirst({
        where: { title: parsed.data.title },
        select: { id: true },
      });
      if (exists) {
        skipped++;
        continue;
      }
      await prisma.recipe.create({
        data: recipeToCreateInput(parsed.data) as unknown as Prisma.RecipeUncheckedCreateInput,
      });
      inserted++;
    }

    return NextResponse.json({
      data: {
        source,
        loaded: recipes.length,
        inserted,
        skipped,
        errors,
      },
    });
  } catch (err) {
    console.error("POST /api/recipes/import/baseline failed:", err);
    return internalError();
  }
}
