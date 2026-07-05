// `GET /api/recipes/[id]/shopping-list` — produces a deduplicated, scaled
// shopping list for the recipe at the requested batch size and unit system.
//
// The route delegates scaling + unit conversion to `presentRecipe` (the same
// helper used by `GET /api/recipes/[id]`), then runs the pure builder from
// `@/lib/brewing/shoppingList`. Imperial fields are layered on per-row after
// building so the response shape mirrors the recipe detail endpoint.

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import {
  internalError,
  notFound,
  validationError,
} from "@/lib/api/errors";
import { presentRecipe } from "@/lib/api/present";
import { recipeDetailQuerySchema } from "@/lib/api/schemas";
import {
  buildShoppingList,
  type ShoppingListItem,
} from "@/lib/brewing/shoppingList";
import {
  gramsToOunces,
  kgToPounds,
  litersToGallons,
  roundTo,
} from "@/lib/brewing/units";
import type { ShoppingListItem as UiShoppingListItem } from "@/lib/ui/types";

export const dynamic = "force-dynamic";

const RECIPE_INCLUDE = {
  fermentables: { orderBy: { position: "asc" as const } },
  hops: { orderBy: { position: "asc" as const } },
  yeasts: { orderBy: { position: "asc" as const } },
  mashSteps: { orderBy: { position: "asc" as const } },
  processSteps: { orderBy: { position: "asc" as const } },
  additions: { orderBy: { position: "asc" as const } },
} as const;

interface FermentableView {
  name: string;
  amountKg: number | null;
  amountLiters: number | null;
  amountLbs?: number | null;
  amountGallons?: number | null;
}

interface HopView {
  name: string;
  amountGrams: number;
  amountOz?: number | null;
  use: string | null;
}

interface YeastView {
  name: string;
  form: string | null;
}

interface AdditionView {
  name: string;
  amount: number | null;
  unit: string | null;
}

/**
 * Add an imperial parallel (`imperialAmount`, `imperialUnit`) when the
 * shopping-list row uses a unit we can convert. Free-text units like "tsp"
 * or "tablet" pass through unchanged.
 */
function withImperial(
  item: ShoppingListItem,
  units: "metric" | "imperial",
): UiShoppingListItem {
  if (units !== "imperial") {
    return item as UiShoppingListItem;
  }
  if (item.unit === "kg") {
    return {
      ...item,
      imperialAmount: roundTo(kgToPounds(item.amount), 3),
      imperialUnit: "lb",
    };
  }
  if (item.unit === "L") {
    return {
      ...item,
      imperialAmount: roundTo(litersToGallons(item.amount), 3),
      imperialUnit: "gal",
    };
  }
  if (item.unit === "g") {
    return {
      ...item,
      imperialAmount: roundTo(gramsToOunces(item.amount), 3),
      imperialUnit: "oz",
    };
  }
  // Packets, tsp, tablet, etc. — keep the original; no canonical conversion.
  return item as UiShoppingListItem;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const batchSizeRaw = url.searchParams.get("batchSize");
  const parsedQuery = recipeDetailQuerySchema.safeParse({
    batchSize: batchSizeRaw ?? undefined,
    units: url.searchParams.get("units") ?? undefined,
  });
  if (!parsedQuery.success) return validationError(parsedQuery.error);

  const batchSize =
    parsedQuery.data.batchSize == null
      ? undefined
      : typeof parsedQuery.data.batchSize === "string"
        ? Number.parseFloat(parsedQuery.data.batchSize)
        : parsedQuery.data.batchSize;

  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: RECIPE_INCLUDE,
    });
    if (!recipe) return notFound();

    const units = (parsedQuery.data.units ?? "metric") as "metric" | "imperial";
    const presented = presentRecipe(recipe, { batchSize, units });
    const presentedFermentables =
      (presented.fermentables as FermentableView[] | undefined) ?? [];
    const presentedHops = (presented.hops as HopView[] | undefined) ?? [];
    const presentedYeasts = (presented.yeasts as YeastView[] | undefined) ?? [];
    const presentedAdditions =
      (presented.additions as AdditionView[] | undefined) ?? [];

    const list = buildShoppingList({
      batchSizeLiters: presented.batchSizeLiters as number,
      fermentables: presentedFermentables.map((f) => ({
        name: f.name,
        amountKg: f.amountKg,
        amountLiters: f.amountLiters,
      })),
      hops: presentedHops.map((h) => ({
        name: h.name,
        amountGrams: h.amountGrams,
        use: h.use,
      })),
      yeasts: presentedYeasts.map((y) => ({
        name: y.name,
        form: y.form,
      })),
      additions: presentedAdditions.map((a) => ({
        name: a.name,
        amount: a.amount,
        unit: a.unit,
      })),
    });

    const data = {
      ...list,
      items: list.items.map((item) => withImperial(item, units)),
    };

    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/recipes/[id]/shopping-list failed:", err);
    return internalError();
  }
}
