// BRE-43 — public read-only recipe view at `/share/[token]`.
//
// Looks up the recipe by its `shareToken` (no recipe-id is exposed in the
// URL) and renders the standard recipe detail in a "read-only" mode. If
// the token no longer resolves — the owner revoked sharing, or it never
// existed — `notFound()` renders a 404 page so the link looks "broken"
// rather than "deleted", preventing dictionary probes for valid tokens.

import { notFound } from "next/navigation";

import RecipeDetailClient from "@/app/recipes/[id]/RecipeDetailClient";
import { presentRecipe } from "@/lib/api/present";
import { prisma } from "@/lib/db";
import type { RecipeDetail, UnitSystem } from "@/lib/ui/types";

export const dynamic = "force-dynamic";

const RECIPE_INCLUDE = {
  fermentables: { orderBy: { position: "asc" as const } },
  hops: { orderBy: { position: "asc" as const } },
  yeasts: { orderBy: { position: "asc" as const } },
  mashSteps: { orderBy: { position: "asc" as const } },
  processSteps: { orderBy: { position: "asc" as const } },
  additions: { orderBy: { position: "asc" as const } },
  recipeTags: { include: { tag: true } },
};

function parseUnitsParam(raw: string | undefined): UnitSystem {
  return raw === "imperial" ? "imperial" : "metric";
}

function parseBatchSizeParam(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const v = Number.parseFloat(raw);
  if (!Number.isFinite(v) || v <= 0) return undefined;
  return v;
}

/** Share tokens are 22 URL-safe characters — reject anything longer early so
 *  a directory probe can't spend time in the DB. The DB query itself is
 *  indexed (unique constraint on `shareToken`). */
function isPlausibleToken(raw: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(raw);
}

interface RouteParams {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: RouteParams) {
  const { token } = await params;
  if (!isPlausibleToken(token)) {
    return { title: "Shared recipe — Brew Recipe Library" };
  }
  const recipe = await prisma.recipe.findUnique({
    where: { shareToken: token },
    select: { title: true, author: true },
  });
  if (!recipe) {
    return { title: "Shared recipe — Brew Recipe Library" };
  }
  const byline = recipe.author ? ` by ${recipe.author}` : "";
  return {
    title: `${recipe.title}${byline} — Brew Recipe Library`,
    description: recipe.author
      ? `A shared recipe “${recipe.title}” by ${recipe.author}.`
      : `A shared recipe “${recipe.title}”.`,
  };
}

export default async function SharePage({
  params,
  searchParams,
}: RouteParams) {
  const { token } = await params;
  if (!isPlausibleToken(token)) {
    notFound();
  }
  const sp = await searchParams;
  const unitsRaw = Array.isArray(sp.units) ? sp.units[0] : sp.units;
  const batchSizeRaw = Array.isArray(sp.batchSize)
    ? sp.batchSize[0]
    : sp.batchSize;
  const initialUnits = parseUnitsParam(unitsRaw);
  const initialBatchSize = parseBatchSizeParam(batchSizeRaw);

  const recipe = await prisma.recipe.findUnique({
    where: { shareToken: token },
    include: RECIPE_INCLUDE,
  });
  if (!recipe) notFound();

  const presented = presentRecipe(recipe, {
    batchSize: initialBatchSize,
    units: initialUnits,
  }) as unknown as RecipeDetail;

  return (
    <RecipeDetailClient
      initialRecipe={presented}
      initialUnits={initialUnits}
      initialBatchSize={initialBatchSize}
      readOnly
    />
  );
}
