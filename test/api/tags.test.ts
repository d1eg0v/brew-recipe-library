// Integration tests for the Tag CRUD routes (BRE-29).
//
// Spins up an isolated SQLite DB, seeds a recipe via the recipe POST route, and
// then exercises `/api/recipes/[id]/tags`, `/api/recipes/[id]/tags/[name]`, and
// `/api/tags` end to end.

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
let recipeTagsRoute: typeof import("@/app/api/recipes/[id]/tags/route");
let singleTagRoute: typeof import("@/app/api/recipes/[id]/tags/[name]/route");
let tagsRoute: typeof import("@/app/api/tags/route");

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  recipesRoute = await import("@/app/api/recipes/route");
  recipeTagsRoute = await import("@/app/api/recipes/[id]/tags/route");
  singleTagRoute = await import("@/app/api/recipes/[id]/tags/[name]/route");
  tagsRoute = await import("@/app/api/tags/route");
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
    typeof recipeTagsRoute.GET
  >[1];
}

function tagCtx(id: string, name: string) {
  return { params: Promise.resolve({ id, name }) } as Parameters<
    typeof singleTagRoute.DELETE
  >[1];
}

interface TagData {
  id: string;
  name: string;
  createdAt: string;
}

interface TagWithCount extends TagData {
  recipeCount: number;
}

interface TagListResponse {
  data: TagWithCount[];
  total: number;
  limit: number;
}

interface TagResponse {
  data: TagData;
}

interface ListItemWithTags {
  id: string;
  title: string;
  tags: string[];
  tagDetails: TagData[];
}

interface ListResponseWithTags {
  data: ListItemWithTags[];
  total: number;
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
  const body = (await res.json()) as { data: { id: string; tags: string[]; tagDetails: TagData[] } };
  return body.data;
}

describe("POST /api/recipes/[id]/tags", () => {
  it("creates a tag and attaches it to the recipe", async () => {
    const recipe = await createRecipe();
    const res = await recipeTagsRoute.POST(
      buildRequest(`/api/recipes/${recipe.id}/tags`, {
        method: "POST",
        body: { name: "  Summer  " },
      }) as unknown as Parameters<typeof recipeTagsRoute.POST>[0],
      recipeCtx(recipe.id),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as TagResponse;
    expect(body.data.name).toBe("summer");
  });

  it("is idempotent on re-add", async () => {
    const recipe = await createRecipe();
    await recipeTagsRoute.POST(
      buildRequest(`/api/recipes/${recipe.id}/tags`, {
        method: "POST",
        body: { name: "session" },
      }) as unknown as Parameters<typeof recipeTagsRoute.POST>[0],
      recipeCtx(recipe.id),
    );
    const res2 = await recipeTagsRoute.POST(
      buildRequest(`/api/recipes/${recipe.id}/tags`, {
        method: "POST",
        body: { name: "SESSION" },
      }) as unknown as Parameters<typeof recipeTagsRoute.POST>[0],
      recipeCtx(recipe.id),
    );
    expect(res2.status).toBe(201);
    const list = await recipeTagsRoute.GET(
      buildRequest(`/api/recipes/${recipe.id}/tags`) as unknown as Parameters<
        typeof recipeTagsRoute.GET
      >[0],
      recipeCtx(recipe.id),
    );
    const listBody = (await list.json()) as { data: TagData[] };
    expect(listBody.data).toHaveLength(1);
    expect(listBody.data[0].name).toBe("session");
  });

  it("returns 404 for an unknown recipe", async () => {
    const res = await recipeTagsRoute.POST(
      buildRequest(`/api/recipes/missing/tags`, {
        method: "POST",
        body: { name: "x" },
      }) as unknown as Parameters<typeof recipeTagsRoute.POST>[0],
      recipeCtx("missing"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid body", async () => {
    const recipe = await createRecipe();
    const res = await recipeTagsRoute.POST(
      buildRequest(`/api/recipes/${recipe.id}/tags`, {
        method: "POST",
        body: {},
      }) as unknown as Parameters<typeof recipeTagsRoute.POST>[0],
      recipeCtx(recipe.id),
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/recipes/[id]/tags", () => {
  it("returns tags sorted by name", async () => {
    const recipe = await createRecipe();
    for (const t of ["zeta", "alpha", "Mu"]) {
      await recipeTagsRoute.POST(
        buildRequest(`/api/recipes/${recipe.id}/tags`, {
          method: "POST",
          body: { name: t },
        }) as unknown as Parameters<typeof recipeTagsRoute.POST>[0],
        recipeCtx(recipe.id),
      );
    }
    const res = await recipeTagsRoute.GET(
      buildRequest(`/api/recipes/${recipe.id}/tags`) as unknown as Parameters<
        typeof recipeTagsRoute.GET
      >[0],
      recipeCtx(recipe.id),
    );
    const body = (await res.json()) as { data: TagData[] };
    expect(body.data.map((t) => t.name)).toEqual(["alpha", "mu", "zeta"]);
  });
});

describe("PUT /api/recipes/[id]/tags", () => {
  it("replaces the tag set atomically", async () => {
    const recipe = await createRecipe();
    await recipeTagsRoute.POST(
      buildRequest(`/api/recipes/${recipe.id}/tags`, {
        method: "POST",
        body: { name: "old" },
      }) as unknown as Parameters<typeof recipeTagsRoute.POST>[0],
      recipeCtx(recipe.id),
    );
    const res = await recipeTagsRoute.PUT(
      buildRequest(`/api/recipes/${recipe.id}/tags`, {
        method: "PUT",
        body: { tags: ["Session", "  summer  ", "session"] },
      }) as unknown as Parameters<typeof recipeTagsRoute.PUT>[0],
      recipeCtx(recipe.id),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: TagData[] };
    expect(body.data.map((t) => t.name).sort()).toEqual(["session", "summer"]);
  });

  it("clears all tags when the array is empty", async () => {
    const recipe = await createRecipe();
    await recipeTagsRoute.POST(
      buildRequest(`/api/recipes/${recipe.id}/tags`, {
        method: "POST",
        body: { name: "kept" },
      }) as unknown as Parameters<typeof recipeTagsRoute.POST>[0],
      recipeCtx(recipe.id),
    );
    const res = await recipeTagsRoute.PUT(
      buildRequest(`/api/recipes/${recipe.id}/tags`, {
        method: "PUT",
        body: { tags: [] },
      }) as unknown as Parameters<typeof recipeTagsRoute.PUT>[0],
      recipeCtx(recipe.id),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: TagData[] };
    expect(body.data).toEqual([]);
  });
});

describe("DELETE /api/recipes/[id]/tags/[name]", () => {
  it("removes the join, keeps the tag row for other recipes", async () => {
    const r1 = await createRecipe({ title: "Recipe 1" });
    const r2 = await createRecipe({ title: "Recipe 2" });
    for (const r of [r1, r2]) {
      await recipeTagsRoute.POST(
        buildRequest(`/api/recipes/${r.id}/tags`, {
          method: "POST",
          body: { name: "shared" },
        }) as unknown as Parameters<typeof recipeTagsRoute.POST>[0],
        recipeCtx(r.id),
      );
    }

    const res = await singleTagRoute.DELETE(
      buildRequest(`/api/recipes/${r1.id}/tags/shared`, {
        method: "DELETE",
      }) as unknown as Parameters<typeof singleTagRoute.DELETE>[0],
      tagCtx(r1.id, "shared"),
    );
    expect(res.status).toBe(204);

    const r1Tags = await recipeTagsRoute.GET(
      buildRequest(`/api/recipes/${r1.id}/tags`) as unknown as Parameters<
        typeof recipeTagsRoute.GET
      >[0],
      recipeCtx(r1.id),
    );
    const r1Body = (await r1Tags.json()) as { data: TagData[] };
    expect(r1Body.data).toEqual([]);

    const r2Tags = await recipeTagsRoute.GET(
      buildRequest(`/api/recipes/${r2.id}/tags`) as unknown as Parameters<
        typeof recipeTagsRoute.GET
      >[0],
      recipeCtx(r2.id),
    );
    const r2Body = (await r2Tags.json()) as { data: TagData[] };
    expect(r2Body.data.map((t) => t.name)).toEqual(["shared"]);
  });

  it("is idempotent (no error if the recipe never had the tag)", async () => {
    const recipe = await createRecipe();
    const res = await singleTagRoute.DELETE(
      buildRequest(`/api/recipes/${recipe.id}/tags/never-added`, {
        method: "DELETE",
      }) as unknown as Parameters<typeof singleTagRoute.DELETE>[0],
      tagCtx(recipe.id, "never-added"),
    );
    expect(res.status).toBe(204);
  });

  it("returns 404 for an unknown recipe", async () => {
    const res = await singleTagRoute.DELETE(
      buildRequest(`/api/recipes/missing/tags/anything`, {
        method: "DELETE",
      }) as unknown as Parameters<typeof singleTagRoute.DELETE>[0],
      tagCtx("missing", "anything"),
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/tags", () => {
  it("lists tags with usage counts", async () => {
    const r1 = await createRecipe({ title: "R1" });
    const r2 = await createRecipe({ title: "R2" });
    for (const r of [r1, r2]) {
      await recipeTagsRoute.POST(
        buildRequest(`/api/recipes/${r.id}/tags`, {
          method: "POST",
          body: { name: "shared" },
        }) as unknown as Parameters<typeof recipeTagsRoute.POST>[0],
        recipeCtx(r.id),
      );
    }
    await recipeTagsRoute.POST(
      buildRequest(`/api/recipes/${r1.id}/tags`, {
        method: "POST",
        body: { name: "single" },
      }) as unknown as Parameters<typeof recipeTagsRoute.POST>[0],
      recipeCtx(r1.id),
    );

    const res = await tagsRoute.GET(
      buildRequest("/api/tags") as unknown as Parameters<typeof tagsRoute.GET>[0],
    );
    const body = (await res.json()) as TagListResponse;
    expect(body.data).toHaveLength(2);
    const shared = body.data.find((t) => t.name === "shared");
    const single = body.data.find((t) => t.name === "single");
    expect(shared?.recipeCount).toBe(2);
    expect(single?.recipeCount).toBe(1);
  });

  it("filters by minCount", async () => {
    const r1 = await createRecipe({ title: "R1" });
    const r2 = await createRecipe({ title: "R2" });
    for (const id of [r1.id, r2.id]) {
      await recipeTagsRoute.POST(
        buildRequest(`/api/recipes/${id}/tags`, {
          method: "POST",
          body: { name: "shared" },
        }) as unknown as Parameters<typeof recipeTagsRoute.POST>[0],
        recipeCtx(id),
      );
    }
    await recipeTagsRoute.POST(
      buildRequest(`/api/recipes/${r1.id}/tags`, {
        method: "POST",
        body: { name: "single" },
      }) as unknown as Parameters<typeof recipeTagsRoute.POST>[0],
      recipeCtx(r1.id),
    );

    const res = await tagsRoute.GET(
      buildRequest("/api/tags?minCount=2") as unknown as Parameters<
        typeof tagsRoute.GET
      >[0],
    );
    const body = (await res.json()) as TagListResponse;
    expect(body.data.map((t) => t.name)).toEqual(["shared"]);
  });
});

describe("GET /api/recipes?tag=...", () => {
  it("filters the list to recipes that have the tag (case-insensitive)", async () => {
    const r1 = await createRecipe({ title: "Tagged" });
    await createRecipe({ title: "Untagged" });
    await recipeTagsRoute.POST(
      buildRequest(`/api/recipes/${r1.id}/tags`, {
        method: "POST",
        body: { name: "summer" },
      }) as unknown as Parameters<typeof recipeTagsRoute.POST>[0],
      recipeCtx(r1.id),
    );

    const res = await recipesRoute.GET(
      buildRequest("/api/recipes?tag=SUMMER") as unknown as Parameters<
        typeof recipesRoute.GET
      >[0],
    );
    const body = (await res.json()) as ListResponseWithTags;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(r1.id);
    expect(body.data[0].tags).toEqual(["summer"]);
    expect(body.data[0].tagDetails[0].name).toBe("summer");
  });
});

describe("POST /api/recipes with tags", () => {
  it("attaches tags via the recipe body", async () => {
    const res = await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe({ tags: ["Session", "SUMMER", "  session  "] }),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: ListItemWithTags };
    expect(body.data.tags.sort()).toEqual(["session", "summer"]);
  });
});

describe("POST /api/recipes/[id]/clone", () => {
  it("clones the source recipe's tags onto the copy", async () => {
    const source = await createRecipe({ title: "Original" });
    for (const name of ["summer", "session"]) {
      await recipeTagsRoute.POST(
        buildRequest(`/api/recipes/${source.id}/tags`, {
          method: "POST",
          body: { name },
        }) as unknown as Parameters<typeof recipeTagsRoute.POST>[0],
        recipeCtx(source.id),
      );
    }
    const cloneRoute = await import("@/app/api/recipes/[id]/clone/route");
    const res = await cloneRoute.POST(
      buildRequest(`/api/recipes/${source.id}/clone`, {
        method: "POST",
      }) as unknown as Parameters<typeof cloneRoute.POST>[0],
      { params: Promise.resolve({ id: source.id }) } as Parameters<
        typeof cloneRoute.POST
      >[1],
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: ListItemWithTags };
    expect(body.data.title).toBe("Original (copy)");
    expect(body.data.tags.sort()).toEqual(["session", "summer"]);
  });
});
