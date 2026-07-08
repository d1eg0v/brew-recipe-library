// UI smoke test for the print / PDF brew sheet (BRE-42).
//
// The print page is a server component that pulls a recipe directly from
// Prisma and renders a one-page brew sheet. We mock `@/lib/db` so the page
// sees the test PrismaClient, then assert the rendered HTML contains the
// recipe title, target measurements, fermentables, hop additions, the
// auto-generated brew-day checklist, and a "Print" button stub.

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

import { setupTestDatabase, type TestDatabase } from "../helpers/db";
import { fixtureRecipe } from "../helpers/db";

let db: TestDatabase;
let PrintPage: typeof import("@/app/recipes/[id]/print/page")["default"];

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  const mod = await import("@/app/recipes/[id]/print/page");
  PrintPage = mod.default;
});

beforeEach(async () => {
  await db.reset();
});

afterAll(async () => {
  await db.teardown();
});

async function createFixture(overrides: Record<string, unknown> = {}) {
  // Use the API route to get a fully-presented shape and a valid id.
  const recipesRoute = await import("@/app/api/recipes/route");
  const req = new Request("http://localhost/api/recipes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fixtureRecipe(overrides)),
  });
  const res = await recipesRoute.POST(req as never);
  expect(res.status).toBe(201);
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

function pageCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("UI smoke: /recipes/[id]/print page", () => {
  it("renders the recipe title, category, and target measurements", async () => {
    const id = await createFixture();
    const element = await PrintPage({
      params: pageCtx(id).params,
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Test IPA");
    expect(html).toContain("Beer");
    expect(html).toContain("American IPA");
    // Targets strip: OG, FG, ABV, IBU, SRM labels
    expect(html).toContain("OG");
    expect(html).toContain("FG");
    expect(html).toContain("ABV");
    expect(html).toContain("IBU");
    expect(html).toContain("SRM");
    // Fermentables row should be present.
    expect(html).toContain("Pale 2-Row");
    // Hop addition (already a recipe fixture hop).
    expect(html).toContain("Cascade");
    // Yeast.
    expect(html).toContain("US-05");
  });

  it("includes a Brew-day checklist section with checkboxes", async () => {
    const id = await createFixture();
    const element = await PrintPage({
      params: pageCtx(id).params,
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element);

    // Checklist section title.
    expect(html).toContain("Brew-day checklist");
    // Common prep items generated for any recipe.
    expect(html).toContain("Sanitize all equipment");
    expect(html).toContain("Measure strike / brew water");
    // Mash in for grain-based recipes.
    expect(html).toContain("Mash in");
    // Pitch yeast derived from yeasts list.
    expect(html).toContain("Pitch US-05");
  });

  it("hides the toolbar in print CSS via the .screenOnly class", async () => {
    const id = await createFixture();
    const element = await PrintPage({
      params: pageCtx(id).params,
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element);

    // The toolbar (back link, unit toggle, Print button) is a screen-only
    // element; the page emits it with the `screenOnly` class so the print
    // stylesheet can suppress it.
    expect(html).toContain("screenOnly");
    expect(html).toContain("Print / Save as PDF");
  });

  it("renders a not-found page for an unknown recipe id", async () => {
    let captured: unknown = null;
    try {
      await PrintPage({
        params: Promise.resolve({ id: "does-not-exist" }),
        searchParams: Promise.resolve({}),
      });
    } catch (err) {
      // Next.js' notFound() throws an internal error that bubbles through
      // the App Router; in a smoke test we only care that it threw (i.e.
      // we did NOT render a successful page).
      captured = err;
    }
    expect(captured).toBeInstanceOf(Error);
  });

  it("respects ?units=imperial by showing imperial unit fields", async () => {
    const id = await createFixture();
    const element = await PrintPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve({ units: "imperial" }),
    });
    const html = renderToStaticMarkup(element);
    // Imperial mode: fermentables in lb, hops in oz, temperatures in °F.
    expect(html).toMatch(/lb/);
    expect(html).toMatch(/oz/);
    expect(html).toMatch(/°F/);
  });
});
