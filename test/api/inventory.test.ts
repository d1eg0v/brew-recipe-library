// Integration tests for the inventory CRUD API (BRE-40).
//
// Spins up an isolated SQLite DB the same way as the other route tests,
// mocks `prisma`, then exercises POST / GET / PATCH / DELETE on
// `/api/inventory` and `/api/inventory/[id]`.

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

interface InventoryRow {
  id: string;
  category: string;
  name: string;
  detail: string;
  unit: string;
  amountOnHand: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

let db: TestDatabase;
let inventoryRoute: typeof import("@/app/api/inventory/route");
let inventoryItemRoute: typeof import("@/app/api/inventory/[id]/route");

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  inventoryRoute = await import("@/app/api/inventory/route");
  inventoryItemRoute = await import("@/app/api/inventory/[id]/route");
});

beforeEach(async () => {
  await db.reset();
  // Wipe inventory between tests (not handled by the shared reset helper,
  // since the helper predates the inventory table).
  await db.prisma.inventoryItem.deleteMany();
});

afterAll(async () => {
  await db.teardown();
});

function buildRequest(
  url: string,
  init?: { method?: string; body?: unknown },
) {
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

async function createInventory(
  body: Record<string, unknown>,
): Promise<InventoryRow> {
  const res = await inventoryRoute.POST(
    buildRequest("/api/inventory", { method: "POST", body }) as unknown as Parameters<typeof inventoryRoute.POST>[0],
  );
  expect(res.status).toBe(201);
  const json = (await res.json()) as { data: InventoryRow };
  return json.data;
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) } as Parameters<
    typeof inventoryItemRoute.PATCH
  >[1];
}

describe("POST /api/inventory", () => {
  it("creates a fermentable row and normalises the key fields", async () => {
    const row = await createInventory({
      category: "fermentables",
      name: "Pale 2-Row",
      amountOnHand: 5,
      unit: "kg",
    });
    expect(row).toMatchObject({
      category: "fermentables",
      name: "Pale 2-Row",
      unit: "kg",
      detail: "",
      amountOnHand: 5,
    });

    const fromDb = await db.prisma.inventoryItem.findUnique({
      where: { id: row.id },
    });
    expect(fromDb).not.toBeNull();
    expect(fromDb?.nameNormalized).toBe("pale 2-row");
    expect(fromDb?.unitNormalized).toBe("kg");
    expect(fromDb?.detailNormalized).toBe("");
  });

  it("trims and lower-cases the name, detail, and unit for the unique key", async () => {
    const row = await createInventory({
      category: "hops",
      name: "  Cascade  ",
      detail: "Boil",
      unit: "G",
      amountOnHand: 50,
    });
    expect(row.detail).toBe("Boil");
    expect(row.unit).toBe("G");
    const fromDb = await db.prisma.inventoryItem.findUnique({
      where: { id: row.id },
    });
    expect(fromDb?.nameNormalized).toBe("cascade");
    expect(fromDb?.detailNormalized).toBe("boil");
    expect(fromDb?.unitNormalized).toBe("g");
  });

  it("rejects a duplicate (category, name, detail, unit) with 409", async () => {
    await createInventory({
      category: "fermentables",
      name: "Munich",
      amountOnHand: 1,
      unit: "kg",
    });
    const res = await inventoryRoute.POST(
      buildRequest("/api/inventory", {
        method: "POST",
        body: { category: "fermentables", name: "munich", amountOnHand: 2, unit: "kg" },
      }) as unknown as Parameters<typeof inventoryRoute.POST>[0],
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/already exists/i);
  });

  it("rejects an unknown category with 400", async () => {
    const res = await inventoryRoute.POST(
      buildRequest("/api/inventory", {
        method: "POST",
        body: { category: "rockets", name: "X", amountOnHand: 1, unit: "kg" },
      }) as unknown as Parameters<typeof inventoryRoute.POST>[0],
    );
    expect(res.status).toBe(400);
  });

  it("rejects a negative amountOnHand with 400", async () => {
    const res = await inventoryRoute.POST(
      buildRequest("/api/inventory", {
        method: "POST",
        body: { category: "fermentables", name: "Pale", amountOnHand: -1, unit: "kg" },
      }) as unknown as Parameters<typeof inventoryRoute.POST>[0],
    );
    expect(res.status).toBe(400);
  });

  it("rejects an empty name with 400", async () => {
    const res = await inventoryRoute.POST(
      buildRequest("/api/inventory", {
        method: "POST",
        body: { category: "fermentables", name: "   ", amountOnHand: 1, unit: "kg" },
      }) as unknown as Parameters<typeof inventoryRoute.POST>[0],
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/inventory", () => {
  it("lists all rows ordered by category, name, detail, unit", async () => {
    await createInventory({ category: "yeast", name: "US-05", amountOnHand: 1, unit: "packets", detail: "dry" });
    await createInventory({ category: "fermentables", name: "Munich", amountOnHand: 0.5, unit: "kg" });
    await createInventory({ category: "fermentables", name: "Pale", amountOnHand: 4, unit: "kg" });
    const res = await inventoryRoute.GET(
      buildRequest("/api/inventory") as unknown as Parameters<typeof inventoryRoute.GET>[0],
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: InventoryRow[] };
    expect(body.data.map((r) => r.name)).toEqual(["Munich", "Pale", "US-05"]);
  });

  it("filters by category", async () => {
    await createInventory({ category: "fermentables", name: "Pale", amountOnHand: 1, unit: "kg" });
    await createInventory({ category: "hops", name: "Cascade", amountOnHand: 25, unit: "g", detail: "boil" });
    const res = await inventoryRoute.GET(
      buildRequest("/api/inventory?category=hops") as unknown as Parameters<typeof inventoryRoute.GET>[0],
    );
    const body = (await res.json()) as { data: InventoryRow[] };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].category).toBe("hops");
  });

  it("rejects an unknown category filter with 400", async () => {
    const res = await inventoryRoute.GET(
      buildRequest("/api/inventory?category=rockets") as unknown as Parameters<typeof inventoryRoute.GET>[0],
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/inventory/[id]", () => {
  it("updates amountOnHand and notes", async () => {
    const row = await createInventory({
      category: "fermentables",
      name: "Pale",
      amountOnHand: 1,
      unit: "kg",
    });
    const res = await inventoryItemRoute.PATCH(
      buildRequest(`/api/inventory/${row.id}`, {
        method: "PATCH",
        body: { amountOnHand: 3.5, notes: "lot #123" },
      }) as unknown as Parameters<typeof inventoryItemRoute.PATCH>[0],
      ctx(row.id),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: InventoryRow };
    expect(body.data.amountOnHand).toBe(3.5);
    expect(body.data.notes).toBe("lot #123");
  });

  it("rebuilds the unique key when name/detail/unit change", async () => {
    const row = await createInventory({
      category: "hops",
      name: "Cascade",
      detail: "boil",
      unit: "g",
      amountOnHand: 25,
    });
    const res = await inventoryItemRoute.PATCH(
      buildRequest(`/api/inventory/${row.id}`, {
        method: "PATCH",
        body: { name: "Citra", detail: "whirlpool" },
      }) as unknown as Parameters<typeof inventoryItemRoute.PATCH>[0],
      ctx(row.id),
    );
    expect(res.status).toBe(200);
    const fromDb = await db.prisma.inventoryItem.findUnique({
      where: { id: row.id },
    });
    expect(fromDb?.name).toBe("Citra");
    expect(fromDb?.nameNormalized).toBe("citra");
    expect(fromDb?.detail).toBe("whirlpool");
    expect(fromDb?.detailNormalized).toBe("whirlpool");
  });

  it("rejects a PATCH that would collide with another row's key with 409", async () => {
    await createInventory({
      category: "fermentables",
      name: "Munich",
      amountOnHand: 1,
      unit: "kg",
    });
    const target = await createInventory({
      category: "fermentables",
      name: "Vienna",
      amountOnHand: 1,
      unit: "kg",
    });
    const res = await inventoryItemRoute.PATCH(
      buildRequest(`/api/inventory/${target.id}`, {
        method: "PATCH",
        body: { name: "Munich" },
      }) as unknown as Parameters<typeof inventoryItemRoute.PATCH>[0],
      ctx(target.id),
    );
    expect(res.status).toBe(409);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await inventoryItemRoute.PATCH(
      buildRequest("/api/inventory/missing-id", {
        method: "PATCH",
        body: { amountOnHand: 1 },
      }) as unknown as Parameters<typeof inventoryItemRoute.PATCH>[0],
      ctx("missing-id"),
    );
    expect(res.status).toBe(404);
  });

  it("rejects an empty patch body with 400", async () => {
    const row = await createInventory({
      category: "fermentables",
      name: "Pale",
      amountOnHand: 1,
      unit: "kg",
    });
    const res = await inventoryItemRoute.PATCH(
      buildRequest(`/api/inventory/${row.id}`, {
        method: "PATCH",
        body: {},
      }) as unknown as Parameters<typeof inventoryItemRoute.PATCH>[0],
      ctx(row.id),
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/inventory/[id]", () => {
  it("removes a row and returns 204", async () => {
    const row = await createInventory({
      category: "fermentables",
      name: "Pale",
      amountOnHand: 1,
      unit: "kg",
    });
    const res = await inventoryItemRoute.DELETE(
      buildRequest(`/api/inventory/${row.id}`, {
        method: "DELETE",
      }) as unknown as Parameters<typeof inventoryItemRoute.DELETE>[0],
      ctx(row.id),
    );
    expect(res.status).toBe(204);
    const fromDb = await db.prisma.inventoryItem.findUnique({
      where: { id: row.id },
    });
    expect(fromDb).toBeNull();
  });

  it("returns 404 for an unknown id", async () => {
    const res = await inventoryItemRoute.DELETE(
      buildRequest("/api/inventory/missing-id", {
        method: "DELETE",
      }) as unknown as Parameters<typeof inventoryItemRoute.DELETE>[0],
      ctx("missing-id"),
    );
    expect(res.status).toBe(404);
  });
});