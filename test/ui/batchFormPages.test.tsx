// Server-render tests for the batch (brew-log) create / edit pages.
//
// Exercises the page components end-to-end against the test Prisma
// database: /recipes/[id]/batches/new renders the create form, and
// /recipes/[id]/batches/[batchId]/edit prefills from the stored row.
// We also assert that the "Log a brew" entry point is reachable from
// the recipe page's batch history section.

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

// Stub `next/navigation` so the client `BatchForm` (rendered by these
// server pages) can call `useRouter()` during render-to-string without
// the App Router being mounted.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => undefined,
    refresh: () => undefined,
    back: () => undefined,
    forward: () => undefined,
    replace: () => undefined,
    prefetch: () => undefined,
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

import {
  setupTestDatabase,
  fixtureRecipe,
  type TestDatabase,
} from "../helpers/db";
import type { RecipeDetail, ShoppingList } from "@/lib/ui/types";

let db: TestDatabase;
let recipesRoute: typeof import("@/app/api/recipes/route");
let recipeDetailRoute: typeof import("@/app/api/recipes/[id]/route");
let shoppingListRoute: typeof import("@/app/api/recipes/[id]/shopping-list/route");
let recipeBatchesRoute: typeof import("@/app/api/recipes/[id]/batches/route");
let NewBatchPage: typeof import("@/app/recipes/[id]/batches/new/page")["default"];
let EditBatchPage: typeof import("@/app/recipes/[id]/batches/[batchId]/edit/page")["default"];
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
  const newPage = await import("@/app/recipes/[id]/batches/new/page");
  NewBatchPage = newPage.default;
  const editPage = await import(
    "@/app/recipes/[id]/batches/[batchId]/edit/page"
  );
  EditBatchPage = editPage.default;
  const detailPage = await import("@/app/recipes/[id]/page");
  RecipeDetailPage = detailPage.default;
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
  if (init?.body !== undefined) headers["content-type"] = "application/json";
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

async function createRecipe() {
  const req = buildRequest("/api/recipes", {
    method: "POST",
    body: fixtureRecipe(),
  });
  const res = await recipesRoute.POST(
    req as unknown as Parameters<typeof recipesRoute.POST>[0],
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

async function createBatch(
  recipeId: string,
  body: Record<string, unknown>,
) {
  const res = await recipeBatchesRoute.POST(
    buildRequest(`/api/recipes/${recipeId}/batches`, {
      method: "POST",
      body,
    }) as unknown as Parameters<typeof recipeBatchesRoute.POST>[0],
    recipeBatchesCtx(recipeId),
  );
  expect(res.status).toBe(201);
  const json = (await res.json()) as { data: { id: string } };
  return json.data.id;
}

async function fetchRecipeApi(id: string): Promise<RecipeDetail> {
  const res = await recipeDetailRoute.GET(
    buildRequest(`/api/recipes/${id}`) as unknown as Parameters<
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
    buildRequest(`/api/recipes/${id}/shopping-list`) as unknown as Parameters<
      typeof shoppingListRoute.GET
    >[0],
    listCtx(id),
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { data: ShoppingList };
  return body.data;
}

describe("/recipes/[id]/batches/new", () => {
  it("renders the create form with the page header", async () => {
    const id = await createRecipe();
    const element = await NewBatchPage({ params: Promise.resolve({ id }) });
    const html = renderToStaticMarkup(element);
    expect(html).toContain("Log a brew");
    expect(html).toContain("Brew details");
    expect(html).toContain('data-testid="batch-form-submit"');
    expect(html).toContain("Log this brew");
    // No delete button on the create page.
    expect(html).not.toContain("batch-form-delete");
    // Back-link to the recipe page.
    expect(html).toContain("Back to recipe");
  });

  it("returns notFound for an unknown recipe", async () => {
    await expect(
      NewBatchPage({ params: Promise.resolve({ id: "missing" }) }),
    ).rejects.toThrow();
  });
});

describe("/recipes/[id]/batches/[batchId]/edit", () => {
  it("renders prefilled with the stored batch and exposes a delete button", async () => {
    const id = await createRecipe();
    const batchId = await createBatch(id, {
      brewDate: "2026-05-01T00:00:00.000Z",
      measuredOg: 1.054,
      measuredFg: 1.011,
      volumeLiters: 19,
      notes: "stored notes",
    });
    const element = await EditBatchPage({
      params: Promise.resolve({ id, batchId }),
    });
    const html = renderToStaticMarkup(element);
    // Edit heading.
    expect(html).toContain("Edit brew log");
    // Date is prefilled (the form slices the ISO date).
    expect(html).toContain('value="2026-05-01"');
    // Numeric measurements prefilled.
    expect(html).toContain('value="1.054"');
    expect(html).toContain('value="1.011"');
    expect(html).toContain('value="19"');
    expect(html).toContain("stored notes");
    // Edit-mode submit label + delete button.
    expect(html).toContain("Save changes");
    expect(html).toContain("batch-form-delete");
  });

  it("returns notFound for an unknown batch id", async () => {
    const id = await createRecipe();
    await expect(
      EditBatchPage({ params: Promise.resolve({ id, batchId: "missing" }) }),
    ).rejects.toThrow();
  });

  it("returns notFound when the batch belongs to a different recipe", async () => {
    const recipeA = await createRecipe();
    const recipeB = await createRecipe();
    const batchOfA = await createBatch(recipeA, {
      brewDate: "2026-05-01T00:00:00.000Z",
    });
    // Trying to edit recipe-B's batches with recipe-A's batch id must 404,
    // not silently leak a cross-recipe row.
    await expect(
      EditBatchPage({
        params: Promise.resolve({ id: recipeB, batchId: batchOfA }),
      }),
    ).rejects.toThrow();
  });
});

describe("Recipe detail page exposes 'Log a brew' entry points", () => {
  it("shows the empty-state 'Log a brew' button when there are no batches", async () => {
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
      // The entry point is in the empty-state CTA and links to /batches/new.
      expect(html).toContain("batch-history-new-brew");
      expect(html).toContain(`/recipes/${id}/batches/new`);
    } finally {
      if (original) {
        global.fetch = original;
      } else {
        delete (global as { fetch?: typeof fetch }).fetch;
      }
    }
  });
});
