// UI smoke test: render the browse page server-side against the seed DB
// and assert the seeded recipe titles make it into the HTML.
//
// We mock global `fetch` so the page's internal call to `/api/recipes` is
// served from the same test PrismaClient we just seeded — no live HTTP,
// no second server.

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import {
  setupTestDatabase,
  type TestDatabase,
} from "../helpers/db";

interface RecipeListItem {
  id: string;
  title: string;
  category: string;
  batchSizeLiters: number;
  tags?: string[];
  tagDetails?: Array<{ id: string; name: string }>;
  [k: string]: unknown;
}

interface ListResponse {
  data: RecipeListItem[];
  total: number;
  limit: number;
  offset: number;
}

let db: TestDatabase;
let seedFromFile: typeof import("@/../prisma/seed")["seedFromFile"];
let HomePage: typeof import("@/app/page")["default"];

beforeAll(async () => {
  db = await setupTestDatabase();
  // Both the seed loader and the page reach for `@/lib/db`; point both at
  // the test client.
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  const seedMod = await import("@/../prisma/seed");
  seedFromFile = seedMod.seedFromFile;
  const pageMod = await import("@/app/page");
  HomePage = pageMod.default;
});

beforeEach(async () => {
  await db.reset();
});

afterAll(async () => {
  await db.teardown();
});

async function loadSeed() {
  const seedPath = path.resolve(process.cwd(), "prisma/seed/recipes.json");
  const report = await seedFromFile(seedPath);
  return report.loaded;
}

function buildListFromDb(query: URLSearchParams): ListResponse {
  const limit = Math.min(
    Math.max(Number.parseInt(query.get("limit") ?? "50", 10) || 50, 1),
    200,
  );
  const offset = Math.max(Number.parseInt(query.get("offset") ?? "0", 10), 0);
  const where: Record<string, unknown> = {};
  const category = query.get("category");
  if (category) where.category = category;
  const style = query.get("style");
  if (style) where.styleName = { contains: style };

  // Synchronous-ish Prisma call (Prisma 7 returns a thenable).
  return db.prisma.recipe
    .findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: offset,
      take: limit,
      include: { recipeTags: { include: { tag: true } } },
    })
    .then((rows) => ({
      data: rows.map((r) => {
        const tags = r.recipeTags
          .map((rt) => rt.tag)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((t) => t.name);
        return {
          id: r.id,
          title: r.title,
          author: r.author,
          category: r.category,
          styleName: r.styleName,
          bjcpCategory: r.bjcpCategory,
          batchSizeLiters: r.batchSizeLiters,
          targetAbv: r.targetAbv,
          targetIbu: r.targetIbu,
          targetSrm: r.targetSrm,
          targetOg: r.targetOg,
          targetFg: r.targetFg,
          description: r.description,
          tags,
          tagDetails: r.recipeTags
            .map((rt) => ({ id: rt.tag.id, name: rt.tag.name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
          updatedAt: r.updatedAt.toISOString(),
        };
      }),
      total: rows.length,
      limit,
      offset,
    }));
}

function installFetchMock() {
  const original = global.fetch;
  const mock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url =
      typeof input === "string"
        ? new URL(input)
        : input instanceof URL
          ? input
          : new URL((input as Request).url);
    if (url.pathname === "/api/recipes") {
      const body = await buildListFromDb(url.searchParams);
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  });
  global.fetch = mock as unknown as typeof fetch;
  return () => {
    if (original) {
      global.fetch = original;
    } else {
      delete (global as { fetch?: typeof fetch }).fetch;
    }
  };
}

describe("UI smoke: / browse page renders seeded recipes", () => {
  it("lists recipes from the seed DB and renders them server-side", async () => {
    const restore = installFetchMock();
    try {
      const loaded = await loadSeed();
      expect(loaded).toBeGreaterThanOrEqual(12);

      // Render the page with an empty search (matches the route loader
      // shape: searchParams is a Promise<{ [k]: string | string[] | undefined }>).
      const element = await HomePage({ searchParams: Promise.resolve({}) });
      const html = renderToStaticMarkup(element);

      // The page is the route component only — the layout wrapper is a
      // separate React tree. Assert on what the page itself renders.
      expect(html).toContain("Recipes");
      // Total count line (the API mock returns however many rows are seeded).
      const total = await db.prisma.recipe.count();
      expect(html).toContain(`${total} recipe`);
      // At least one curated recipe should be in the rendered HTML.
      // Pull a few sample titles from the seed to assert against.
      const sampleTitles = await db.prisma.recipe.findMany({
        select: { title: true },
        take: 5,
      });
      for (const r of sampleTitles) {
        expect(html).toContain(r.title);
      }
      // Filter form is present.
      expect(html).toContain("name=\"category\"");
      expect(html).toContain("name=\"style\"");
      expect(html).toContain("name=\"tag\"");
    } finally {
      restore();
    }
  });

  it("renders tag chips on the recipe card when the recipe has tags", async () => {
    const restore = installFetchMock();
    try {
      await loadSeed();
      // Pick a recipe and attach a tag via the test DB.
      const first = await db.prisma.recipe.findFirstOrThrow();
      const tag = await db.prisma.tag.create({ data: { name: "session" } });
      await db.prisma.recipeTag.create({
        data: { recipeId: first.id, tagId: tag.id },
      });

      const element = await HomePage({ searchParams: Promise.resolve({}) });
      const html = renderToStaticMarkup(element);
      expect(html).toContain("session");
      expect(html).toContain('href="/?tag=session"');
    } finally {
      restore();
    }
  });

  it("honours a category filter URL and narrows the list", async () => {
    const restore = installFetchMock();
    try {
      await loadSeed();
      const wineCount = await db.prisma.recipe.count({ where: { category: "wine" } });
      expect(wineCount).toBeGreaterThan(0);

      const element = await HomePage({
        searchParams: Promise.resolve({ category: "wine" }),
      });
      const html = renderToStaticMarkup(element);

      // Should show the wine count
      expect(html).toContain(String(wineCount));
      // Beer-only titles should be filtered out — sanity check by searching
      // for a beer title we know exists in the seed.
      const beer = await db.prisma.recipe.findFirst({
        where: { category: "beer" },
        select: { title: true },
      });
      if (beer) {
        expect(html).not.toContain(`>${beer.title}<`);
      }
    } finally {
      restore();
    }
  });
});