// Integration tests for `GET /api/strike-water`.
//
// The route is a thin wrapper over the pure `computeStrikeWater` function
// plus an optional recipe-grain-bill pre-fill; these tests cover the
// wrapper — input validation, recipe pre-fill, and imperial unit surfacing
// — not the math (covered by `mash.test.ts`).

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
let strikeWaterRoute: typeof import("@/app/api/strike-water/route");
let recipesRoute: typeof import("@/app/api/recipes/route");

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  strikeWaterRoute = await import("@/app/api/strike-water/route");
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
    grainKg: "5",
    targetMashTempC: "67",
    grainTempC: "20",
  }).toString();
}

interface StrikeWaterData {
  result: {
    volumeLiters: number;
    strikeTempC: number;
    waterToGrainRatioLPerKg: number;
    input: {
      grainKg: number;
      targetMashTempC: number;
      grainTempC: number;
      waterToGrainRatioLPerKg: number;
    };
  };
  imperial?: { volumeGallons: number; strikeTempF: number };
  source: "standalone" | "recipe";
  recipe?: { id: string; title: string; grainKg: number };
}

async function readData(res: Response): Promise<StrikeWaterData> {
  const body = (await res.json()) as { data: StrikeWaterData };
  return body.data;
}

async function createFixtureRecipe(
  fermentables: { name: string; type: string; amountKg: number }[],
  overrides: Record<string, unknown> = {},
) {
  const body = {
    title: "Test Pale Ale",
    category: "beer",
    batchSizeLiters: 20,
    fermentables,
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

describe("GET /api/strike-water", () => {
  it("returns strike-water volume + temp for a standalone request", async () => {
    const res = await strikeWaterRoute.GET(
      buildRequest(`/api/strike-water?${baseParams()}`) as unknown as Parameters<
        typeof strikeWaterRoute.GET
      >[0],
    );
    expect(res.status).toBe(200);
    const data = await readData(res);
    expect(data.source).toBe("standalone");
    expect(data.result.volumeLiters).toBeGreaterThan(0);
    expect(data.result.strikeTempC).toBeGreaterThan(0);
    // Default ratio of 3.0 L/kg, 5 kg grain → 15 L.
    expect(data.result.volumeLiters).toBeCloseTo(15, 1);
    // 67 °C target, 20 °C grain, 3.0 L/kg → ~73.3 °C.
    expect(data.result.strikeTempC).toBeCloseTo(73.3, 1);
    expect(data.result.waterToGrainRatioLPerKg).toBe(3.0);
    expect(data.result.input.grainKg).toBe(5);
  });

  it("uses a custom water-to-grain ratio when provided", async () => {
    const url = new URL("/api/strike-water", "http://localhost");
    url.searchParams.set("grainKg", "4");
    url.searchParams.set("targetMashTempC", "65");
    url.searchParams.set("grainTempC", "22");
    url.searchParams.set("waterToGrainRatioLPerKg", "2.5");
    const res = await strikeWaterRoute.GET(
      buildRequest(url.pathname + url.search) as unknown as Parameters<
        typeof strikeWaterRoute.GET
      >[0],
    );
    expect(res.status).toBe(200);
    const data = await readData(res);
    expect(data.result.waterToGrainRatioLPerKg).toBe(2.5);
    // 4 kg × 2.5 L/kg = 10 L.
    expect(data.result.volumeLiters).toBeCloseTo(10, 1);
  });

  it("includes imperial gallons / °F when units=imperial", async () => {
    const res = await strikeWaterRoute.GET(
      buildRequest(
        `/api/strike-water?${baseParams()}&units=imperial`,
      ) as unknown as Parameters<typeof strikeWaterRoute.GET>[0],
    );
    expect(res.status).toBe(200);
    const data = await readData(res);
    expect(data.imperial).toBeDefined();
    expect(data.imperial!.volumeGallons).toBeGreaterThan(0);
    expect(data.imperial!.strikeTempF).toBeGreaterThan(0);
    // Sanity: 15 L → ~3.96 gal.
    expect(data.imperial!.volumeGallons).toBeCloseTo(
      data.result.volumeLiters / 3.785411784,
      2,
    );
    // 73.3 °C → ~163.9 °F.
    expect(data.imperial!.strikeTempF).toBeCloseTo(
      (data.result.strikeTempC * 9) / 5 + 32,
      1,
    );
  });

  it("omits imperial in metric mode", async () => {
    const res = await strikeWaterRoute.GET(
      buildRequest(`/api/strike-water?${baseParams()}`) as unknown as Parameters<
        typeof strikeWaterRoute.GET
      >[0],
    );
    const data = await readData(res);
    expect(data.imperial).toBeUndefined();
  });

  it("pre-fills grain mass from a recipe's grain bill", async () => {
    const id = await createFixtureRecipe([
      { name: "Pale 2-Row", type: "grain", amountKg: 4.5 },
      { name: "Crystal 60L", type: "grain", amountKg: 0.5 },
    ]);
    const url = new URL("/api/strike-water", "http://localhost");
    url.searchParams.set("recipeId", id);
    url.searchParams.set("targetMashTempC", "67");
    url.searchParams.set("grainTempC", "20");
    const res = await strikeWaterRoute.GET(
      buildRequest(url.pathname + url.search) as unknown as Parameters<
        typeof strikeWaterRoute.GET
      >[0],
    );
    expect(res.status).toBe(200);
    const data = await readData(res);
    expect(data.source).toBe("recipe");
    expect(data.recipe).toBeDefined();
    expect(data.recipe!.id).toBe(id);
    expect(data.recipe!.grainKg).toBeCloseTo(5, 3);
    expect(data.result.input.grainKg).toBeCloseTo(5, 3);
  });

  it("a caller-provided grainKg wins over the recipe grain bill", async () => {
    const id = await createFixtureRecipe([
      { name: "Pale 2-Row", type: "grain", amountKg: 4.5 },
    ]);
    const url = new URL("/api/strike-water", "http://localhost");
    url.searchParams.set("recipeId", id);
    url.searchParams.set("grainKg", "7");
    url.searchParams.set("targetMashTempC", "67");
    url.searchParams.set("grainTempC", "20");
    const res = await strikeWaterRoute.GET(
      buildRequest(url.pathname + url.search) as unknown as Parameters<
        typeof strikeWaterRoute.GET
      >[0],
    );
    const data = await readData(res);
    expect(data.result.input.grainKg).toBe(7);
    expect(data.recipe!.grainKg).toBeCloseTo(4.5, 3);
  });

  it("returns 404 for an unknown recipeId", async () => {
    const url = new URL("/api/strike-water", "http://localhost");
    url.searchParams.set("recipeId", "does-not-exist");
    url.searchParams.set("targetMashTempC", "67");
    url.searchParams.set("grainTempC", "20");
    const res = await strikeWaterRoute.GET(
      buildRequest(url.pathname + url.search) as unknown as Parameters<
        typeof strikeWaterRoute.GET
      >[0],
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when grain mass is missing and no recipeId is given", async () => {
    const url = new URL("/api/strike-water", "http://localhost");
    url.searchParams.set("targetMashTempC", "67");
    url.searchParams.set("grainTempC", "20");
    const res = await strikeWaterRoute.GET(
      buildRequest(url.pathname + url.search) as unknown as Parameters<
        typeof strikeWaterRoute.GET
      >[0],
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-positive grain mass", async () => {
    const url = new URL("/api/strike-water", "http://localhost");
    url.searchParams.set("grainKg", "0");
    url.searchParams.set("targetMashTempC", "67");
    url.searchParams.set("grainTempC", "20");
    const res = await strikeWaterRoute.GET(
      buildRequest(url.pathname + url.search) as unknown as Parameters<
        typeof strikeWaterRoute.GET
      >[0],
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an out-of-range target mash temperature", async () => {
    const url = new URL("/api/strike-water", "http://localhost");
    url.searchParams.set("grainKg", "5");
    url.searchParams.set("targetMashTempC", "100");
    url.searchParams.set("grainTempC", "20");
    const res = await strikeWaterRoute.GET(
      buildRequest(url.pathname + url.search) as unknown as Parameters<
        typeof strikeWaterRoute.GET
      >[0],
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an out-of-range grain temperature", async () => {
    const url = new URL("/api/strike-water", "http://localhost");
    url.searchParams.set("grainKg", "5");
    url.searchParams.set("targetMashTempC", "67");
    url.searchParams.set("grainTempC", "-100");
    const res = await strikeWaterRoute.GET(
      buildRequest(url.pathname + url.search) as unknown as Parameters<
        typeof strikeWaterRoute.GET
      >[0],
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an out-of-range water-to-grain ratio", async () => {
    const url = new URL("/api/strike-water", "http://localhost");
    url.searchParams.set("grainKg", "5");
    url.searchParams.set("targetMashTempC", "67");
    url.searchParams.set("grainTempC", "20");
    url.searchParams.set("waterToGrainRatioLPerKg", "10");
    const res = await strikeWaterRoute.GET(
      buildRequest(url.pathname + url.search) as unknown as Parameters<
        typeof strikeWaterRoute.GET
      >[0],
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid units value", async () => {
    const url = new URL("/api/strike-water", "http://localhost");
    url.searchParams.set("grainKg", "5");
    url.searchParams.set("targetMashTempC", "67");
    url.searchParams.set("grainTempC", "20");
    url.searchParams.set("units", "kelvin");
    const res = await strikeWaterRoute.GET(
      buildRequest(url.pathname + url.search) as unknown as Parameters<
        typeof strikeWaterRoute.GET
      >[0],
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when the recipe has an empty grain bill and no grainKg override", async () => {
    // Recipe with no fermentables at all → grain bill mass is 0.
    const id = await createFixtureRecipe([]);
    const url = new URL("/api/strike-water", "http://localhost");
    url.searchParams.set("recipeId", id);
    url.searchParams.set("targetMashTempC", "67");
    url.searchParams.set("grainTempC", "20");
    const res = await strikeWaterRoute.GET(
      buildRequest(url.pathname + url.search) as unknown as Parameters<
        typeof strikeWaterRoute.GET
      >[0],
    );
    expect(res.status).toBe(400);
  });
});