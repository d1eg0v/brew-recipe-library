// Integration tests for the share-link routes (BRE-43).
//
// We mock `@/lib/db` so the route handlers see the test's PrismaClient. Each
// test starts from a clean database via `resetDatabase`. The share-token route
// is exercised end-to-end: enable, read, disable, error paths.

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

interface ShareResponse {
  data: {
    shareable: boolean;
    shareUrl: string | null;
    shareToken: string | null;
  };
}

let db: TestDatabase;
let shareRoute: typeof import("@/app/api/recipes/[id]/share/route");

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  shareRoute = await import("@/app/api/recipes/[id]/share/route");
});

beforeEach(async () => {
  await db.reset();
});

afterAll(async () => {
  await db.teardown();
});

function buildRequest(url: string, init?: { method?: string }) {
  const u = new URL(url, "http://localhost");
  return new Request(u, { method: init?.method ?? "GET" });
}

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

function routeCtx(id: string) {
  return {
    params: Promise.resolve({ id }),
  } as unknown as Parameters<typeof shareRoute.GET>[1];
}

async function createRecipe() {
  const recipe = await db.prisma.recipe.create({
    data: { title: "Test IPA", category: "beer", batchSizeLiters: 20 },
  });
  return recipe.id;
}

describe("GET /api/recipes/[id]/share", () => {
  it("returns shareable=false when no token is set", async () => {
    const id = await createRecipe();
    const res = await shareRoute.GET(
      buildRequest(`/api/recipes/${id}/share`) as unknown as Parameters<
        typeof shareRoute.GET
      >[0],
      routeCtx(id),
    );
    expect(res.status).toBe(200);
    const body = await readJson<ShareResponse>(res);
    expect(body.data).toEqual({
      shareable: false,
      shareUrl: null,
      shareToken: null,
    });
  });

  it("returns 404 for an unknown recipe", async () => {
    const res = await shareRoute.GET(
      buildRequest("/api/recipes/missing/share") as unknown as Parameters<
        typeof shareRoute.GET
      >[0],
      routeCtx("missing"),
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/recipes/[id]/share", () => {
  it("issues a new token and returns 201 with the URL", async () => {
    const id = await createRecipe();
    const res = await shareRoute.POST(
      buildRequest(`/api/recipes/${id}/share`, { method: "POST" }) as unknown as Parameters<
        typeof shareRoute.POST
      >[0],
      routeCtx(id),
    );
    expect(res.status).toBe(201);
    const body = await readJson<ShareResponse>(res);
    expect(body.data.shareable).toBe(true);
    expect(body.data.shareToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    // Default fallback origin is "http://localhost:3000" when no Origin
    // header is present.
    expect(body.data.shareUrl).toBe(
      `http://localhost:3000/share/${body.data.shareToken}`,
    );

    // And it actually persisted.
    const stored = await db.prisma.recipe.findUnique({
      where: { id },
      select: { shareToken: true },
    });
    expect(stored?.shareToken).toBe(body.data.shareToken);
  });

  it("is idempotent: a second POST returns the existing token (200)", async () => {
    const id = await createRecipe();
    const first = await shareRoute.POST(
      buildRequest(`/api/recipes/${id}/share`, { method: "POST" }) as unknown as Parameters<
        typeof shareRoute.POST
      >[0],
      routeCtx(id),
    );
    const firstBody = await readJson<ShareResponse>(first);

    const second = await shareRoute.POST(
      buildRequest(`/api/recipes/${id}/share`, { method: "POST" }) as unknown as Parameters<
        typeof shareRoute.POST
      >[0],
      routeCtx(id),
    );
    const secondBody = await readJson<ShareResponse>(second);
    expect(second.status).toBe(200);
    expect(secondBody.data.shareToken).toBe(firstBody.data.shareToken);
  });

  it("honours the Origin header when present", async () => {
    const id = await createRecipe();
    const req = new Request(
      new URL(`/api/recipes/${id}/share`, "http://localhost"),
      {
        method: "POST",
        headers: { origin: "https://brew.example.com" },
      },
    );
    const res = await shareRoute.POST(
      req as unknown as Parameters<typeof shareRoute.POST>[0],
      routeCtx(id),
    );
    const body = await readJson<ShareResponse>(res);
    expect(body.data.shareUrl).toBe(
      `https://brew.example.com/share/${body.data.shareToken}`,
    );
  });

  it("mints distinct tokens for distinct recipes", async () => {
    const a = await createRecipe();
    const b = await db.prisma.recipe.create({
      data: { title: "Other", category: "beer", batchSizeLiters: 19 },
      select: { id: true },
    });
    const resA = await shareRoute.POST(
      buildRequest(`/api/recipes/${a}/share`, { method: "POST" }) as unknown as Parameters<
        typeof shareRoute.POST
      >[0],
      routeCtx(a),
    );
    const resB = await shareRoute.POST(
      buildRequest(`/api/recipes/${b.id}/share`, { method: "POST" }) as unknown as Parameters<
        typeof shareRoute.POST
      >[0],
      routeCtx(b.id),
    );
    const tokenA = (await readJson<ShareResponse>(resA)).data.shareToken;
    const tokenB = (await readJson<ShareResponse>(resB)).data.shareToken;
    expect(tokenA).not.toBe(tokenB);
  });

  it("returns 404 for an unknown recipe", async () => {
    const res = await shareRoute.POST(
      buildRequest("/api/recipes/missing/share", { method: "POST" }) as unknown as Parameters<
        typeof shareRoute.POST
      >[0],
      routeCtx("missing"),
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/recipes/[id]/share", () => {
  it("clears an existing token", async () => {
    const id = await createRecipe();
    await shareRoute.POST(
      buildRequest(`/api/recipes/${id}/share`, { method: "POST" }) as unknown as Parameters<
        typeof shareRoute.POST
      >[0],
      routeCtx(id),
    );

    const del = await shareRoute.DELETE(
      buildRequest(`/api/recipes/${id}/share`, { method: "DELETE" }) as unknown as Parameters<
        typeof shareRoute.DELETE
      >[0],
      routeCtx(id),
    );
    expect(del.status).toBe(204);

    const get = await shareRoute.GET(
      buildRequest(`/api/recipes/${id}/share`) as unknown as Parameters<
        typeof shareRoute.GET
      >[0],
      routeCtx(id),
    );
    const body = await readJson<ShareResponse>(get);
    expect(body.data.shareable).toBe(false);
  });

  it("is idempotent on a recipe that was never shared", async () => {
    const id = await createRecipe();
    const del = await shareRoute.DELETE(
      buildRequest(`/api/recipes/${id}/share`, { method: "DELETE" }) as unknown as Parameters<
        typeof shareRoute.DELETE
      >[0],
      routeCtx(id),
    );
    expect(del.status).toBe(204);
  });

  it("returns 404 for an unknown recipe", async () => {
    const res = await shareRoute.DELETE(
      buildRequest("/api/recipes/missing/share", { method: "DELETE" }) as unknown as Parameters<
        typeof shareRoute.DELETE
      >[0],
      routeCtx("missing"),
    );
    expect(res.status).toBe(404);
  });
});
