// Small client-side helper to assemble a URL to the internal recipe API.
// We hit the relative `/api/...` paths from the same Next.js process; during
// SSR `fetch` with a relative URL resolves against the host the request
// came in on, so we use the supplied `origin` (defaults to empty string,
// which Next.js handles for SSR via `headers()`/internal API routes).

export interface ListRecipesParams {
  q?: string;
  category?: string;
  style?: string;
  bjcpCategory?: string;
  ingredient?: string;
  abvMin?: number;
  abvMax?: number;
  limit?: number;
  offset?: number;
}

export function buildListUrl(
  base: string,
  params: ListRecipesParams = {},
): string {
  const url = new URL("/api/recipes", base || "http://localhost");
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.pathname + (url.search || "");
}

export interface DetailRecipesParams {
  batchSize?: number;
  units?: "metric" | "imperial";
}

export function buildDetailUrl(
  base: string,
  id: string,
  params: DetailRecipesParams = {},
): string {
  const url = new URL(`/api/recipes/${id}`, base || "http://localhost");
  if (params.batchSize != null && Number.isFinite(params.batchSize)) {
    url.searchParams.set("batchSize", String(params.batchSize));
  }
  if (params.units) {
    url.searchParams.set("units", params.units);
  }
  return url.pathname + (url.search || "");
}

export function buildShoppingListUrl(
  base: string,
  id: string,
  params: DetailRecipesParams = {},
): string {
  // The shopping-list route reuses the same ?batchSize=&units= contract as
  // the recipe-detail route so the UI can fetch both with one helper.
  return buildDetailUrl(base, `${id}/shopping-list`, params);
}