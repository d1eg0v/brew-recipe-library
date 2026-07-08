import Link from "next/link";
import { notFound } from "next/navigation";

import RecipeForm from "@/components/recipe/RecipeForm";
import { ArrowGlyph, PencilGlyph } from "@/components/icons";
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
    <div className="mx-auto max-w-6xl px-6 py-10">
      <nav className="mb-6">
        <Link
          href={`/recipes/${id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--muted-foreground)] no-underline hover:text-[var(--foreground)]"
        >
          <ArrowGlyph className="h-3.5 w-3.5 rotate-180" />
          Back to recipe
        </Link>
      </nav>
      <header className="mb-8 max-w-2xl">
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <PencilGlyph className="h-5 w-5" />
          <span className="label-eyebrow !text-[var(--accent)]">Editing</span>
        </div>
        <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight">
          {recipe.title}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Saving replaces the recipe and all of its ingredients with the values
          in this form.
        </p>
      </header>
      <RecipeForm mode="edit" initial={recipe} />
    </div>
  );
}
