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
  applyRange(where, "targetAbv", query.get("abvMin"), query.get("abvMax"));
  applyRange(where, "targetIbu", query.get("ibuMin"), query.get("ibuMax"));
  applyRange(where, "targetSrm", query.get("srmMin"), query.get("srmMax"));
  applyRange(where, "targetOg", query.get("ogMin"), query.get("ogMax"));

  // Synchronous-ish Prisma call (Prisma 7 returns a thenable).
  return db.prisma.recipe
    .findMany({ where, orderBy: { updatedAt: "desc" }, skip: offset, take: limit })
    .then((rows) => ({
      data: rows.map((r) => ({
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
        updatedAt: r.updatedAt.toISOString(),
      })),
      total: rows.length,
      limit,
      offset,
    }));
}

function applyRange(
  where: Record<string, unknown>,
  field: string,
  min: string | null,
  max: string | null,
): void {
  const minN = min != null && min !== "" ? Number.parseFloat(min) : null;
  const maxN = max != null && max !== "" ? Number.parseFloat(max) : null;
  if (minN == null && maxN == null) return;
  const clause: Record<string, number> = {};
  if (minN != null && !Number.isNaN(minN)) clause.gte = minN;
  if (maxN != null && !Number.isNaN(maxN)) clause.lte = maxN;
  if (Object.keys(clause).length > 0) where[field] = clause;
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

  it("renders min/max number inputs for ABV, IBU, SRM, OG (BRE-26)", async () => {
    const restore = installFetchMock();
    try {
      await loadSeed();
      const element = await HomePage({ searchParams: Promise.resolve({}) });
      const html = renderToStaticMarkup(element);

      for (const field of ["abv", "ibu", "srm", "og"]) {
        expect(html).toContain(`name="${field}Min"`);
        expect(html).toContain(`name="${field}Max"`);
        expect(html).toContain(`id="${field}Min"`);
        expect(html).toContain(`id="${field}Max"`);
      }
    } finally {
      restore();
    }
  });

  it("forwards range filter values to /api/recipes and pre-fills inputs (BRE-26)", async () => {
    const restore = installFetchMock();
    try {
      await loadSeed();
      const seen: string[] = [];
      const original = global.fetch;
      global.fetch = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
        const url =
          typeof input === "string"
            ? new URL(input)
            : input instanceof URL
              ? input
              : new URL((input as Request).url);
        seen.push(url.search);
        return new Response(
          JSON.stringify({ data: [], total: 0, limit: 100, offset: 0 }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as unknown as typeof fetch;
      try {
        const element = await HomePage({
          searchParams: Promise.resolve({
            abvMin: "5",
            abvMax: "8",
            ibuMin: "30",
            ibuMax: "70",
            srmMin: "4",
            srmMax: "20",
            ogMin: "1.05",
            ogMax: "1.08",
          }),
        });
        const html = renderToStaticMarkup(element);

        // Each forwarded param appears in the fetch URL.
        for (const param of [
          "abvMin=5",
          "abvMax=8",
          "ibuMin=30",
          "ibuMax=70",
          "srmMin=4",
          "srmMax=20",
          "ogMin=1.05",
          "ogMax=1.08",
        ]) {
          expect(seen.some((s) => s.includes(param))).toBe(true);
        }
        // Echo values in the form so the user sees what they typed.
        expect(html).toMatch(/<input[^>]*name="abvMin"[^>]*value="5"/);
        expect(html).toMatch(/<input[^>]*name="ibuMax"[^>]*value="70"/);
        expect(html).toMatch(/<input[^>]*name="ogMin"[^>]*value="1\.05"/);
      } finally {
        global.fetch = original;
      }
    } finally {
      restore();
    }
  });

  it("narrows the list when an ABV range is active (BRE-26)", async () => {
    const restore = installFetchMock();
    try {
      await loadSeed();
      const lowCount = await db.prisma.recipe.count({
        where: { targetAbv: { gte: 4, lte: 5.5 } },
      });
      // Sanity: there should be at least one session-strength recipe in the
      // seed dataset (e.g. the lower-ABV IPAs/meads).
      expect(lowCount).toBeGreaterThan(0);

      const element = await HomePage({
        searchParams: Promise.resolve({ abvMin: "4", abvMax: "5.5" }),
      });
      const html = renderToStaticMarkup(element);

      // The total reflects the filtered count.
      expect(html).toContain(`${lowCount} recipe`);
      // No recipe with a high ABV should be in the rendered list — grab one
      // and assert it's absent.
      const strong = await db.prisma.recipe.findFirst({
        where: { targetAbv: { gt: 9 } },
        select: { title: true },
      });
      if (strong) {
        expect(html).not.toContain(`>${strong.title}<`);
      }
    } finally {
      restore();
    }
  });
});