import { notFound } from "next/navigation";

import RecipeDetailClient from "./RecipeDetailClient";
import type {
  BatchListResponse,
  BatchSummary,
  RecipeDetail,
  RecipeDetailResponse,
  ShoppingList,
  ShoppingListCrossReference,
  ShoppingListResponseWithInventory,
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
): Promise<{ list: ShoppingList | null; crossReference: ShoppingListCrossReference | null }> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const url = new URL(`/api/recipes/${id}/shopping-list`, base);
  if (options.batchSize != null && Number.isFinite(options.batchSize)) {
    url.searchParams.set("batchSize", String(options.batchSize));
  }
  if (options.units) {
    url.searchParams.set("units", options.units);
  }
  // BRE-40: ask the route to layer the on-hand pantry onto the response.
  url.searchParams.set("includeInventory", "true");
  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (res.status === 404) return { list: null, crossReference: null };
    if (!res.ok) return { list: null, crossReference: null };
    const body = (await res.json()) as ShoppingListResponseWithInventory;
    return {
      list: body.data ?? null,
      crossReference: body.data?.crossReference ?? null,
    };
  } catch {
    return { list: null, crossReference: null };
  }
}

async function fetchBatches(
  id: string,
): Promise<{ batches: BatchSummary[]; error: string | null }> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const url = new URL(`/api/recipes/${id}/batches`, base);
  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (res.status === 404) {
      return { batches: [], error: null };
    }
    if (!res.ok) {
      console.error("batches fetch failed", res.status, await res.text());
      return {
        batches: [],
        error: `request failed: ${res.status}`,
      };
    }
    const body = (await res.json()) as BatchListResponse;
    return { batches: body.data ?? [], error: null };
  } catch (err) {
    console.error("batches fetch error", err);
    return {
      batches: [],
      error: err instanceof Error ? err.message : "failed to load batches",
    };
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
  const { list: initialShoppingList, crossReference: initialCrossReference } =
    await fetchShoppingList(id, {
      batchSize: initialBatchSize,
      units: initialUnits,
    });
  const { batches: initialBatches, error: initialBatchesError } =
    await fetchBatches(id);

  return (
    <RecipeDetailClient
      initialRecipe={recipe}
      initialBatchSize={initialBatchSize}
      initialUnits={initialUnits}
      initialShoppingList={initialShoppingList ?? undefined}
      initialCrossReference={initialCrossReference}
      initialBatches={initialBatches}
      initialBatchesError={initialBatchesError}
    />
  );
}
