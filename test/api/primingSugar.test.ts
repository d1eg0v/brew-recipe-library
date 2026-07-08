// Integration tests for `GET /api/priming-sugar`.
//
// The route is a thin wrapper over the pure `computePrimingSugar` function;
// these tests cover the wrapper — input validation, recipe pre-fill, and
// imperial unit surfacing — not the math (covered by `priming.test.ts`).

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
  type TestDatabase,
} from "../helpers/db";

let db: TestDatabase;
let primingSugarRoute: typeof import("@/app/api/priming-sugar/route");
let recipesRoute: typeof import("@/app/api/recipes/route");

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  primingSugarRoute = await import("@/app/api/priming-sugar/route");
  recipesRoute = await import("@/app/api/recipes/route");
});

beforeEach(async () => {
  await db.reset();
});

afterAll(async () => {
  await db.teardown();
});

function buildRequest(url: string) {
  return new Request(new URL(url, "http://localhost"));
}

function baseParams(): string {
  return new URLSearchParams({
    volumeLiters: "20",
    targetVolumes: "2.5",
    temperatureC: "20",
    sugarType: "cornSugar",
  }).toString();
}

interface PrimingSugarData {
  result: {
    weightGrams: number;
    weightOz: number;
    residualVolumes: number;
    volumesToAdd: number;
    sugarType: string;
    input: {
      volumeLiters: number;
      targetVolumes: number;
      temperatureC: number;
      sugarType: string;
    };
  };
  source: "standalone" | "recipe";
  recipe?: { id: string; title: string; batchSizeLiters: number };
  imperial?: { weightOz: number };
}

async function readData(res: Response): Promise<PrimingSugarData> {
  const body = (await res.json()) as { data: PrimingSugarData };
  return body.data;
}

async function createFixtureRecipe(overrides: Record<string, unknown> = {}) {
  const body = {
    title: "Test IPA",
    category: "beer",
    batchSizeLiters: 19,
    fermentables: [{ name: "Pale 2-Row", type: "grain", amountKg: 4.5 }],
    ...overrides,
  };
  const realRes = await recipesRoute.POST(
    new Request("http://localhost/api/recipes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }) as unknown as Parameters<typeof recipesRoute.POST>[0],
  );
  expect(realRes.status).toBe(201);
  const json = (await realRes.json()) as { data: { id: string } };
  return json.data.id;
}

describe("GET /api/priming-sugar", () => {
  it("returns priming-sugar mass for a standalone request", async () => {
    const res = await primingSugarRoute.GET(
      buildRequest(`/api/priming-sugar?${baseParams()}`) as unknown as Parameters<
        typeof primingSugarRoute.GET
      >[0],
    );
    expect(res.status).toBe(200);
    const data = await readData(res);
    expect(data.source).toBe("standalone");
    expect(data.result.weightGrams).toBeGreaterThan(0);
    expect(data.result.residualVolumes).toBeGreaterThan(0);
    expect(data.result.volumesToAdd).toBeGreaterThan(0);
    expect(data.result.sugarType).toBe("cornSugar");
    expect(data.result.input.volumeLiters).toBe(20);
  });

  it("includes imperial ounces when units=imperial", async () => {
    const res = await primingSugarRoute.GET(
      buildRequest(`/api/priming-sugar?${baseParams()}&units=imperial`) as unknown as Parameters<
        typeof primingSugarRoute.GET
      >[0],
    );
    expect(res.status).toBe(200);
    const data = await readData(res);
    expect(data.imperial).toBeDefined();
    expect(data.imperial!.weightOz).toBeGreaterThan(0);
    // Grams → oz is grams / 28.3495.
    expect(data.imperial!.weightOz).toBeCloseTo(
      data.result.weightGrams / 28.3495,
      1,
    );
  });

  it("omits imperial ounces in metric mode", async () => {
    const res = await primingSugarRoute.GET(
      buildRequest(`/api/priming-sugar?${baseParams()}`) as unknown as Parameters<
        typeof primingSugarRoute.GET
      >[0],
    );
    const data = await readData(res);
    expect(data.imperial).toBeUndefined();
  });

  it("pre-fills volume from a recipe when recipeId is provided", async () => {
    const id = await createFixtureRecipe({ batchSizeLiters: 19 });
    const url = new URL("/api/priming-sugar", "http://localhost");
    url.searchParams.set("recipeId", id);
    url.searchParams.set("targetVolumes", "2.5");
    url.searchParams.set("temperatureC", "20");
    url.searchParams.set("sugarType", "tableSugar");
    const res = await primingSugarRoute.GET(
      buildRequest(url.pathname + url.search) as unknown as Parameters<
        typeof primingSugarRoute.GET
      >[0],
    );
    expect(res.status).toBe(200);
    const data = await readData(res);
    expect(data.source).toBe("recipe");
    expect(data.recipe).toBeDefined();
    expect(data.recipe!.id).toBe(id);
    expect(data.result.input.volumeLiters).toBe(19);
  });

  it("a caller-provided volumeLiters wins over the recipe batch size", async () => {
    const id = await createFixtureRecipe({ batchSizeLiters: 19 });
    const url = new URL("/api/priming-sugar", "http://localhost");
    url.searchParams.set("recipeId", id);
    url.searchParams.set("volumeLiters", "12");
    url.searchParams.set("targetVolumes", "2.5");
    url.searchParams.set("temperatureC", "20");
    url.searchParams.set("sugarType", "cornSugar");
    const res = await primingSugarRoute.GET(
      buildRequest(url.pathname + url.search) as unknown as Parameters<
        typeof primingSugarRoute.GET
      >[0],
    );
    const data = await readData(res);
    expect(data.result.input.volumeLiters).toBe(12);
    expect(data.recipe!.batchSizeLiters).toBe(19);
  });

  it("returns 404 for an unknown recipeId", async () => {
    const url = new URL("/api/priming-sugar", "http://localhost");
    url.searchParams.set("recipeId", "does-not-exist");
    url.searchParams.set("targetVolumes", "2.5");
    url.searchParams.set("temperatureC", "20");
    url.searchParams.set("sugarType", "cornSugar");
    const res = await primingSugarRoute.GET(
      buildRequest(url.pathname + url.search) as unknown as Parameters<
        typeof primingSugarRoute.GET
      >[0],
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when volume is missing and no recipeId is given", async () => {
    const url = new URL("/api/priming-sugar", "http://localhost");
    url.searchParams.set("targetVolumes", "2.5");
    url.searchParams.set("temperatureC", "20");
    url.searchParams.set("sugarType", "cornSugar");
    const res = await primingSugarRoute.GET(
      buildRequest(url.pathname + url.search) as unknown as Parameters<
        typeof primingSugarRoute.GET
      >[0],
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid sugarType", async () => {
    const url = new URL("/api/priming-sugar", "http://localhost");
    url.searchParams.set("volumeLiters", "20");
    url.searchParams.set("targetVolumes", "2.5");
    url.searchParams.set("temperatureC", "20");
    url.searchParams.set("sugarType", "honey");
    const res = await primingSugarRoute.GET(
      buildRequest(url.pathname + url.search) as unknown as Parameters<
        typeof primingSugarRoute.GET
      >[0],
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-positive volume", async () => {
    const url = new URL("/api/priming-sugar", "http://localhost");
    url.searchParams.set("volumeLiters", "0");
    url.searchParams.set("targetVolumes", "2.5");
    url.searchParams.set("temperatureC", "20");
    url.searchParams.set("sugarType", "cornSugar");
    const res = await primingSugarRoute.GET(
      buildRequest(url.pathname + url.search) as unknown as Parameters<
        typeof primingSugarRoute.GET
      >[0],
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an out-of-range target volume", async () => {
    const url = new URL("/api/priming-sugar", "http://localhost");
    url.searchParams.set("volumeLiters", "20");
    url.searchParams.set("targetVolumes", "10");
    url.searchParams.set("temperatureC", "20");
    url.searchParams.set("sugarType", "cornSugar");
    const res = await primingSugarRoute.GET(
      buildRequest(url.pathname + url.search) as unknown as Parameters<
        typeof primingSugarRoute.GET
      >[0],
    );
    expect(res.status).toBe(400);
  });

  it("returns 0 grams when the target is already met by residual CO2", async () => {
    // At 0 °C residual ≈ 1.69 volumes; ask for 1.5 → 0 g.
    const url = new URL("/api/priming-sugar", "http://localhost");
    url.searchParams.set("volumeLiters", "20");
    url.searchParams.set("targetVolumes", "1.5");
    url.searchParams.set("temperatureC", "0");
    url.searchParams.set("sugarType", "cornSugar");
    const res = await primingSugarRoute.GET(
      buildRequest(url.pathname + url.search) as unknown as Parameters<
        typeof primingSugarRoute.GET
      >[0],
    );
    const data = await readData(res);
    expect(data.result.weightGrams).toBe(0);
  });
});
