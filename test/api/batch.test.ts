// Integration tests for the Batch CRUD routes.
//
// Spins up an isolated SQLite DB, seeds a recipe via the recipe POST route, and
// then exercises `/api/recipes/[id]/batches` and `/api/batches/[id]` end to end.

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
import {
  actualAbv,
  apparentAttenuation,
  brewhouseEfficiency,
} from "@/lib/brewing/batch";
import {
  computeDerived,
  presentBatch,
} from "@/lib/api/presentBatch";

interface DerivedShape {
  actualAbv: number | null;
  apparentAttenuation: number | null;
  brewhouseEfficiency: number | null;
}

interface BatchResponse {
  data: {
    id: string;
    recipeId: string;
    brewDate: string;
    measuredOg: number | null;
    measuredFg: number | null;
    volumeLiters: number | null;
    notes: string | null;
    derived: DerivedShape;
  };
}

interface BatchListResponse {
  data: BatchResponse["data"][];
}

let db: TestDatabase;
let recipesRoute: typeof import("@/app/api/recipes/route");
let recipeBatchesRoute: typeof import("@/app/api/recipes/[id]/batches/route");
let batchRoute: typeof import("@/app/api/batches/[id]/route");

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  recipesRoute = await import("@/app/api/recipes/route");
  recipeBatchesRoute = await import(
    "@/app/api/recipes/[id]/batches/route"
  );
  batchRoute = await import("@/app/api/batches/[id]/route");
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
  if (init?.body !== undefined) headers["content-type"] = "application/json";
  return new Request(u, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

function recipeCtx(id: string) {
  return { params: Promise.resolve({ id }) } as Parameters<
    typeof recipeBatchesRoute.GET
  >[1];
}

function batchCtx(id: string) {
  return { params: Promise.resolve({ id }) } as Parameters<
    typeof batchRoute.GET
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

async function createBatch(recipeId: string, body: Record<string, unknown>) {
  const res = await recipeBatchesRoute.POST(
    buildRequest(`/api/recipes/${recipeId}/batches`, {
      method: "POST",
      body,
    }) as unknown as Parameters<typeof recipeBatchesRoute.POST>[0],
    recipeCtx(recipeId),
  );
  return res;
}

describe("POST /api/recipes/[id]/batches", () => {
  it("creates a batch and returns 201 with derived metrics", async () => {
    const id = await createRecipe();
    const res = await createBatch(id, {
      brewDate: "2026-05-01T00:00:00.000Z",
      measuredOg: 1.054,
      measuredFg: 1.011,
      volumeLiters: 19,
      notes: "hit numbers",
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as BatchResponse;
    expect(body.data.recipeId).toBe(id);
    expect(body.data.measuredOg).toBe(1.054);
    expect(body.data.derived.actualAbv).toBeCloseTo(actualAbv(1.054, 1.011), 4);
    expect(body.data.derived.apparentAttenuation).toBeCloseTo(
      apparentAttenuation(1.054, 1.011),
      4,
    );
    expect(body.data.derived.brewhouseEfficiency).not.toBeNull();
  });

  it("returns 404 when the recipe does not exist", async () => {
    const res = await createBatch("does-not-exist", {
      brewDate: "2026-05-01T00:00:00.000Z",
    });
    expect(res.status).toBe(404);
  });

  it("rejects an invalid body with 400", async () => {
    const id = await createRecipe();
    const res = await createBatch(id, { measuredOg: 1.05 });
    expect(res.status).toBe(400);
  });

  it("rejects an out-of-range measuredOg with 400", async () => {
    const id = await createRecipe();
    const res = await createBatch(id, {
      brewDate: "2026-05-01T00:00:00.000Z",
      measuredOg: 5,
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/recipes/[id]/batches", () => {
  it("returns batches newest brewDate first", async () => {
    const id = await createRecipe();
    await createBatch(id, { brewDate: "2026-01-01T00:00:00.000Z" });
    await createBatch(id, { brewDate: "2026-03-01T00:00:00.000Z" });
    await createBatch(id, { brewDate: "2026-02-01T00:00:00.000Z" });

    const res = await recipeBatchesRoute.GET(
      buildRequest(`/api/recipes/${id}/batches`) as unknown as Parameters<
        typeof recipeBatchesRoute.GET
      >[0],
      recipeCtx(id),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as BatchListResponse;
    expect(body.data).toHaveLength(3);
    expect(body.data[0]!.brewDate).toBe("2026-03-01T00:00:00.000Z");
    expect(body.data[1]!.brewDate).toBe("2026-02-01T00:00:00.000Z");
    expect(body.data[2]!.brewDate).toBe("2026-01-01T00:00:00.000Z");
  });

  it("returns 404 for an unknown recipe", async () => {
    const res = await recipeBatchesRoute.GET(
      buildRequest(`/api/recipes/missing/batches`) as unknown as Parameters<
        typeof recipeBatchesRoute.GET
      >[0],
      recipeCtx("missing"),
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/batches/[id]", () => {
  it("returns the batch with correct derived math", async () => {
    const id = await createRecipe();
    const created = await createBatch(id, {
      brewDate: "2026-05-01T00:00:00.000Z",
      measuredOg: 1.054,
      measuredFg: 1.011,
      volumeLiters: 19,
    });
    const createdBody = (await created.json()) as BatchResponse;
    const batchId = createdBody.data.id;

    const res = await batchRoute.GET(
      buildRequest(`/api/batches/${batchId}`) as unknown as Parameters<
        typeof batchRoute.GET
      >[0],
      batchCtx(batchId),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as BatchResponse;
    expect(body.data.derived.actualAbv).toBeCloseTo(5.64, 2);
    expect(body.data.derived.apparentAttenuation).toBeCloseTo(79.6, 1);
    expect(body.data.derived.brewhouseEfficiency).not.toBeNull();
  });

  it("returns null derived fields when inputs are missing", async () => {
    const id = await createRecipe();
    const created = await createBatch(id, {
      brewDate: "2026-05-01T00:00:00.000Z",
    });
    const createdBody = (await created.json()) as BatchResponse;
    const batchId = createdBody.data.id;

    const res = await batchRoute.GET(
      buildRequest(`/api/batches/${batchId}`) as unknown as Parameters<
        typeof batchRoute.GET
      >[0],
      batchCtx(batchId),
    );
    const body = (await res.json()) as BatchResponse;
    expect(body.data.derived.actualAbv).toBeNull();
    expect(body.data.derived.apparentAttenuation).toBeNull();
    expect(body.data.derived.brewhouseEfficiency).toBeNull();
  });

  it("returns 404 for an unknown id", async () => {
    const res = await batchRoute.GET(
      buildRequest(`/api/batches/missing`) as unknown as Parameters<
        typeof batchRoute.GET
      >[0],
      batchCtx("missing"),
    );
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/batches/[id]", () => {
  it("updates only supplied fields", async () => {
    const id = await createRecipe();
    const created = await createBatch(id, {
      brewDate: "2026-05-01T00:00:00.000Z",
      measuredOg: 1.05,
      notes: "old",
    });
    const batchId = ((await created.json()) as BatchResponse).data.id;

    const res = await batchRoute.PATCH(
      buildRequest(`/api/batches/${batchId}`, {
        method: "PATCH",
        body: { notes: "new note", measuredFg: 1.012 },
      }) as unknown as Parameters<typeof batchRoute.PATCH>[0],
      batchCtx(batchId),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as BatchResponse;
    expect(body.data.notes).toBe("new note");
    expect(body.data.measuredFg).toBe(1.012);
    expect(body.data.measuredOg).toBe(1.05);
    expect(body.data.derived.actualAbv).toBeCloseTo(actualAbv(1.05, 1.012), 4);
  });

  it("rejects an empty body with 400", async () => {
    const id = await createRecipe();
    const created = await createBatch(id, {
      brewDate: "2026-05-01T00:00:00.000Z",
    });
    const batchId = ((await created.json()) as BatchResponse).data.id;

    const res = await batchRoute.PATCH(
      buildRequest(`/api/batches/${batchId}`, {
        method: "PATCH",
        body: {},
      }) as unknown as Parameters<typeof batchRoute.PATCH>[0],
      batchCtx(batchId),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await batchRoute.PATCH(
      buildRequest(`/api/batches/missing`, {
        method: "PATCH",
        body: { notes: "x" },
      }) as unknown as Parameters<typeof batchRoute.PATCH>[0],
      batchCtx("missing"),
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/batches/[id]", () => {
  it("returns 204 and removes the batch", async () => {
    const id = await createRecipe();
    const created = await createBatch(id, {
      brewDate: "2026-05-01T00:00:00.000Z",
    });
    const batchId = ((await created.json()) as BatchResponse).data.id;

    const res = await batchRoute.DELETE(
      buildRequest(`/api/batches/${batchId}`, {
        method: "DELETE",
      }) as unknown as Parameters<typeof batchRoute.DELETE>[0],
      batchCtx(batchId),
    );
    expect(res.status).toBe(204);

    const after = await batchRoute.GET(
      buildRequest(`/api/batches/${batchId}`) as unknown as Parameters<
        typeof batchRoute.GET
      >[0],
      batchCtx(batchId),
    );
    expect(after.status).toBe(404);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await batchRoute.DELETE(
      buildRequest(`/api/batches/missing`, {
        method: "DELETE",
      }) as unknown as Parameters<typeof batchRoute.DELETE>[0],
      batchCtx("missing"),
    );
    expect(res.status).toBe(404);
  });
});

describe("presentBatch / computeDerived (unit)", () => {
  const now = new Date("2026-05-01T00:00:00.000Z");

  it("returns null derived fields when OG/FG absent", () => {
    const derived = computeDerived(
      { measuredOg: null, measuredFg: null, volumeLiters: 19 },
      [{ type: "grain", amountKg: 4.5 }],
    );
    expect(derived.actualAbv).toBeNull();
    expect(derived.apparentAttenuation).toBeNull();
    expect(derived.brewhouseEfficiency).toBeNull();
  });

  it("returns null efficiency when the grain bill has no amountKg entries", () => {
    const derived = computeDerived(
      { measuredOg: 1.054, measuredFg: 1.011, volumeLiters: 19 },
      [{ type: "honey" }],
    );
    expect(derived.brewhouseEfficiency).toBeNull();
    expect(derived.actualAbv).not.toBeNull();
  });

  it("presentBatch attaches derived block on top of the row", () => {
    const view = presentBatch(
      {
        id: "b1",
        recipeId: "r1",
        brewDate: now,
        measuredOg: 1.054,
        measuredFg: 1.011,
        volumeLiters: 19,
        notes: null,
        createdAt: now,
        updatedAt: now,
      },
      [{ type: "grain", amountKg: 4.5 }],
    );
    expect(view.id).toBe("b1");
    expect(view.derived.actualAbv).toBeCloseTo(actualAbv(1.054, 1.011), 4);
    expect(view.derived.brewhouseEfficiency).toBeCloseTo(
      brewhouseEfficiency(
        [{ type: "grain", amountKg: 4.5 }],
        1.054,
        19,
      ),
      4,
    );
  });
});
