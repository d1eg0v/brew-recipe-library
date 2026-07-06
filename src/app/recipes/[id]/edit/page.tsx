import Link from "next/link";
import { notFound } from "next/navigation";

import RecipeForm from "@/components/recipe/RecipeForm";
import { prisma } from "@/lib/db";
import { presentRecipe } from "@/lib/api/present";
import type { RecipeDetail } from "@/lib/ui/types";

import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const RECIPE_INCLUDE = {
  fermentables: { orderBy: { position: "asc" as const } },
  hops: { orderBy: { position: "asc" as const } },
  yeasts: { orderBy: { position: "asc" as const } },
  mashSteps: { orderBy: { position: "asc" as const } },
  processSteps: { orderBy: { position: "asc" as const } },
  additions: { orderBy: { position: "asc" as const } },
};

async function loadRecipeForEdit(id: string): Promise<RecipeDetail | null> {
  const row = await prisma.recipe.findUnique({
    where: { id },
    include: RECIPE_INCLUDE,
  });
  if (!row) return null;
  return presentRecipe(row, { units: "metric" }) as unknown as RecipeDetail;
}

export async function generateMetadata({ params }: RouteParams) {
  const { id } = await params;
  const row = await prisma.recipe.findUnique({
    where: { id },
    select: { title: true },
  });
  if (!row) {
    return { title: "Edit recipe — Brew Recipe Library" };
  }
  return {
    title: `Edit ${row.title} — Brew Recipe Library`,
    description: `Edit the recipe “${row.title}”.`,
  };
}

export default async function EditRecipePage({ params }: RouteParams) {
  const { id } = await params;
  let recipe: RecipeDetail | null;
  try {
    recipe = await loadRecipeForEdit(id);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      notFound();
    }
    throw err;
  }
  if (!recipe) notFound();

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link
          href={`/recipes/${id}`}
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] no-underline"
        >
          ← Back to recipe
        </Link>
      </nav>
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Edit recipe</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Saving replaces the recipe and all of its ingredients with the values
          in this form.
        </p>
      </header>
      <RecipeForm mode="edit" initial={recipe} />
    </div>
  );
}
