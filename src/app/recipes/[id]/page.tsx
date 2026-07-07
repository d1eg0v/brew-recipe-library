import { notFound } from "next/navigation";

import RecipeDetailClient from "./RecipeDetailClient";
import type {
  RecipeDetail,
  RecipeDetailResponse,
  ShoppingList,
  ShoppingListResponse,
  UnitSystem,
} from "@/lib/ui/types";

export const dynamic = "force-dynamic";

interface FetchOptions {
  batchSize?: number;
  units?: UnitSystem;
}

async function fetchRecipe(
  id: string,
  options: FetchOptions = {},
): Promise<RecipeDetail | null> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const url = new URL(`/api/recipes/${id}`, base);
  if (options.batchSize != null && Number.isFinite(options.batchSize)) {
    url.searchParams.set("batchSize", String(options.batchSize));
  }
  if (options.units) {
    url.searchParams.set("units", options.units);
  }
  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error("detail fetch failed", res.status, await res.text());
      return null;
    }
    const body = (await res.json()) as RecipeDetailResponse;
    return body.data ?? null;
  } catch (err) {
    console.error("detail fetch error", err);
    return null;
  }
}

async function fetchShoppingList(
  id: string,
  options: FetchOptions = {},
): Promise<ShoppingList | null> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const url = new URL(`/api/recipes/${id}/shopping-list`, base);
  if (options.batchSize != null && Number.isFinite(options.batchSize)) {
    url.searchParams.set("batchSize", String(options.batchSize));
  }
  if (options.units) {
    url.searchParams.set("units", options.units);
  }
  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const body = (await res.json()) as ShoppingListResponse;
    return body.data ?? null;
  } catch {
    return null;
  }
}

function parseBatchSizeParam(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const v = Number.parseFloat(raw);
  if (!Number.isFinite(v) || v <= 0) return undefined;
  return v;
}

function parseUnitsParam(raw: string | undefined): UnitSystem | undefined {
  if (raw === "metric" || raw === "imperial") return raw;
  return undefined;
}

export default async function RecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const batchSizeRaw = Array.isArray(sp.batchSize) ? sp.batchSize[0] : sp.batchSize;
  const unitsRaw = Array.isArray(sp.units) ? sp.units[0] : sp.units;
  const initialBatchSize = parseBatchSizeParam(batchSizeRaw);
  const initialUnits = parseUnitsParam(unitsRaw);

  const recipe = await fetchRecipe(id, {
    batchSize: initialBatchSize,
    units: initialUnits,
  });
  if (!recipe) {
    notFound();
  }
  const initialShoppingList = await fetchShoppingList(id, {
    batchSize: initialBatchSize,
    units: initialUnits,
  });

  return (
    <RecipeDetailClient
      initialRecipe={recipe}
      initialBatchSize={initialBatchSize}
      initialUnits={initialUnits}
      initialShoppingList={initialShoppingList ?? undefined}
    />
  );
}