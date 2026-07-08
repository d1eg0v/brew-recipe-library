// Integration tests for `GET /api/abv`.
//
// The route is a thin wrapper over the pure `computeMeasuredAbv` function;
// these tests cover the wrapper — input validation, recipe pre-fill, and
// formula override handling — not the math (covered by `abv.test.ts`).

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
let abvRoute: typeof import("@/app/api/abv/route");
let recipesRoute: typeof import("@/app/api/recipes/route");

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  abvRoute = await import("@/app/api/abv/route");
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

interface AbvResultData {
  abvPct: number;
  apparentAttenuationPct: number;
  gravityPointsDropped: number;
  formulaUsed: "linear" | "highGravity";
  isHighGravity: boolean;
  input: {
    measuredOg: number;
    measuredFg: number;
    formula: "auto" | "linear" | "highGravity";
  };
}

interface AbvData {
  result: AbvResultData;
  source: "standalone" | "recipe";
  recipe?: { id: string; title: string; targetOg: number | null; targetFg: number | null };
}

async function readData(res: Response): Promise<AbvData> {
  const body = (await res.json()) as { data: AbvData };
  return body.data;
}

async function createFixtureRecipe(overrides: Record<string, unknown> = {}) {
  const body = {
    title: "Test IPA",
    category: "beer",
    batchSizeLiters: 19,
    targetOg: 1.05,
    targetFg: 1.012,
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

describe("GET /api/abv", () => {
  it("computes ABV from standalone measured gravities using the linear formula", async () => {
    const res = await abvRoute.GET(
      buildRequest("/api/abv?measuredOg=1.052&measuredFg=1.012"),
    );
    expect(res.status).toBe(200);
    const data = await readData(res);
    expect(data.source).toBe("standalone");
    expect(data.recipe).toBeUndefined();
    expect(data.result.abvPct).toBeCloseTo(5.25, 2);
    expect(data.result.formulaUsed).toBe("linear");
    expect(data.result.isHighGravity).toBe(false);
    expect(data.result.gravityPointsDropped).toBe(40);
  });

  it("auto-selects the high-gravity formula at OG ≥ 1.07", async () => {
    const res = await abvRoute.GET(
      buildRequest("/api/abv?measuredOg=1.11&measuredFg=0.998"),
    );
    expect(res.status).toBe(200);
    const data = await readData(res);
    expect(data.result.formulaUsed).toBe("highGravity");
    expect(data.result.abvPct).toBe(16.11);
  });

  it("respects formula=linear at high OG", async () => {
    const res = await abvRoute.GET(
      buildRequest(
        "/api/abv?measuredOg=1.11&measuredFg=0.998&formula=linear",
      ),
    );
    expect(res.status).toBe(200);
    const data = await readData(res);
    expect(data.result.formulaUsed).toBe("linear");
    // (1.11 - 0.998) × 131.25 = 14.7
    expect(data.result.abvPct).toBeCloseTo(14.7, 2);
  });

  it("respects formula=highGravity at low OG", async () => {
    const res = await abvRoute.GET(
      buildRequest(
        "/api/abv?measuredOg=1.05&measuredFg=1.012&formula=highGravity",
      ),
    );
    expect(res.status).toBe(200);
    const data = await readData(res);
    expect(data.result.formulaUsed).toBe("highGravity");
  });

  it("pre-fills OG and FG from a recipe's targets", async () => {
    const id = await createFixtureRecipe({
      title: "Dry Stout",
      targetOg: 1.048,
      targetFg: 1.014,
    });
    const res = await abvRoute.GET(buildRequest(`/api/abv?recipeId=${id}`));
    expect(res.status).toBe(200);
    const data = await readData(res);
    expect(data.source).toBe("recipe");
    expect(data.recipe?.id).toBe(id);
    expect(data.recipe?.title).toBe("Dry Stout");
    expect(data.result.input.measuredOg).toBe(1.048);
    expect(data.result.input.measuredFg).toBe(1.014);
    // (48 - 14) × 131.25 / 1000 = 4.46
    expect(data.result.abvPct).toBeCloseTo(4.46, 2);
  });

  it("caller-provided gravities override the recipe targets", async () => {
    const id = await createFixtureRecipe({
      title: "Imperial Stout",
      targetOg: 1.09,
      targetFg: 1.024,
    });
    const res = await abvRoute.GET(
      buildRequest(
        `/api/abv?recipeId=${id}&measuredOg=1.085&measuredFg=1.022`,
      ),
    );
    expect(res.status).toBe(200);
    const data = await readData(res);
    expect(data.source).toBe("recipe");
    expect(data.result.input.measuredOg).toBe(1.085);
    expect(data.result.input.measuredFg).toBe(1.022);
  });

  it("falls back partially: recipe has only targetOg set", async () => {
    // targetFg omitted entirely on create — only targetOg is set.
    const id = await createFixtureRecipe({
      title: "Session",
      targetOg: 1.038,
      targetFg: undefined,
    });
    const res = await abvRoute.GET(
      buildRequest(`/api/abv?recipeId=${id}&measuredFg=1.011`),
    );
    expect(res.status).toBe(200);
    const data = await readData(res);
    expect(data.result.input.measuredOg).toBe(1.038);
    expect(data.result.input.measuredFg).toBe(1.011);
  });

  it("returns 404 for an unknown recipeId", async () => {
    const res = await abvRoute.GET(
      buildRequest("/api/abv?recipeId=does-not-exist"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when neither recipeId nor both gravities are given", async () => {
    const resNoInput = await abvRoute.GET(buildRequest("/api/abv"));
    expect(resNoInput.status).toBe(400);

    const resOnlyOg = await abvRoute.GET(
      buildRequest("/api/abv?measuredOg=1.05"),
    );
    expect(resOnlyOg.status).toBe(400);

    const resOnlyFg = await abvRoute.GET(
      buildRequest("/api/abv?measuredFg=1.012"),
    );
    expect(resOnlyFg.status).toBe(400);
  });

  it("returns 400 when OG is below FG", async () => {
    const res = await abvRoute.GET(
      buildRequest("/api/abv?measuredOg=1.01&measuredFg=1.02"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for out-of-range gravities", async () => {
    const tooLow = await abvRoute.GET(
      buildRequest("/api/abv?measuredOg=0.9&measuredFg=1.01"),
    );
    expect(tooLow.status).toBe(400);

    const tooHigh = await abvRoute.GET(
      buildRequest("/api/abv?measuredOg=1.05&measuredFg=1.3"),
    );
    expect(tooHigh.status).toBe(400);
  });

  it("returns 400 for an invalid formula value", async () => {
    const res = await abvRoute.GET(
      buildRequest(
        "/api/abv?measuredOg=1.05&measuredFg=1.012&formula=bogus",
      ),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-numeric gravities", async () => {
    const res = await abvRoute.GET(
      buildRequest("/api/abv?measuredOg=abc&measuredFg=1.01"),
    );
    expect(res.status).toBe(400);
  });
});