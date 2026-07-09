// Integration tests for `GET /api/recipes/compare`.
//
// The route returns both recipes in one round trip, validates the pair of
// ids, and surfaces a 404 (with a `missing` hint) when only one slot is
// missing.

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

interface CompareResponse {
  data?: {
    a: { id: string; title: string; category: string };
    b: { id: string; title: string; category: string };
  };
  error?: { message: string; missing?: string };
}

let db: TestDatabase;
let recipesRoute: typeof import("@/app/api/recipes/route");
let compareRoute: typeof import("@/app/api/recipes/compare/route");

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  recipesRoute = await import("@/app/api/recipes/route");
  compareRoute = await import("@/app/api/recipes/compare/route");
});

beforeEach(async () => {
  await db.reset();
});

afterAll(async () => {
  await db.teardown();
});

async function createRecipe(overrides: Record<string, unknown> = {}) {
  const res = await recipesRoute.POST(
    new Request("http://localhost/api/recipes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Test Pale Ale",
        category: "beer",
        batchSizeLiters: 20,
        targetOg: 1.052,
        targetFg: 1.012,
        targetAbv: 5.2,
        targetIbu: 35,
        targetSrm: 5,
        fermentables: [
          { name: "Pale 2-Row", type: "grain", amountKg: 4.5 },
          { name: "Crystal 40", type: "grain", amountKg: 0.4 },
        ],
        hops: [
          { name: "Cascade", amountGrams: 25, timeMinutes: 60, use: "boil" },
        ],
        yeasts: [{ name: "US-05", form: "dry", attenuationPct: 81 }],
        ...overrides,
      }),
    }) as unknown as Parameters<typeof recipesRoute.POST>[0],
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as { data: { id: string; title: string } };
  return body.data;
}

function buildGet(url: string) {
  return new Request(url, { method: "GET" }) as unknown as Parameters<
    typeof compareRoute.GET
  >[0];
}

describe("GET /api/recipes/compare", () => {
  it("returns 400 when a or b is missing", async () => {
    const res = await compareRoute.GET(buildGet("http://localhost/api/recipes/compare?a=only"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/a.*b/i);
  });

  it("returns 400 when a and b are the same id", async () => {
    const recipe = await createRecipe();
    const res = await compareRoute.GET(
      buildGet(
        `http://localhost/api/recipes/compare?a=${recipe.id}&b=${recipe.id}`,
      ),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when neither id exists", async () => {
    const res = await compareRoute.GET(
      buildGet(
        "http://localhost/api/recipes/compare?a=missing-a&b=missing-b",
      ),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 with a missing hint when only one id exists", async () => {
    const recipe = await createRecipe();
    const res = await compareRoute.GET(
      buildGet(
        `http://localhost/api/recipes/compare?a=${recipe.id}&b=missing-b`,
      ),
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { missing?: string } };
    expect(body.error.missing).toBe("b");
  });

  it("returns 200 with both recipes in { a, b } slots", async () => {
    const a = await createRecipe({ title: "Citra IPA" });
    const b = await createRecipe({ title: "Dry Stout" });
    const res = await compareRoute.GET(
      buildGet(
        `http://localhost/api/recipes/compare?a=${a.id}&b=${b.id}`,
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as CompareResponse;
    expect(body.data?.a.title).toBe("Citra IPA");
    expect(body.data?.b.title).toBe("Dry Stout");
    expect(body.data?.a.id).toBe(a.id);
    expect(body.data?.b.id).toBe(b.id);
  });

  it("rejects an out-of-range batchSize", async () => {
    const a = await createRecipe();
    const b = await createRecipe();
    const res = await compareRoute.GET(
      buildGet(
        `http://localhost/api/recipes/compare?a=${a.id}&b=${b.id}&batchSize=-1`,
      ),
    );
    expect(res.status).toBe(400);
  });

  it("accepts a units=imperial query and adds imperial fields", async () => {
    const a = await createRecipe();
    const b = await createRecipe();
    const res = await compareRoute.GET(
      buildGet(
        `http://localhost/api/recipes/compare?a=${a.id}&b=${b.id}&units=imperial`,
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as CompareResponse & {
      data: {
        a: { batchSizeGallons?: number };
        b: { batchSizeGallons?: number };
      };
    };
    expect(body.data.a.batchSizeGallons).toBeCloseTo(5.28, 1);
    expect(body.data.b.batchSizeGallons).toBeCloseTo(5.28, 1);
  });
});
