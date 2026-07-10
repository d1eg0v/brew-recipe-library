// Integration tests for the fermentation-log endpoints (BRE-38).
//
// Covers:
//   - GET  /api/batches/[id]/logs        → 200 list (sorted ascending by date)
//   - POST /api/batches/[id]/logs        → 201 + body returned, 404 unknown batch,
//                                          400 invalid body, 400 batchId mismatch
//   - DELETE /api/batches/[id]/logs/[logId] → 204 success, 404 unknown ids

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

let db: TestDatabase;
let recipesRoute: typeof import("@/app/api/recipes/route");
let recipeBatchesRoute: typeof import("@/app/api/recipes/[id]/batches/route");
let batchLogsRoute: typeof import("@/app/api/batches/[id]/logs/route");
let logItemRoute: typeof import("@/app/api/batches/[id]/logs/[logId]/route");

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  recipesRoute = await import("@/app/api/recipes/route");
  recipeBatchesRoute = await import(
    "@/app/api/recipes/[id]/batches/route"
  );
  batchLogsRoute = await import("@/app/api/batches/[id]/logs/route");
  logItemRoute = await import(
    "@/app/api/batches/[id]/logs/[logId]/route"
  );
});

beforeEach(async () => {
  await db.reset();
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
  if (init?.body !== undefined) headers["content-type"] = "application/json";
  return new Request(u, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

function batchCtx(id: string) {
  return { params: Promise.resolve({ id }) } as Parameters<
    typeof batchLogsRoute.GET
  >[1];
}

function logCtx(batchId: string, logId: string) {
  return { params: Promise.resolve({ id: batchId, logId }) } as Parameters<
    typeof logItemRoute.DELETE
  >[1];
}

interface LogRow {
  id: string;
  recipeId: string;
  batchId: string | null;
  logDate: string;
  type: string;
  gravity: number | null;
  ph: number | null;
  temperatureC: number | null;
  notes: string | null;
}

async function createRecipe() {
  const res = await recipesRoute.POST(
    buildRequest("/api/recipes", {
      method: "POST",
      body: fixtureRecipe(),
    }) as unknown as Parameters<typeof recipesRoute.POST>[0],
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
    { params: Promise.resolve({ id: recipeId }) },
  );
  expect(res.status).toBe(201);
  const payload = (await res.json()) as { data: { id: string } };
  return payload.data.id;
}

describe("POST /api/batches/[id]/logs", () => {
  it("creates a fermentation log entry bound to the batch", async () => {
    const recipeId = await createRecipe();
    const batchId = await createBatch(recipeId, {
      brewDate: "2026-05-01T00:00:00.000Z",
    });
    const res = await batchLogsRoute.POST(
      buildRequest(`/api/batches/${batchId}/logs`, {
        method: "POST",
        body: {
          logDate: "2026-05-04T00:00:00.000Z",
          type: "gravity",
          gravity: 1.04,
          temperatureC: 19.5,
        },
      }) as unknown as Parameters<typeof batchLogsRoute.POST>[0],
      batchCtx(batchId),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: LogRow };
    expect(body.data.recipeId).toBe(recipeId);
    expect(body.data.batchId).toBe(batchId);
    expect(body.data.gravity).toBe(1.04);
    expect(body.data.temperatureC).toBe(19.5);
    expect(body.data.type).toBe("gravity");
  });

  it("returns 404 for an unknown batch", async () => {
    const res = await batchLogsRoute.POST(
      buildRequest(`/api/batches/does-not-exist/logs`, {
        method: "POST",
        body: { gravity: 1.05 },
      }) as unknown as Parameters<typeof batchLogsRoute.POST>[0],
      batchCtx("does-not-exist"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid body", async () => {
    const recipeId = await createRecipe();
    const batchId = await createBatch(recipeId, {
      brewDate: "2026-05-01T00:00:00.000Z",
    });
    const res = await batchLogsRoute.POST(
      buildRequest(`/api/batches/${batchId}/logs`, {
        method: "POST",
        body: { gravity: 5 }, // out of range
      }) as unknown as Parameters<typeof batchLogsRoute.POST>[0],
      batchCtx(batchId),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a body whose batchId disagrees with the URL", async () => {
    const recipeId = await createRecipe();
    const batchId = await createBatch(recipeId, {
      brewDate: "2026-05-01T00:00:00.000Z",
    });
    const res = await batchLogsRoute.POST(
      buildRequest(`/api/batches/${batchId}/logs`, {
        method: "POST",
        body: { batchId: "some-other-batch", gravity: 1.04 },
      }) as unknown as Parameters<typeof batchLogsRoute.POST>[0],
      batchCtx(batchId),
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/batches/[id]/logs", () => {
  it("returns logs sorted ascending by logDate", async () => {
    const recipeId = await createRecipe();
    const batchId = await createBatch(recipeId, {
      brewDate: "2026-05-01T00:00:00.000Z",
    });
    // Insert out of order on purpose.
    await batchLogsRoute.POST(
      buildRequest(`/api/batches/${batchId}/logs`, {
        method: "POST",
        body: { logDate: "2026-05-10T00:00:00.000Z", gravity: 1.015 },
      }) as unknown as Parameters<typeof batchLogsRoute.POST>[0],
      batchCtx(batchId),
    );
    await batchLogsRoute.POST(
      buildRequest(`/api/batches/${batchId}/logs`, {
        method: "POST",
        body: { logDate: "2026-05-05T00:00:00.000Z", gravity: 1.04 },
      }) as unknown as Parameters<typeof batchLogsRoute.POST>[0],
      batchCtx(batchId),
    );
    await batchLogsRoute.POST(
      buildRequest(`/api/batches/${batchId}/logs`, {
        method: "POST",
        body: { logDate: "2026-05-01T00:00:00.000Z", gravity: 1.054 },
      }) as unknown as Parameters<typeof batchLogsRoute.POST>[0],
      batchCtx(batchId),
    );

    const res = await batchLogsRoute.GET(
      buildRequest(`/api/batches/${batchId}/logs`) as unknown as Parameters<
        typeof batchLogsRoute.GET
      >[0],
      batchCtx(batchId),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: LogRow[] };
    expect(body.data).toHaveLength(3);
    expect(body.data[0]!.logDate).toBe("2026-05-01T00:00:00.000Z");
    expect(body.data[1]!.logDate).toBe("2026-05-05T00:00:00.000Z");
    expect(body.data[2]!.logDate).toBe("2026-05-10T00:00:00.000Z");
  });

  it("returns 404 for an unknown batch", async () => {
    const res = await batchLogsRoute.GET(
      buildRequest(`/api/batches/missing/logs`) as unknown as Parameters<
        typeof batchLogsRoute.GET
      >[0],
      batchCtx("missing"),
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/batches/[id]/logs/[logId]", () => {
  it("deletes the entry and returns 204", async () => {
    const recipeId = await createRecipe();
    const batchId = await createBatch(recipeId, {
      brewDate: "2026-05-01T00:00:00.000Z",
    });
    const created = await batchLogsRoute.POST(
      buildRequest(`/api/batches/${batchId}/logs`, {
        method: "POST",
        body: { gravity: 1.05 },
      }) as unknown as Parameters<typeof batchLogsRoute.POST>[0],
      batchCtx(batchId),
    );
    const createdBody = (await created.json()) as { data: LogRow };
    const logId = createdBody.data.id;

    const res = await logItemRoute.DELETE(
      buildRequest(`/api/batches/${batchId}/logs/${logId}`, {
        method: "DELETE",
      }) as unknown as Parameters<typeof logItemRoute.DELETE>[0],
      logCtx(batchId, logId),
    );
    expect(res.status).toBe(204);

    const after = await batchLogsRoute.GET(
      buildRequest(`/api/batches/${batchId}/logs`) as unknown as Parameters<
        typeof batchLogsRoute.GET
      >[0],
      batchCtx(batchId),
    );
    const afterBody = (await after.json()) as { data: LogRow[] };
    expect(afterBody.data).toHaveLength(0);
  });

  it("returns 404 when the log id does not match the batch", async () => {
    const recipeId = await createRecipe();
    const batchId = await createBatch(recipeId, {
      brewDate: "2026-05-01T00:00:00.000Z",
    });
    const res = await logItemRoute.DELETE(
      buildRequest(`/api/batches/${batchId}/logs/nope`, {
        method: "DELETE",
      }) as unknown as Parameters<typeof logItemRoute.DELETE>[0],
      logCtx(batchId, "nope"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when the batch is unknown", async () => {
    const res = await logItemRoute.DELETE(
      buildRequest(`/api/batches/missing/logs/whatever`, {
        method: "DELETE",
      }) as unknown as Parameters<typeof logItemRoute.DELETE>[0],
      logCtx("missing", "whatever"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when the log row exists but belongs to a different batch", async () => {
    const recipeId = await createRecipe();
    const batchA = await createBatch(recipeId, {
      brewDate: "2026-05-01T00:00:00.000Z",
    });
    const batchB = await createBatch(recipeId, {
      brewDate: "2026-06-01T00:00:00.000Z",
    });
    const created = await batchLogsRoute.POST(
      buildRequest(`/api/batches/${batchA}/logs`, {
        method: "POST",
        body: { gravity: 1.05 },
      }) as unknown as Parameters<typeof batchLogsRoute.POST>[0],
      batchCtx(batchA),
    );
    const logId = ((await created.json()) as { data: LogRow }).data.id;

    const res = await logItemRoute.DELETE(
      buildRequest(`/api/batches/${batchB}/logs/${logId}`, {
        method: "DELETE",
      }) as unknown as Parameters<typeof logItemRoute.DELETE>[0],
      logCtx(batchB, logId),
    );
    expect(res.status).toBe(404);
  });
});