// UI tests for the batch history experience:
//
//  - BatchHistorySection renders the column set the DoD calls for
//    (brew date, measured OG/FG/volume, derived ABV/attenuation/efficiency,
//    notes) with proper blanks when fields are null, plus the empty and
//    error states.
//  - Server render of /recipes/[id] page wires the section in via
//    `GET /api/recipes/[id]/batches`, newest first, and surfaces the
//    per-batch `GET /api/batches/[id]` endpoint via the "View" drill-down.
//
// We mock global fetch so the page's internal calls to `/api/recipes/[id]`,
// `/api/recipes/[id]/batches`, and `/api/batches/[id]` are served from the
// test PrismaClient and canned responses, with no live HTTP.

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  setupTestDatabase,
  type TestDatabase,
} from "../helpers/db";
import BatchHistorySection from "@/app/recipes/[id]/BatchHistorySection";
import type { BatchSummary, RecipeDetail, ShoppingList } from "@/lib/ui/types";

let db: TestDatabase;
let recipesRoute: typeof import("@/app/api/recipes/route");
let recipeDetailRoute: typeof import("@/app/api/recipes/[id]/route");
let shoppingListRoute: typeof import("@/app/api/recipes/[id]/shopping-list/route");
let recipeBatchesRoute: typeof import("@/app/api/recipes/[id]/batches/route");
let RecipeDetailPage: typeof import("@/app/recipes/[id]/page")["default"];

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  recipesRoute = await import("@/app/api/recipes/route");
  recipeDetailRoute = await import("@/app/api/recipes/[id]/route");
  shoppingListRoute = await import(
    "@/app/api/recipes/[id]/shopping-list/route"
  );
  recipeBatchesRoute = await import(
    "@/app/api/recipes/[id]/batches/route"
  );
  const pageMod = await import("@/app/recipes/[id]/page");
  RecipeDetailPage = pageMod.default;
});

beforeEach(async () => {
  await db.reset();
});

afterAll(async () => {
  await db.teardown();
});

function buildRequest(url: string, init?: { method?: string; body?: unknown }) {
  const u = new URL(url, "http://localhost");
  const headers: Record<string, string> = {};
  if (init?.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  return new Request(u, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

function detailCtx(id: string) {
  return { params: Promise.resolve({ id }) } as Parameters<
    typeof recipeDetailRoute.GET
  >[1];
}

function listCtx(id: string) {
  return { params: Promise.resolve({ id }) } as Parameters<
    typeof shoppingListRoute.GET
  >[1];
}

function recipeBatchesCtx(id: string) {
  return { params: Promise.resolve({ id }) } as Parameters<
    typeof recipeBatchesRoute.GET
  >[1];
}

async function createRecipe(overrides: Record<string, unknown> = {}) {
  const baseRecipe = {
    title: "Test IPA",
    category: "beer",
    batchSizeLiters: 20,
    fermentables: [{ name: "Pale 2-Row", type: "grain", amountKg: 4.5 }],
    hops: [{ name: "Cascade", amountGrams: 25, timeMinutes: 60, use: "boil" }],
    yeasts: [{ name: "US-05", form: "dry", attenuationPct: 81 }],
    mashSteps: [],
    processSteps: [],
    additions: [],
    ...overrides,
  };
  const res = await recipesRoute.POST(
    buildRequest("/api/recipes", { method: "POST", body: baseRecipe }) as unknown as Parameters<
      typeof recipesRoute.POST
    >[0],
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

async function fetchRecipeApi(id: string): Promise<RecipeDetail> {
  const res = await recipeDetailRoute.GET(
    buildRequest("/api/recipes/" + id) as unknown as Parameters<
      typeof recipeDetailRoute.GET
    >[0],
    detailCtx(id),
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { data: RecipeDetail };
  return body.data;
}

async function fetchShoppingListApi(id: string): Promise<ShoppingList> {
  const res = await shoppingListRoute.GET(
    buildRequest("/api/recipes/" + id + "/shopping-list") as unknown as Parameters<
      typeof shoppingListRoute.GET
    >[0],
    listCtx(id),
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { data: ShoppingList };
  return body.data;
}

async function fetchBatchesApi(id: string): Promise<BatchSummary[]> {
  const res = await recipeBatchesRoute.GET(
    buildRequest("/api/recipes/" + id + "/batches") as unknown as Parameters<
      typeof recipeBatchesRoute.GET
    >[0],
    recipeBatchesCtx(id),
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { data: BatchSummary[] };
  return body.data;
}

async function createBatchApi(
  recipeId: string,
  body: Record<string, unknown>,
): Promise<BatchSummary> {
  const res = await recipeBatchesRoute.POST(
    buildRequest(`/api/recipes/${recipeId}/batches`, {
      method: "POST",
      body,
    }) as unknown as Parameters<typeof recipeBatchesRoute.POST>[0],
    recipeBatchesCtx(recipeId),
  );
  expect(res.status).toBe(201);
  const json = (await res.json()) as { data: BatchSummary };
  return json.data;
}

function makeBatch(overrides: Partial<BatchSummary> = {}): BatchSummary {
  const now = "2026-05-01T00:00:00.000Z";
  return {
    id: "batch1",
    recipeId: "recipe1",
    brewDate: now,
    measuredOg: 1.054,
    measuredFg: 1.011,
    volumeLiters: 19,
    notes: "Hit target numbers — ferment was clean.",
    createdAt: now,
    updatedAt: now,
    derived: {
      actualAbv: 5.6,
      apparentAttenuation: 79.6,
      brewhouseEfficiency: 73.2,
    },
    ...overrides,
  };
}

describe("<BatchHistorySection>", () => {
  it("renders a row per batch with all measured and derived columns", () => {
    const html = renderToStaticMarkup(
      <BatchHistorySection
        recipeId="recipe1"
        batches={[makeBatch()]}
        units="metric"
        error={null}
      />,
    );
    expect(html).toContain("Batch history");
    expect(html).toContain("1 brew");
    expect(html).toContain("Brew date");
    expect(html).toContain("1.054"); // OG
    expect(html).toContain("1.011"); // FG
    expect(html).toContain("19 L"); // volume
    expect(html).toContain("5.6%"); // actual ABV
    expect(html).toContain("79.6%"); // attenuation
    expect(html).toContain("73.2%"); // brewhouse efficiency
    expect(html).toContain("Hit target numbers");
  });

  it("renders the batches in the order supplied (newest first by API contract)", () => {
    const older = makeBatch({
      id: "old",
      brewDate: "2025-12-01T00:00:00.000Z",
      notes: "older brew",
    });
    const newer = makeBatch({
      id: "new",
      brewDate: "2026-06-01T00:00:00.000Z",
      notes: "newer brew",
    });
    const html = renderToStaticMarkup(
      <BatchHistorySection
        recipeId="recipe1"
        batches={[newer, older]}
        units="metric"
        error={null}
      />,
    );
    const newerIdx = html.indexOf("newer brew");
    const olderIdx = html.indexOf("older brew");
    expect(newerIdx).toBeGreaterThan(-1);
    expect(olderIdx).toBeGreaterThan(-1);
    expect(newerIdx).toBeLessThan(olderIdx);
  });

  it("shows blanks (—) for null fields instead of zeros", () => {
    const html = renderToStaticMarkup(
      <BatchHistorySection
        recipeId="recipe1"
        batches={[
          makeBatch({
            id: "partial",
            measuredOg: null,
            measuredFg: null,
            volumeLiters: null,
            notes: null,
            derived: {
              actualAbv: null,
              apparentAttenuation: null,
              brewhouseEfficiency: null,
            },
          }),
        ]}
        units="metric"
        error={null}
      />,
    );
    // Should contain em-dash placeholders, not literal 0 or 0.00.
    expect(html).toContain("—");
    // Make sure the row still renders with no measured/derived values.
    expect(html).toContain("batch-row-partial");
  });

  it("converts the logged volume to gallons in imperial mode", () => {
    const html = renderToStaticMarkup(
      <BatchHistorySection
        recipeId="recipe1"
        batches={[makeBatch({ volumeLiters: 19 })]}
        units="imperial"
        error={null}
      />,
    );
    // 19 L -> 5.02 gal (rounded). Should not also show the metric form.
    expect(html).toContain("5.02 gal");
    expect(html).not.toContain("19.00 L");
  });

  it("truncates long notes with an ellipsis in the row preview", () => {
    const longNotes = "x".repeat(200);
    const html = renderToStaticMarkup(
      <BatchHistorySection
        recipeId="recipe1"
        batches={[makeBatch({ notes: longNotes })]}
        units="metric"
        error={null}
      />,
    );
    expect(html).toContain("…");
    // Should not contain the full 200-character string verbatim.
    expect(html).not.toContain(longNotes);
  });

  it("renders the empty state when there are no batches", () => {
    const html = renderToStaticMarkup(
      <BatchHistorySection
        recipeId="recipe1"
        batches={[]}
        units="metric"
        error={null}
      />,
    );
    expect(html).toContain("batch-history-empty");
    expect(html).toContain("No brews logged for this recipe yet");
  });

  it("renders an error state when error is set", () => {
    const html = renderToStaticMarkup(
      <BatchHistorySection
        recipeId="recipe1"
        batches={[]}
        units="metric"
        error="boom"
      />,
    );
    expect(html).toContain("batch-history-error");
    expect(html).toContain("Couldn&#x27;t reload batch history");
    expect(html).toContain("boom");
  });
});

describe("/recipes/[id] page renders the batch history section", () => {
  it("shows batches pulled from the API in newest-first order", async () => {
    const id = await createRecipe();
    const b1 = await createBatchApi(id, {
      brewDate: "2025-12-01T00:00:00.000Z",
      measuredOg: 1.054,
      measuredFg: 1.012,
      volumeLiters: 19,
      notes: "December brew",
    });
    const b2 = await createBatchApi(id, {
      brewDate: "2026-06-15T00:00:00.000Z",
      measuredOg: 1.06,
      measuredFg: 1.011,
      volumeLiters: 20,
      notes: "June brew",
    });

    const recipe = await fetchRecipeApi(id);
    const shoppingList = await fetchShoppingListApi(id);
    const batches = await fetchBatchesApi(id);

    const original = global.fetch;
    const mock = vi.fn(
      async (input: RequestInfo | URL): Promise<Response> => {
        const url =
          typeof input === "string"
            ? new URL(input)
            : input instanceof URL
              ? input
              : new URL((input as Request).url);
        if (url.pathname === `/api/recipes/${id}`) {
          return new Response(JSON.stringify({ data: recipe }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.pathname === `/api/recipes/${id}/shopping-list`) {
          return new Response(JSON.stringify({ data: shoppingList }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.pathname === `/api/recipes/${id}/batches`) {
          return new Response(JSON.stringify({ data: batches }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (
          url.pathname === `/api/batches/${b2.id}` ||
          url.pathname === `/api/batches/${b1.id}`
        ) {
          return new Response(
            JSON.stringify({
              data: url.pathname === `/api/batches/${b2.id}` ? b2 : b1,
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }
        return new Response("not found", { status: 404 });
      },
    );
    global.fetch = mock as unknown as typeof fetch;
    try {
      const element = await RecipeDetailPage({
        params: Promise.resolve({ id }),
        searchParams: Promise.resolve({}),
      });
      const html = renderToStaticMarkup(element);
      // Section heading + count.
      expect(html).toContain("Batch history");
      expect(html).toContain("2 brews");
      // Both rows render.
      expect(html).toContain("June brew");
      expect(html).toContain("December brew");
      // Newest first: June brew appears before December brew in the markup.
      const juneIdx = html.indexOf("June brew");
      const decIdx = html.indexOf("December brew");
      expect(juneIdx).toBeGreaterThan(-1);
      expect(decIdx).toBeGreaterThan(-1);
      expect(juneIdx).toBeLessThan(decIdx);
      // Drill-down button is rendered for each row (consumes /api/batches/[id]).
      expect(html).toContain(`batch-toggle-${b1.id}`);
      expect(html).toContain(`batch-toggle-${b2.id}`);
    } finally {
      if (original) {
        global.fetch = original;
      } else {
        delete (global as { fetch?: typeof fetch }).fetch;
      }
    }
  });

  it("renders the empty state when the API returns no batches", async () => {
    const id = await createRecipe();
    const recipe = await fetchRecipeApi(id);
    const shoppingList = await fetchShoppingListApi(id);

    const original = global.fetch;
    const mock = vi.fn(
      async (input: RequestInfo | URL): Promise<Response> => {
        const url =
          typeof input === "string"
            ? new URL(input)
            : input instanceof URL
              ? input
              : new URL((input as Request).url);
        if (url.pathname === `/api/recipes/${id}`) {
          return new Response(JSON.stringify({ data: recipe }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.pathname === `/api/recipes/${id}/shopping-list`) {
          return new Response(JSON.stringify({ data: shoppingList }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.pathname === `/api/recipes/${id}/batches`) {
          return new Response(JSON.stringify({ data: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response("not found", { status: 404 });
      },
    );
    global.fetch = mock as unknown as typeof fetch;
    try {
      const element = await RecipeDetailPage({
        params: Promise.resolve({ id }),
        searchParams: Promise.resolve({}),
      });
      const html = renderToStaticMarkup(element);
      expect(html).toContain("batch-history-empty");
      expect(html).toContain("No brews logged for this recipe yet");
    } finally {
      if (original) {
        global.fetch = original;
      } else {
        delete (global as { fetch?: typeof fetch }).fetch;
      }
    }
  });
});
