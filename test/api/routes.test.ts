// Integration tests for the recipe API routes.
//
// We mock `@/lib/db` so the route handlers see the test's PrismaClient. Each
// test starts from a clean database via `resetDatabase`.

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";

import {
  setupTestDatabase,
  fixtureRecipe,
  type TestDatabase,
} from "../helpers/db";

interface RecipeRow {
  id: string;
  title: string;
  category: string;
  batchSizeLiters: number;
  [k: string]: unknown;
}

interface CreatedResponse {
  data: RecipeRow & { fermentables: unknown[]; hops: unknown[] };
}

interface ListResponse {
  data: RecipeRow[];
  total: number;
  limit: number;
  offset: number;
}

let db: TestDatabase;

let recipesRoute: typeof import("@/app/api/recipes/route");
let recipeIdRoute: typeof import("@/app/api/recipes/[id]/route");
let cloneRoute: typeof import("@/app/api/recipes/[id]/clone/route");

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  // Re-import after the mock is installed so each module resolves to the
  // mocked prisma client.
  recipesRoute = await import("@/app/api/recipes/route");
  recipeIdRoute = await import("@/app/api/recipes/[id]/route");
  cloneRoute = await import("@/app/api/recipes/[id]/clone/route");
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

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

function routeCtx(id: string) {
  return { params: Promise.resolve({ id }) } as Parameters<
    typeof recipeIdRoute.GET
  >[1];
}

describe("GET /api/recipes", () => {
  it("returns an empty list when no recipes exist", async () => {
    const req = buildRequest("/api/recipes");
    const res = await recipesRoute.GET(req as unknown as Parameters<typeof recipesRoute.GET>[0]);
    expect(res.status).toBe(200);
    const body = await readJson<ListResponse>(res);
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.limit).toBe(50);
    expect(body.offset).toBe(0);
  });

  it("filters by category", async () => {
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "IPA 1", category: "beer" }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Mead 1", category: "mead" }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );

    const beerRes = await recipesRoute.GET(
      buildRequest("/api/recipes?category=beer") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    const beerBody = await readJson<ListResponse>(beerRes);
    expect(beerBody.total).toBe(1);
    expect(beerBody.data[0].title).toBe("IPA 1");
  });

  it("filters by abv range", async () => {
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Low", targetAbv: 4 }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "High", targetAbv: 9 }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );

    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?abvMin=8&abvMax=10") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    const body = await readJson<ListResponse>(res);
    expect(body.total).toBe(1);
    expect(body.data[0].title).toBe("High");
  });

  it("filters by ingredient name across fermentables", async () => {
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({
          title: "Has Munich",
          fermentables: [{ name: "Munich Malt", type: "grain", amountKg: 1 }],
        }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({
          title: "Plain Pale",
          fermentables: [{ name: "Pale 2-Row", type: "grain", amountKg: 4 }],
        }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );

    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?ingredient=Munich") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    const body = await readJson<ListResponse>(res);
    expect(body.total).toBe(1);
    expect(body.data[0].title).toBe("Has Munich");
  });

  it("filters by ingredient name across hops", async () => {
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({
          title: "Citra IPA",
          hops: [{ name: "Citra", amountGrams: 50, timeMinutes: 10, use: "whirlpool" }],
        }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({
          title: "Cascade Pale",
          hops: [{ name: "Cascade", amountGrams: 30, timeMinutes: 60, use: "boil" }],
        }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );

    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?ingredient=Citra") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    const body = await readJson<ListResponse>(res);
    expect(body.total).toBe(1);
    expect(body.data[0].title).toBe("Citra IPA");
  });

  it("filters by ingredient name across yeasts", async () => {
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({
          title: "US-05 Saison",
          yeasts: [{ name: "US-05", form: "dry", attenuationPct: 81 }],
        }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({
          title: "WLP001 Cream Ale",
          yeasts: [{ name: "WLP001", form: "liquid", attenuationPct: 73 }],
        }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );

    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?ingredient=US-05") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    const body = await readJson<ListResponse>(res);
    expect(body.total).toBe(1);
    expect(body.data[0].title).toBe("US-05 Saison");
  });

  it("returns no matches when no recipe contains the ingredient", async () => {
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe(),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );

    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?ingredient=Galaxy") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    const body = await readJson<ListResponse>(res);
    expect(body.total).toBe(0);
    expect(body.data).toEqual([]);
  });

  it("ignores empty / whitespace ingredient params", async () => {
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe(),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );

    const blank = await recipesRoute.GET(
      buildRequest("/api/recipes?ingredient=") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    expect((await readJson<ListResponse>(blank)).total).toBe(1);

    const spaces = await recipesRoute.GET(
      buildRequest("/api/recipes?ingredient=%20%20%20") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    expect((await readJson<ListResponse>(spaces)).total).toBe(1);
  });

  it("rejects invalid query params", async () => {
    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?category=gin") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/recipes", () => {
  it("creates a recipe and returns its id", async () => {
    const res = await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe(),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    expect(res.status).toBe(201);
    const body = await readJson<CreatedResponse>(res);
    expect(body.data.id).toBeTruthy();
    expect(body.data.title).toBe("Test IPA");
    expect(body.data.fermentables).toHaveLength(1);
    expect(body.data.hops).toHaveLength(1);
  });

  it("returns 400 on invalid body", async () => {
    const res = await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: { title: "" },
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when content-type is wrong", async () => {
    const req = new Request("http://localhost/api/recipes", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "whatever",
    });
    const res = await recipesRoute.POST(
      req as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/recipes/[id]", () => {
  async function createFixture() {
    const res = await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe(),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    const body = await readJson<CreatedResponse>(res);
    return body.data;
  }

  it("returns the recipe", async () => {
    const { id } = await createFixture();
    const res = await recipeIdRoute.GET(
      buildRequest(`/api/recipes/${id}`) as unknown as Parameters<typeof recipeIdRoute.GET>[0],
      routeCtx(id),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{ data: { id: string } }>(res);
    expect(body.data.id).toBe(id);
  });

  it("scales the recipe to a new batch size", async () => {
    const { id } = await createFixture();
    const res = await recipeIdRoute.GET(
      buildRequest(`/api/recipes/${id}?batchSize=10`) as unknown as Parameters<typeof recipeIdRoute.GET>[0],
      routeCtx(id),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{ data: { batchSizeLiters: number; fermentables: Array<Record<string, unknown>> } }>(res);
    expect(body.data.batchSizeLiters).toBe(10);
    expect(body.data.fermentables[0].amountKg).toBe(2.25);
  });

  it("adds imperial unit fields when requested", async () => {
    const { id } = await createFixture();
    const res = await recipeIdRoute.GET(
      buildRequest(`/api/recipes/${id}?units=imperial`) as unknown as Parameters<typeof recipeIdRoute.GET>[0],
      routeCtx(id),
    );
    const body = await readJson<{ data: { batchSizeGallons: number; fermentables: Array<Record<string, unknown>> } }>(res);
    expect(body.data.batchSizeGallons).toBeGreaterThan(4);
    expect(body.data.fermentables[0].amountKg).toBe(4.5);
    expect(body.data.fermentables[0].amountLbs).toBeGreaterThan(0);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await recipeIdRoute.GET(
      buildRequest("/api/recipes/does-not-exist") as unknown as Parameters<typeof recipeIdRoute.GET>[0],
      routeCtx("does-not-exist"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for negative batchSize", async () => {
    const { id } = await createFixture();
    const res = await recipeIdRoute.GET(
      buildRequest(`/api/recipes/${id}?batchSize=-1`) as unknown as Parameters<typeof recipeIdRoute.GET>[0],
      routeCtx(id),
    );
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/recipes/[id]", () => {
  it("replaces the recipe including children", async () => {
    const create = await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe(),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    const { data } = await readJson<CreatedResponse>(create);

    const res = await recipeIdRoute.PUT(
      buildRequest(`/api/recipes/${data.id}`, {
        method: "PUT",
        body: {
          ...fixtureRecipe(),
          title: "Renamed IPA",
          fermentables: [
            { name: "Munich", type: "grain", amountKg: 1.0 },
          ],
        },
      }) as unknown as Parameters<typeof recipeIdRoute.PUT>[0],
      routeCtx(data.id),
    );
    expect(res.status).toBe(200);
    const updated = await readJson<{ data: { title: string; fermentables: Array<{ name: string }> } }>(res);
    expect(updated.data.title).toBe("Renamed IPA");
    expect(updated.data.fermentables).toHaveLength(1);
    expect(updated.data.fermentables[0].name).toBe("Munich");
  });
});

describe("PATCH /api/recipes/[id]", () => {
  it("applies a scalar patch", async () => {
    const create = await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe(),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    const { data } = await readJson<CreatedResponse>(create);

    const res = await recipeIdRoute.PATCH(
      buildRequest(`/api/recipes/${data.id}`, {
        method: "PATCH",
        body: { title: "Patched", targetAbv: 7.5 },
      }) as unknown as Parameters<typeof recipeIdRoute.PATCH>[0],
      routeCtx(data.id),
    );
    expect(res.status).toBe(200);
    const updated = await readJson<{ data: { title: string; targetAbv: number } }>(res);
    expect(updated.data.title).toBe("Patched");
    expect(updated.data.targetAbv).toBe(7.5);
  });

  it("rejects an empty body", async () => {
    const create = await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe(),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    const { data } = await readJson<CreatedResponse>(create);

    const res = await recipeIdRoute.PATCH(
      buildRequest(`/api/recipes/${data.id}`, {
        method: "PATCH",
        body: {},
      }) as unknown as Parameters<typeof recipeIdRoute.PATCH>[0],
      routeCtx(data.id),
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/recipes/[id]", () => {
  it("removes the recipe", async () => {
    const create = await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe(),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    const { data } = await readJson<CreatedResponse>(create);

    const res = await recipeIdRoute.DELETE(
      buildRequest(`/api/recipes/${data.id}`, { method: "DELETE" }) as unknown as Parameters<typeof recipeIdRoute.DELETE>[0],
      routeCtx(data.id),
    );
    expect(res.status).toBe(204);

    const getRes = await recipeIdRoute.GET(
      buildRequest(`/api/recipes/${data.id}`) as unknown as Parameters<typeof recipeIdRoute.GET>[0],
      routeCtx(data.id),
    );
    expect(getRes.status).toBe(404);
  });
});

describe("POST /api/recipes/[id]/clone", () => {
  it("creates a deep copy with a suffixed title", async () => {
    const create = await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe(),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    const { data } = await readJson<CreatedResponse>(create);

    const res = await cloneRoute.POST(
      buildRequest(`/api/recipes/${data.id}/clone`, {
        method: "POST",
      }) as unknown as Parameters<typeof cloneRoute.POST>[0],
      { params: Promise.resolve({ id: data.id }) } as Parameters<
        typeof cloneRoute.POST
      >[1],
    );
    expect(res.status).toBe(201);
    const cloneBody = await readJson<{ data: { title: string; id: string; fermentables: unknown[]; hops: unknown[] } }>(res);
    expect(cloneBody.data.title).toBe("Test IPA (copy)");
    expect(cloneBody.data.id).not.toBe(data.id);
    expect(cloneBody.data.fermentables).toHaveLength(1);
    expect(cloneBody.data.hops).toHaveLength(1);
  });
});
