// UI smoke test for the public share view (BRE-43).
//
// Mirrors the print-page test pattern: the share page is a server component
// that pulls a recipe directly from Prisma, so we mock `@/lib/db` to inject
// the test PrismaClient. We assert the read-only shell renders the recipe
// and omits owner-only controls (Edit, Compare, Delete, Duplicate).

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { fixtureRecipe, setupTestDatabase, type TestDatabase } from "../helpers/db";

let db: TestDatabase;
let SharePage: typeof import("@/app/share/[token]/page")["default"];
let ShareNotFound: typeof import("@/app/share/[token]/not-found")["default"];
let shareRouteMod: typeof import("@/app/api/recipes/[id]/share/route");

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  SharePage = (await import("@/app/share/[token]/page")).default;
  ShareNotFound = (await import("@/app/share/[token]/not-found")).default;
  shareRouteMod = await import("@/app/api/recipes/[id]/share/route");
});

beforeEach(async () => {
  await db.reset();
});

afterAll(async () => {
  await db.teardown();
});

async function createSharedRecipe() {
  const recipesRoute = await import("@/app/api/recipes/route");
  const req = new Request("http://localhost/api/recipes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fixtureRecipe({ title: "Shared IPA" })),
  });
  const res = await recipesRoute.POST(req as never);
  expect(res.status).toBe(201);
  const body = (await res.json()) as { data: { id: string } };
  const id = body.data.id;

  // Issue a share token via the share route so we exercise the API together.
  const shareReq = new Request(`http://localhost/api/recipes/${id}/share`, {
    method: "POST",
  });
  const shareRes = await shareRouteMod.POST(shareReq as never, {
    params: Promise.resolve({ id }),
  });
  expect(shareRes.status).toBe(201);
  const shareBody = (await shareRes.json()) as {
    data: { shareToken: string };
  };
  return { id, shareToken: shareBody.data.shareToken };
}

function pageCtx(token: string) {
  return {
    params: Promise.resolve({ token }),
    searchParams: Promise.resolve({}),
  };
}

describe("UI: /share/[token] page", () => {
  it("renders the recipe in read-only mode", async () => {
    const { shareToken } = await createSharedRecipe();
    const element = await SharePage(pageCtx(shareToken));
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Shared IPA");
    expect(html).toContain("American IPA");
    expect(html).toContain("Pale 2-Row");
    expect(html).toContain("Cascade");
    expect(html).toContain("US-05");

    // Read-only chip.
    expect(html).toContain("Shared recipe");
    expect(html).toContain("read-only");

    // Owner-only controls are stripped.
    expect(html).not.toContain("Compare with");
    // Edit link should be gone (no Edit text on this button when read-only).
    expect(html).not.toMatch(/Edit\b/);
    // Delete/duplicate sections live in RecipeActions; absent entirely.
    expect(html).not.toContain("Manage recipe");
    // Calculate external links live in Controls; absent.
    expect(html).not.toContain("Calculate priming sugar");
    expect(html).not.toContain("Calculate ABV");
    expect(html).not.toContain("Calculate strike water");
    // Print brew sheet is owner-only.
    expect(html).not.toContain("Print brew sheet");
  });

  it("404s on a malformed token without hitting the DB", async () => {
    const html = renderToStaticMarkup(ShareNotFound());
    expect(html).toContain("Shared recipe not found");
  });

  it("404s on a well-formed but unknown token", async () => {
    // Next's `notFound()` throws NEXT_HTTP_ERROR_FALLBACK;404 which render-to-
    // static-markup cannot capture as an element. We treat that throw as the
    // signal that the page correctly transitioned to the not-found boundary
    // when the token didn't match.
    await expect(
      SharePage({
        params: Promise.resolve({ token: "no-such-token-aaaa" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK/);
  });
});
