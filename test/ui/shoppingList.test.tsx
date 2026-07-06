// UI tests for the shopping list experience:
//
//  - ShoppingListSection renders grouped, sorted items with imperial fallbacks
//  - Server render of /recipes/[id] page renders the shopping list section
//    given a fixture recipe and a mock fetch
//
// We mock global fetch so the page's internal calls to
// `/api/recipes/[id]` and `/api/recipes/[id]/shopping-list` are served from
// the test PrismaClient and a canned response, with no live HTTP.

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
import ShoppingListSection from "@/app/recipes/[id]/ShoppingListSection";
import type { ShoppingList, RecipeDetail } from "@/lib/ui/types";

let db: TestDatabase;
let recipesRoute: typeof import("@/app/api/recipes/route");
let recipeDetailRoute: typeof import("@/app/api/recipes/[id]/route");
let shoppingListRoute: typeof import("@/app/api/recipes/[id]/shopping-list/route");
let RecipeDetailPage: typeof import("@/app/recipes/[id]/page")["default"];

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  recipesRoute = await import("@/app/api/recipes/route");
  recipeDetailRoute = await import("@/app/api/recipes/[id]/route");
  shoppingListRoute = await import(
    "@/app/api/recipes/[id]/shopping-list/route"
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

async function createRecipe(overrides: Record<string, unknown> = {}) {
  const baseRecipe = {
    title: "Test IPA",
    category: "beer",
    batchSizeLiters: 20,
    hops: [{ name: "Cascade", amountGrams: 25, timeMinutes: 60, use: "boil" }],
    fermentables: [{ name: "Pale 2-Row", type: "grain", amountKg: 4.5 }],
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

describe("<ShoppingListSection>", () => {
  it("renders one row per aggregated ingredient with the right unit", () => {
    const shoppingList: ShoppingList = {
      recipeBatchSizeLiters: 20,
      items: [
        {
          category: "fermentables",
          name: "Pale 2-Row",
          amount: 4.5,
          unit: "kg",
          detail: "",
        },
        {
          category: "hops",
          name: "Cascade",
          amount: 25,
          unit: "g",
          detail: "boil",
        },
        {
          category: "yeast",
          name: "US-05",
          amount: 1,
          unit: "packets",
          detail: "dry",
        },
        {
          category: "additions",
          name: "Irish Moss",
          amount: 1,
          unit: "tsp",
          detail: "",
        },
      ],
      counts: { fermentables: 1, hops: 1, yeast: 1, additions: 1, total: 4 },
    };

    const html = renderToStaticMarkup(
      <ShoppingListSection
        shoppingList={shoppingList}
        units="metric"
        error={null}
        recipeTitle="Test IPA"
      />,
    );
    expect(html).toContain("Shopping list");
    expect(html).toContain("4 items");
    expect(html).toContain("Fermentables");
    expect(html).toContain("Hops");
    expect(html).toContain("Yeast");
    expect(html).toContain("Additions");
    expect(html).toContain("Pale 2-Row");
    expect(html).toContain("Cascade");
    expect(html).toContain("US-05");
    expect(html).toContain("Irish Moss");
    expect(html).toContain("4.5 kg");
    expect(html).toContain("25 g");
    expect(html).toContain("1 packets");
    expect(html).toContain("1 tsp");
    // Print button is on the screen, print-only header is hidden.
    expect(html).toContain("Print shopping list");
  });

  it("shows imperial values when the row carries them and the unit system is imperial", () => {
    const shoppingList: ShoppingList = {
      recipeBatchSizeLiters: 20,
      items: [
        {
          category: "fermentables",
          name: "Pale 2-Row",
          amount: 4.5,
          unit: "kg",
          detail: "",
          imperialAmount: 9.92,
          imperialUnit: "lb",
        },
      ],
      counts: { fermentables: 1, hops: 0, yeast: 0, additions: 0, total: 1 },
    };
    const html = renderToStaticMarkup(
      <ShoppingListSection
        shoppingList={shoppingList}
        units="imperial"
        error={null}
        recipeTitle="Imperial IPA"
      />,
    );
    // In imperial mode the formatter converts in place — shows the lb
    // value (the API's imperialAmount is a fallback for free-text units).
    expect(html).toContain("9.92 lb");
    expect(html).not.toContain("4.5 kg");
  });

  it("falls back to metric for free-text units like tsp in imperial mode", () => {
    const shoppingList: ShoppingList = {
      recipeBatchSizeLiters: 20,
      items: [
        {
          category: "additions",
          name: "Irish Moss",
          amount: 1,
          unit: "tsp",
          detail: "",
        },
      ],
      counts: { fermentables: 0, hops: 0, yeast: 0, additions: 1, total: 1 },
    };
    const html = renderToStaticMarkup(
      <ShoppingListSection
        shoppingList={shoppingList}
        units="imperial"
        error={null}
        recipeTitle="Mead"
      />,
    );
    expect(html).toContain("1 tsp");
  });

  it("renders an error message when error is set", () => {
    const html = renderToStaticMarkup(
      <ShoppingListSection
        shoppingList={null}
        units="metric"
        error="boom"
        recipeTitle="Err"
      />,
    );
    expect(html).toContain("Couldn&#x27;t reload shopping list");
    expect(html).toContain("boom");
  });

  it("renders an empty state when shoppingList is null", () => {
    const html = renderToStaticMarkup(
      <ShoppingListSection
        shoppingList={null}
        units="metric"
        error={null}
        recipeTitle="None"
      />,
    );
    expect(html).toContain("No shopping list available");
  });

  it("renders nothing-to-buy copy when the recipe has zero ingredients", () => {
    const shoppingList: ShoppingList = {
      recipeBatchSizeLiters: 20,
      items: [],
      counts: { fermentables: 0, hops: 0, yeast: 0, additions: 0, total: 0 },
    };
    const html = renderToStaticMarkup(
      <ShoppingListSection
        shoppingList={shoppingList}
        units="metric"
        error={null}
        recipeTitle="Empty"
      />,
    );
    expect(html).toContain("Nothing to buy");
  });
});

describe("/recipes/[id] page renders the shopping list section", () => {
  it("shows the shopping list pulled from the API alongside the recipe", async () => {
    const id = await createRecipe({
      hops: [{ name: "Cascade", amountGrams: 25, timeMinutes: 60, use: "boil" }],
      additions: [
        { name: "Irish Moss", amount: 1, unit: "tsp", timing: "at 15 min" },
      ],
    });

    // The page fetches via internal HTTP, so mock fetch with the same APIs.
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
      // The shopping list section is rendered.
      expect(html).toContain("Shopping list");
      // Section categories render
      expect(html).toContain("Fermentables");
      expect(html).toContain("Pale 2-Row");
      expect(html).toContain("Irish Moss");
      // The print button shows
      expect(html).toContain("Print shopping list");
    } finally {
      if (original) {
        global.fetch = original;
      } else {
        delete (global as { fetch?: typeof fetch }).fetch;
      }
    }
  });
});

describe("/recipes/[id] ingredient links (BRE-28)", () => {
  it("renders fermentable, hop, and yeast names as links to the filtered browse page", async () => {
    const id = await createRecipe({
      fermentables: [{ name: "Munich Malt", type: "grain", amountKg: 1 }],
      hops: [{ name: "Citra", amountGrams: 30, timeMinutes: 10, use: "whirlpool" }],
      yeasts: [{ name: "US-05", form: "dry", attenuationPct: 81 }],
    });

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
      // Each ingredient name appears as a link to the filtered browse page.
      expect(html).toContain('href="/?ingredient=Munich+Malt"');
      expect(html).toContain('href="/?ingredient=Citra"');
      expect(html).toContain('href="/?ingredient=US-05"');
      // The plain text ingredient name is still in the rendered table cell.
      expect(html).toContain(">Munich Malt<");
      expect(html).toContain(">Citra<");
      expect(html).toContain(">US-05<");
    } finally {
      if (original) {
        global.fetch = original;
      } else {
        delete (global as { fetch?: typeof fetch }).fetch;
      }
    }
  });

  it("renders an empty ingredient name as a dash, not a link", async () => {
    // The API rejects whitespace-only names (Zod's trim().min(1) check),
    // so to exercise the IngredientLink defensive branch we reach into the
    // returned recipe directly and inject an empty fermentable name.
    const id = await createRecipe({
      fermentables: [{ name: "Pale 2-Row", type: "grain", amountKg: 1 }],
    });

    const recipe = await fetchRecipeApi(id);
    const shoppingList = await fetchShoppingListApi(id);
    recipe.fermentables[0].name = "";
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
      // No link produced for an empty fermentable name; a dash placeholder
      // shows in the Fermentables row's Name column instead.
      expect(html).not.toContain("href=\"/?ingredient=\"");
      // Confirm the dash placeholder shows in the Fermentables table row.
      const fermentablesIdx = html.indexOf(">Fermentables <");
      const dashIdx = html.indexOf(
        "<span class=\"text-[var(--muted-foreground)]\">—</span>",
        fermentablesIdx,
      );
      expect(fermentablesIdx).toBeGreaterThanOrEqual(0);
      expect(dashIdx).toBeGreaterThan(fermentablesIdx);
    } finally {
      if (original) {
        global.fetch = original;
      } else {
        delete (global as { fetch?: typeof fetch }).fetch;
      }
    }
  });
});
