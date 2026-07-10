// Integration tests for `GET /api/recipes/[id]/shopping-list?includeInventory=true` (BRE-40).
//
// Verifies the route layers the brewer's pantry on top of the recipe shopping
// list. Stands up an isolated SQLite DB, creates a recipe + a few inventory
// rows, and asserts the cross-reference counts + status flags.

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

interface CrossRow {
  category: string;
  name: string;
  amount: number;
  unit: string;
  detail: string;
  onHand: number;
  stillNeed: number;
  status: "full" | "partial" | "missing";
  matchedInventoryIds: string[];
}

interface ShoppingListResponse {
  data: {
    recipeBatchSizeLiters: number;
    items: Array<{
      category: string;
      name: string;
      amount: number;
      unit: string;
      detail: string;
    }>;
    counts: { fermentables: number; hops: number; yeast: number; additions: number; total: number };
    crossReference?: {
      rows: CrossRow[];
      counts: { total: number; full: number; partial: number; missing: number; toBuy: number };
    };
  };
}

let db: TestDatabase;
let recipesRoute: typeof import("@/app/api/recipes/route");
let shoppingListRoute: typeof import("@/app/api/recipes/[id]/shopping-list/route");
let inventoryRoute: typeof import("@/app/api/inventory/route");

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  recipesRoute = await import("@/app/api/recipes/route");
  shoppingListRoute = await import("@/app/api/recipes/[id]/shopping-list/route");
  inventoryRoute = await import("@/app/api/inventory/route");
});

beforeEach(async () => {
  await db.reset();
  await db.prisma.inventoryItem.deleteMany();
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

async function createRecipe(overrides: Record<string, unknown> = {}): Promise<string> {
  const res = await recipesRoute.POST(
    buildRequest("/api/recipes", { method: "POST", body: fixtureRecipe(overrides) }) as unknown as Parameters<typeof recipesRoute.POST>[0],
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

async function addInventory(body: Record<string, unknown>) {
  const res = await inventoryRoute.POST(
    buildRequest("/api/inventory", { method: "POST", body }) as unknown as Parameters<typeof inventoryRoute.POST>[0],
  );
  expect(res.status).toBe(201);
  return (await res.json()) as { data: { id: string } };
}

async function callShoppingList(
  id: string,
  query: string,
): Promise<ShoppingListResponse> {
  const res = await shoppingListRoute.GET(
    buildRequest(`/api/recipes/${id}/shopping-list${query}`) as unknown as Parameters<typeof shoppingListRoute.GET>[0],
    ctx(id),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as ShoppingListResponse;
}

describe("GET /api/recipes/[id]/shopping-list?includeInventory=true (BRE-40)", () => {
  it("omits crossReference when the param is absent", async () => {
    const id = await createRecipe();
    const body = await callShoppingList(id, "");
    expect(body.data.crossReference).toBeUndefined();
  });

  it("returns an all-missing crossReference when inventory is empty", async () => {
    const id = await createRecipe();
    const body = await callShoppingList(id, "?includeInventory=true");
    expect(body.data.crossReference).toBeDefined();
    const cr = body.data.crossReference!;
    expect(cr.counts.total).toBe(body.data.items.length);
    expect(cr.counts.full).toBe(0);
    expect(cr.counts.missing).toBe(cr.counts.total);
    expect(cr.counts.toBuy).toBe(cr.counts.total);
    for (const row of cr.rows) {
      expect(row.status).toBe("missing");
      expect(row.onHand).toBe(0);
      expect(row.stillNeed).toBeCloseTo(row.amount, 4);
    }
  });

  it("classifies rows as full / partial / missing", async () => {
    const id = await createRecipe();
    // Pale 2-Row 4.5 kg required. Stock 6 kg → full.
    await addInventory({ category: "fermentables", name: "Pale 2-Row", amountOnHand: 6, unit: "kg" });
    // Cascade 25 g required. Stock 10 g → partial.
    await addInventory({ category: "hops", name: "Cascade", amountOnHand: 10, unit: "g", detail: "boil" });
    // US-05 1 packet required. No stock → missing.
    const body = await callShoppingList(id, "?includeInventory=true");
    const cr = body.data.crossReference!;
    expect(cr.counts.full).toBe(1);
    expect(cr.counts.partial).toBe(1);
    expect(cr.counts.missing).toBeGreaterThanOrEqual(1);
    expect(cr.counts.toBuy).toBe(cr.counts.partial + cr.counts.missing);

    const pale = cr.rows.find((r) => r.name === "Pale 2-Row")!;
    expect(pale.status).toBe("full");
    expect(pale.onHand).toBeCloseTo(6, 4);
    expect(pale.stillNeed).toBe(0);
    expect(pale.matchedInventoryIds).toHaveLength(1);

    const cascade = cr.rows.find((r) => r.name === "Cascade")!;
    expect(cascade.status).toBe("partial");
    expect(cascade.onHand).toBeCloseTo(10, 4);
    expect(cascade.stillNeed).toBeCloseTo(15, 4);

    const yeast = cr.rows.find((r) => r.category === "yeast")!;
    expect(yeast.status).toBe("missing");
    expect(yeast.onHand).toBe(0);
  });

  it("clamps stillNeed to zero when onHand overshoots required", async () => {
    const id = await createRecipe();
    await addInventory({ category: "fermentables", name: "Pale 2-Row", amountOnHand: 99, unit: "kg" });
    const body = await callShoppingList(id, "?includeInventory=true");
    const pale = body.data.crossReference!.rows.find(
      (r) => r.name === "Pale 2-Row",
    )!;
    expect(pale.status).toBe("full");
    expect(pale.stillNeed).toBe(0);
  });

  it("matches inventory rows case-insensitively", async () => {
    const id = await createRecipe();
    await addInventory({ category: "hops", name: "  cascade  ", amountOnHand: 25, unit: "G", detail: "BOIL" });
    const body = await callShoppingList(id, "?includeInventory=true");
    const cascade = body.data.crossReference!.rows.find(
      (r) => r.name === "Cascade",
    )!;
    expect(cascade.status).toBe("full");
  });

  it("does not cross-match different detail or unit", async () => {
    const id = await createRecipe();
    await addInventory({ category: "hops", name: "Cascade", amountOnHand: 100, unit: "g", detail: "dryHop" });
    await addInventory({ category: "hops", name: "Cascade", amountOnHand: 100, unit: "oz", detail: "boil" });
    const body = await callShoppingList(id, "?includeInventory=true");
    const boilCascade = body.data.crossReference!.rows.find(
      (r) => r.name === "Cascade" && r.detail === "boil",
    )!;
    expect(boilCascade.status).toBe("missing");
    expect(boilCascade.onHand).toBe(0);
  });

  it("recomputes the cross-reference when ?batchSize changes the shopping list", async () => {
    const id = await createRecipe();
    await addInventory({ category: "fermentables", name: "Pale 2-Row", amountOnHand: 5, unit: "kg" });
    // Default 20 L batch → 4.5 kg required → full.
    const small = await callShoppingList(id, "?includeInventory=true");
    const smallPale = small.data.crossReference!.rows.find(
      (r) => r.name === "Pale 2-Row",
    )!;
    expect(smallPale.status).toBe("full");

    // 40 L batch → 9 kg required → partial (need 4 more).
    const big = await callShoppingList(id, "?batchSize=40&includeInventory=true");
    const bigPale = big.data.crossReference!.rows.find(
      (r) => r.name === "Pale 2-Row",
    )!;
    expect(bigPale.status).toBe("partial");
    expect(bigPale.stillNeed).toBeCloseTo(4, 4);
  });
});