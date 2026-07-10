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
          title: "Plain Pale",
          fermentables: [{ name: "Pale 2-Row", type: "grain", amountKg: 4 }],
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

  it("filters by ibu range", async () => {
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Mild", targetIbu: 20 }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Bitter", targetIbu: 70 }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );

    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?ibuMin=50&ibuMax=100") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    const body = await readJson<ListResponse>(res);
    expect(body.total).toBe(1);
    expect(body.data[0].title).toBe("Bitter");
  });

  it("filters by srm range", async () => {
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Pale", targetSrm: 3 }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Dark", targetSrm: 35 }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );

    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?srmMin=20&srmMax=80") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    const body = await readJson<ListResponse>(res);
    expect(body.total).toBe(1);
    expect(body.data[0].title).toBe("Dark");
  });

  it("filters by og range", async () => {
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Session", targetOg: 1.04 }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Imperial", targetOg: 1.09 }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );

    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?ogMin=1.07&ogMax=1.12") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    const body = await readJson<ListResponse>(res);
    expect(body.total).toBe(1);
    expect(body.data[0].title).toBe("Imperial");
  });

  it("excludes recipes with null targets when a range is active", async () => {
    // Recipe with a recorded IBU.
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "WithIbu", targetIbu: 40 }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    // Recipe with no IBU recorded (explicitly null on a cider).
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: {
          ...fixtureRecipe({ title: "NoIbu" }),
          category: "cider",
          targetIbu: null,
          targetSrm: null,
        },
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );

    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?ibuMin=20") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    const body = await readJson<ListResponse>(res);
    expect(body.total).toBe(1);
    expect(body.data[0].title).toBe("WithIbu");
  });

  it("stacks a range filter with category and full-text search", async () => {
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({
          title: "Citra IPA",
          category: "beer",
          description: "citrusy",
          targetAbv: 6.5,
          targetIbu: 55,
        }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({
          title: "Citra Session",
          category: "beer",
          description: "easy",
          targetAbv: 4.0,
          targetIbu: 30,
        }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({
          title: "Citra Mead",
          category: "mead",
          description: "honey + citrus",
          targetAbv: 12.0,
          targetIbu: null,
        }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );

    const res = await recipesRoute.GET(
      buildRequest(
        "/api/recipes?q=citra&category=beer&abvMin=5&ibuMin=40",
      ) as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    const body = await readJson<ListResponse>(res);
    expect(body.total).toBe(1);
    expect(body.data[0].title).toBe("Citra IPA");
  });

  it("rejects invalid range bounds (ibuMin > ibuMax)", async () => {
    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?ibuMin=80&ibuMax=20") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    expect(res.status).toBe(400);
  });

  it("rejects range values outside the documented domain", async () => {
    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?srmMin=200") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid query params", async () => {
    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?category=gin") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    expect(res.status).toBe(400);
  });

  it("sorts by name (asc)", async () => {
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Charlie" }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Alpha" }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Bravo" }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );

    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?sort=name&dir=asc") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    const body = await readJson<ListResponse>(res);
    expect(body.data.map((r) => r.title)).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
    ]);
  });

  it("sorts by ABV (desc) — nulls last via id tiebreak", async () => {
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Mild", targetAbv: 4 }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Big", targetAbv: 9 }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    // Insert directly so we can leave targetAbv null; the POST schema disallows
    // null but the Prisma column allows it.
    await db.prisma.recipe.create({
      data: {
        title: "Unknown",
        category: "beer",
        batchSizeLiters: 20,
        targetAbv: null,
      },
    });

    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?sort=abv&dir=desc") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    const body = await readJson<ListResponse>(res);
    expect(body.data[0].title).toBe("Big");
    expect(body.data[1].title).toBe("Mild");
    expect(body.data[2].title).toBe("Unknown");
  });

  it("sorts by IBU (asc)", async () => {
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Bitter", targetIbu: 70 }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Mild", targetIbu: 20 }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );

    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?sort=ibu&dir=asc") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    const body = await readJson<ListResponse>(res);
    expect(body.data.map((r) => r.title)).toEqual(["Mild", "Bitter"]);
  });

  it("sorts by gravity (desc) — nulls last", async () => {
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Imperial", targetOg: 1.09 }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Session", targetOg: 1.04 }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    await db.prisma.recipe.create({
      data: {
        title: "Mystery",
        category: "beer",
        batchSizeLiters: 20,
        targetOg: null,
      },
    });

    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?sort=gravity&dir=desc") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    const body = await readJson<ListResponse>(res);
    expect(body.data[0].title).toBe("Imperial");
    expect(body.data[1].title).toBe("Session");
    expect(body.data[2].title).toBe("Mystery");
  });

  it("sorts by date (asc) — oldest first", async () => {
    const a = await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Alpha" }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    const aBody = await readJson<{ data: { id: string } }>(a);

    // Force a later createdAt by manually updating the row.
    await db.prisma.recipe.update({
      where: { id: aBody.data.id },
      data: { createdAt: new Date("2024-01-01T00:00:00Z") },
    });

    const b = await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Bravo" }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    const bBody = await readJson<{ data: { id: string } }>(b);
    await db.prisma.recipe.update({
      where: { id: bBody.data.id },
      data: { createdAt: new Date("2024-06-01T00:00:00Z") },
    });

    const c = await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Charlie" }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    const cBody = await readJson<{ data: { id: string } }>(c);
    await db.prisma.recipe.update({
      where: { id: cBody.data.id },
      data: { createdAt: new Date("2025-01-01T00:00:00Z") },
    });

    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?sort=date&dir=asc") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    const body = await readJson<ListResponse>(res);
    expect(body.data.map((r) => r.title)).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
    ]);
  });

  it("defaults to date desc when no sort params are given", async () => {
    const a = await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Alpha" }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    const aBody = await readJson<{ data: { id: string } }>(a);
    await db.prisma.recipe.update({
      where: { id: aBody.data.id },
      data: { createdAt: new Date("2024-01-01T00:00:00Z") },
    });
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Bravo" }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );

    const res = await recipesRoute.GET(
      buildRequest("/api/recipes") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    const body = await readJson<ListResponse>(res);
    expect(body.data[0].title).toBe("Bravo");
    expect(body.data[1].title).toBe("Alpha");
  });

  it("combines sort with a range filter", async () => {
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Bitter", targetIbu: 80, targetAbv: 6 }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Session", targetIbu: 20, targetAbv: 4 }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Big", targetIbu: 100, targetAbv: 8 }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );

    const res = await recipesRoute.GET(
      buildRequest(
        "/api/recipes?abvMin=5&abvMax=9&sort=abv&dir=asc",
      ) as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    const body = await readJson<ListResponse>(res);
    expect(body.data.map((r) => r.title)).toEqual(["Bitter", "Big"]);
  });

  it("rejects an unknown sort field", async () => {
    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?sort=banana") as unknown as Parameters<typeof recipesRoute.GET>[0],
    );
    expect(res.status).toBe(400);
  });

  it("rejects an unknown sort direction", async () => {
    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?dir=sideways") as unknown as Parameters<typeof recipesRoute.GET>[0],
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

  // BRE-44: BJCP style-guideline comparison
  async function seedAmericanIpaStyle() {
    await db.prisma.bjcpStyle.upsert({
      where: { code: "21A" },
      create: {
        code: "21A",
        name: "American IPA",
        category: "beer",
        ogMin: 1.06,
        ogMax: 1.07,
        fgMin: 1.01,
        fgMax: 1.015,
        ibuMin: 50,
        ibuMax: 70,
        srmMin: 6,
        srmMax: 14,
        abvMin: 5.5,
        abvMax: 7.5,
      },
      update: {},
    });
  }

  it("attaches a style block when bjcpCategory matches a seeded row", async () => {
    const { id } = await createFixture();
    await seedAmericanIpaStyle();
    const res = await recipeIdRoute.GET(
      buildRequest(`/api/recipes/${id}`) as unknown as Parameters<typeof recipeIdRoute.GET>[0],
      routeCtx(id),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{
      data: {
        style: {
          style: { code: string; name: string } | null;
          comparison: {
            og: { status: string; value: number | null };
            ibu: { status: string };
            allInRange: boolean | null;
            outOfRangeCount: number | null;
          } | null;
        };
      };
    }>(res);
    expect(body.data.style).not.toBeNull();
    expect(body.data.style?.style?.code).toBe("21A");
    expect(body.data.style?.comparison).not.toBeNull();
    // The fixture values (OG 1.06, IBU 60) sit inside the 21A range.
    expect(body.data.style?.comparison?.og.status).toBe("inRange");
    expect(body.data.style?.comparison?.ibu.status).toBe("inRange");
    expect(body.data.style?.comparison?.allInRange).toBe(true);
    expect(body.data.style?.comparison?.outOfRangeCount).toBe(0);
  });

  it("flags out-of-range metrics with status=below/above", async () => {
    // Recipe with an OG far below the 21A range, and an IBU far above.
    const create = await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({
          title: "Weird IPA",
          bjcpCategory: "21A",
          targetOg: 1.04,
          targetIbu: 120,
        }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    const { data: created } = await readJson<CreatedResponse>(create);
    await seedAmericanIpaStyle();
    const res = await recipeIdRoute.GET(
      buildRequest(`/api/recipes/${created.id}`) as unknown as Parameters<typeof recipeIdRoute.GET>[0],
      routeCtx(created.id),
    );
    const body = await readJson<{
      data: {
        style: {
          comparison: {
            og: { status: string };
            ibu: { status: string };
            allInRange: boolean | null;
            outOfRangeCount: number | null;
          } | null;
        };
      };
    }>(res);
    expect(body.data.style?.comparison?.og.status).toBe("below");
    expect(body.data.style?.comparison?.ibu.status).toBe("above");
    expect(body.data.style?.comparison?.allInRange).toBe(false);
    expect(body.data.style?.comparison?.outOfRangeCount).toBe(2);
  });

  it("returns style=null when bjcpCategory is null", async () => {
    // Create a recipe directly via Prisma to bypass the create schema's
    // non-null bjcpCategory constraint. We're testing GET's response
    // shape, not the create path.
    const created = await db.prisma.recipe.create({
      data: {
        title: "No Style",
        category: "beer",
        bjcpCategory: null,
        batchSizeLiters: 20,
        boilTimeMinutes: 60,
        efficiencyPct: 75,
      },
    });
    const res = await recipeIdRoute.GET(
      buildRequest(`/api/recipes/${created.id}`) as unknown as Parameters<typeof recipeIdRoute.GET>[0],
      routeCtx(created.id),
    );
    const body = await readJson<{ data: { style: unknown } }>(res);
    expect(body.data.style).toBeNull();
  });

  it("returns style=null when bjcpCategory is set but unknown", async () => {
    const create = await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ title: "Unknown Style", bjcpCategory: "ZZZ" }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    const { data: created } = await readJson<CreatedResponse>(create);
    const res = await recipeIdRoute.GET(
      buildRequest(`/api/recipes/${created.id}`) as unknown as Parameters<typeof recipeIdRoute.GET>[0],
      routeCtx(created.id),
    );
    const body = await readJson<{ data: { style: unknown } }>(res);
    expect(body.data.style).toBeNull();
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
