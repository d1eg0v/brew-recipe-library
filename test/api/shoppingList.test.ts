// Integration tests for `GET /api/recipes/[id]/shopping-list`.
//
// Spins up an isolated SQLite DB the same way as `routes.test.ts`, then
// hits the route handler with the mocked `prisma` client.

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

interface ItemRow {
  category: "fermentables" | "hops" | "yeast" | "additions";
  name: string;
  amount: number;
  unit: string;
  detail: string;
  imperialAmount?: number | null;
  imperialUnit?: string | null;
}

interface ResponseBody {
  data: {
    recipeBatchSizeLiters: number;
    items: ItemRow[];
    counts: {
      fermentables: number;
      hops: number;
      yeast: number;
      additions: number;
      total: number;
    };
  };
}

let db: TestDatabase;
let recipesRoute: typeof import("@/app/api/recipes/route");
let shoppingListRoute: typeof import("@/app/api/recipes/[id]/shopping-list/route");

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  recipesRoute = await import("@/app/api/recipes/route");
  shoppingListRoute = await import(
    "@/app/api/recipes/[id]/shopping-list/route"
  );
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

function ctx(id: string) {
  return { params: Promise.resolve({ id }) } as Parameters<
    typeof shoppingListRoute.GET
  >[1];
}

async function createRecipe(overrides: Record<string, unknown> = {}) {
  const req = buildRequest("/api/recipes", {
    method: "POST",
    body: fixtureRecipe(overrides),
  });
  const res = await recipesRoute.POST(
    req as unknown as Parameters<typeof recipesRoute.POST>[0],
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function callShoppingList(url: string, id: string): Promise<Response> {
  return shoppingListRoute.GET(
    buildRequest(url) as unknown as Parameters<typeof shoppingListRoute.GET>[0],
    ctx(id),
  );
}

describe("GET /api/recipes/[id]/shopping-list", () => {
  it("returns a deduplicated list at the original batch size", async () => {
    const id = await createRecipe({
      fermentables: [
        { name: "Pale 2-Row", type: "grain", amountKg: 4.5 },
        { name: "Pale 2-Row", type: "grain", amountKg: 0.5 },
      ],
      hops: [
        { name: "Cascade", amountGrams: 25, timeMinutes: 60, use: "boil" },
        { name: "Cascade", amountGrams: 25, timeMinutes: 60, use: "boil" },
      ],
      additions: [
        { name: "Irish Moss", amount: 1, unit: "tsp", timing: "at 15 min" },
        { name: "Irish Moss", amount: 0.5, unit: "tsp", timing: "at 15 min" },
      ],
    });
    const res = await callShoppingList(
      "/api/recipes/" + id + "/shopping-list",
      id,
    );
    expect(res.status).toBe(200);
    const body = await readJson<ResponseBody>(res);
    expect(body.data.recipeBatchSizeLiters).toBe(20);
    expect(body.data.counts.fermentables).toBe(1);
    expect(body.data.counts.hops).toBe(1);
    expect(body.data.counts.yeast).toBe(1);
    expect(body.data.counts.additions).toBe(1);
    expect(body.data.counts.total).toBe(4);

    const pale = body.data.items.find(
      (i) => i.category === "fermentables" && i.name === "Pale 2-Row",
    );
    expect(pale?.amount).toBeCloseTo(5, 4);
    expect(pale?.unit).toBe("kg");

    const cascade = body.data.items.find((i) => i.category === "hops");
    expect(cascade?.amount).toBeCloseTo(50, 4);
    expect(cascade?.detail).toBe("boil");

    const irish = body.data.items.find((i) => i.category === "additions");
    expect(irish?.amount).toBeCloseTo(1.5, 4);
    expect(irish?.unit).toBe("tsp");
  });

  it("scales ingredient amounts when ?batchSize is supplied", async () => {
    const id = await createRecipe();
    const res = await callShoppingList(
      "/api/recipes/" + id + "/shopping-list?batchSize=40",
      id,
    );
    expect(res.status).toBe(200);
    const body = await readJson<ResponseBody>(res);
    expect(body.data.recipeBatchSizeLiters).toBe(40);
    // Pale 2-Row: 4.5 kg * 2 = 9 kg
    const pale = body.data.items.find(
      (i) => i.name === "Pale 2-Row" && i.category === "fermentables",
    );
    expect(pale?.amount).toBeCloseTo(9, 4);
    // Cascade: 25 g * 2 = 50 g
    const cascade = body.data.items.find((i) => i.name === "Cascade");
    expect(cascade?.amount).toBeCloseTo(50, 4);
    // Yeast: ceil(40/20) = 2 packets
    const yeast = body.data.items.find((i) => i.category === "yeast");
    expect(yeast?.amount).toBe(2);
  });

  it("returns more yeast packets as the batch grows", async () => {
    const id = await createRecipe();
    // 100 L → ceil(100/20) = 5 packets
    const res = await callShoppingList(
      "/api/recipes/" + id + "/shopping-list?batchSize=100",
      id,
    );
    const body = await readJson<ResponseBody>(res);
    const yeast = body.data.items.find((i) => i.category === "yeast")!;
    expect(yeast.amount).toBe(5);
  });

  it("adds imperial equivalent fields when ?units=imperial", async () => {
    const id = await createRecipe();
    const res = await callShoppingList(
      "/api/recipes/" + id + "/shopping-list?units=imperial",
      id,
    );
    const body = await readJson<ResponseBody>(res);
    const pale = body.data.items.find(
      (i) => i.category === "fermentables" && i.name === "Pale 2-Row",
    )!;
    expect(pale.unit).toBe("kg");
    expect(pale.imperialAmount).toBeGreaterThan(0);
    expect(pale.imperialUnit).toBe("lb");

    const cascade = body.data.items.find((i) => i.name === "Cascade")!;
    expect(cascade.unit).toBe("g");
    expect(cascade.imperialUnit).toBe("oz");
  });

  it("leaves free-text units like tsp without an imperial field", async () => {
    const id = await createRecipe({
      additions: [
        { name: "Irish Moss", amount: 1, unit: "tsp", timing: "at 15 min" },
      ],
    });
    const res = await callShoppingList(
      "/api/recipes/" + id + "/shopping-list?units=imperial",
      id,
    );
    const body = await readJson<ResponseBody>(res);
    const irish = body.data.items.find(
      (i) => i.name === "Irish Moss",
    )!;
    expect(irish.unit).toBe("tsp");
    expect(irish.imperialUnit == null).toBe(true);
  });

  it("merges duplicate additions and keeps same-name/different-unit distinct", async () => {
    const id = await createRecipe({
      additions: [
        { name: "Acid Blend", amount: 1, unit: "tsp", purpose: "balance" },
        { name: "Acid Blend", amount: 1.5, unit: "tsp", purpose: "balance" },
        { name: "Acid Blend", amount: 4, unit: "g", purpose: "balance" },
      ],
    });
    const res = await callShoppingList(
      "/api/recipes/" + id + "/shopping-list",
      id,
    );
    const body = await readJson<ResponseBody>(res);
    const acidRows = body.data.items.filter((i) => i.name === "Acid Blend");
    expect(acidRows).toHaveLength(2);
    expect(acidRows.find((a) => a.unit === "tsp")!.amount).toBeCloseTo(2.5, 4);
    expect(acidRows.find((a) => a.unit === "g")!.amount).toBeCloseTo(4, 4);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await callShoppingList(
      "/api/recipes/missing-id/shopping-list",
      "missing-id",
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for a negative batchSize", async () => {
    const id = await createRecipe();
    const res = await callShoppingList(
      "/api/recipes/" + id + "/shopping-list?batchSize=-5",
      id,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid units value", async () => {
    const id = await createRecipe();
    const res = await callShoppingList(
      "/api/recipes/" + id + "/shopping-list?units=parsecs",
      id,
    );
    expect(res.status).toBe(400);
  });

  it("handles a mead recipe (honey + nutrient + campden) end to end", async () => {
    const id = await createRecipe({
      title: "Wildflower Mead",
      category: "mead",
      styleName: "Traditional Mead",
      batchSizeLiters: 20,
      hops: [],
      mashSteps: [],
      fermentables: [
        { name: "Wildflower Honey", type: "honey", amountKg: 5 },
      ],
      yeasts: [
        { name: "Lalvin D-47", form: "dry", attenuationPct: 75 },
      ],
      additions: [
        { name: "Fermaid-O", amount: 9, unit: "g", purpose: "nutrient" },
        { name: "Fermaid-O", amount: 5, unit: "g", purpose: "nutrient" },
        { name: "Campden Tablet", amount: 1, unit: "tablet" },
      ],
    });
    const res = await callShoppingList(
      "/api/recipes/" + id + "/shopping-list",
      id,
    );
    const body = await readJson<ResponseBody>(res);
    expect(body.data.counts.fermentables).toBe(1);
    expect(body.data.counts.hops).toBe(0);
    expect(body.data.counts.total).toBe(4);
    const fermaid = body.data.items.find((i) => i.name === "Fermaid-O")!;
    expect(fermaid.amount).toBeCloseTo(14, 4);
    expect(fermaid.unit).toBe("g");
    const campden = body.data.items.find(
      (i) => i.name === "Campden Tablet",
    )!;
    expect(campden.unit).toBe("tablet");
    expect(campden.amount).toBe(1);
  });
});
