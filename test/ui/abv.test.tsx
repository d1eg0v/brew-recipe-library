// UI tests for the quick ABV-from-OG/FG calculator.
//
// The standalone `/abv` page renders a client form that calls
// `GET /api/abv`. We mock `fetch` so the page renders with canned
// data, then check the static markup for the expected pieces.

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

import {
  setupTestDatabase,
  type TestDatabase,
} from "../helpers/db";
import type { MeasuredAbvResponse } from "@/lib/ui/types";

let db: TestDatabase;
let recipesRoute: typeof import("@/app/api/recipes/route");
let AbvPage: typeof import("@/app/abv/page")["default"];

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  recipesRoute = await import("@/app/api/recipes/route");
  const pageMod = await import("@/app/abv/page");
  AbvPage = pageMod.default;
});

beforeEach(async () => {
  await db.reset();
});

afterAll(async () => {
  await db.teardown();
});

async function createRecipe() {
  const realRes = await recipesRoute.POST(
    new Request("http://localhost/api/recipes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Test Pale Ale",
        category: "beer",
        batchSizeLiters: 20,
        targetOg: 1.052,
        targetFg: 1.012,
        fermentables: [{ name: "Pale 2-Row", type: "grain", amountKg: 5 }],
      }),
    }) as unknown as Parameters<typeof recipesRoute.POST>[0],
  );
  expect(realRes.status).toBe(201);
  const body = (await realRes.json()) as { data: { id: string } };
  return body.data.id;
}

const SAMPLE_RESPONSE: MeasuredAbvResponse = {
  data: {
    result: {
      abvPct: 5.25,
      apparentAttenuationPct: 76.9,
      gravityPointsDropped: 40,
      formulaUsed: "linear",
      isHighGravity: false,
      input: {
        measuredOg: 1.052,
        measuredFg: 1.012,
        formula: "linear",
      },
    },
    source: "standalone",
  },
};

function mockAbvApi(): typeof fetch {
  const original = global.fetch;
  const mock = vi.fn(
    async (input: RequestInfo | URL): Promise<Response> => {
      const url =
        typeof input === "string"
          ? new URL(input)
          : input instanceof URL
            ? input
            : new URL((input as Request).url);
      if (url.pathname === "/api/abv") {
        return new Response(JSON.stringify(SAMPLE_RESPONSE), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    },
  );
  global.fetch = mock as unknown as typeof fetch;
  return original;
}

function restoreFetch(original: typeof fetch | undefined) {
  if (original) {
    global.fetch = original;
  } else {
    delete (global as { fetch?: typeof fetch }).fetch;
  }
}

describe("/abv page", () => {
  it("renders the standalone form when no recipeId is given", async () => {
    const original = mockAbvApi();
    try {
      const element = await AbvPage({ searchParams: Promise.resolve({}) });
      const html = renderToStaticMarkup(element);
      expect(html).toContain("Quick ABV calculator");
      // Standalone: no recipe pre-fill callout.
      expect(html).not.toContain("Pre-filled from");
      // Form controls are present.
      expect(html).toContain('id="measured-og"');
      expect(html).toContain('id="measured-fg"');
      // Formula radio group.
      expect(html).toContain("Auto");
      expect(html).toContain("Linear");
      expect(html).toContain("High-gravity");
      // Style presets.
      expect(html).toContain("Pale ale");
      expect(html).toContain("IPA");
      expect(html).toContain("Dry mead");
    } finally {
      restoreFetch(original);
    }
  });

  it("shows the recipe pre-fill callout when recipeId is given", async () => {
    const id = await createRecipe();
    const original = mockAbvApi();
    try {
      const element = await AbvPage({
        searchParams: Promise.resolve({ recipeId: id }),
      });
      const html = renderToStaticMarkup(element);
      expect(html).toContain("Pre-filled from");
      expect(html).toContain("Test Pale Ale");
      expect(html).toContain('data-testid="recipe-prefill"');
      // The recipe target OG / FG should be in the pre-fill callout.
      expect(html).toContain("1.052");
      expect(html).toContain("1.012");
    } finally {
      restoreFetch(original);
    }
  });

  it("accepts caller-provided measuredOg / measuredFg overrides", async () => {
    const original = mockAbvApi();
    try {
      const element = await AbvPage({
        searchParams: Promise.resolve({
          measuredOg: "1.048",
          measuredFg: "1.014",
        }),
      });
      const html = renderToStaticMarkup(element);
      // The input value attribute should reflect the override.
      expect(html).toContain('id="measured-og"');
      expect(html).toContain('value="1.048"');
      expect(html).toContain('id="measured-fg"');
      expect(html).toContain('value="1.014"');
    } finally {
      restoreFetch(original);
    }
  });

  it("returns 404 for an unknown recipeId", async () => {
    const original = mockAbvApi();
    try {
      let threw = false;
      try {
        await AbvPage({
          searchParams: Promise.resolve({ recipeId: "does-not-exist" }),
        });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    } finally {
      restoreFetch(original);
    }
  });

  it("ignores out-of-range gravity overrides", async () => {
    const original = mockAbvApi();
    try {
      const element = await AbvPage({
        searchParams: Promise.resolve({
          measuredOg: "2.5",
          measuredFg: "1.01",
        }),
      });
      const html = renderToStaticMarkup(element);
      // Out-of-range override should be discarded — the OG input falls
      // back to the default 1.05.
      expect(html).toContain('value="1.05"');
      expect(html).not.toContain('value="2.5"');
    } finally {
      restoreFetch(original);
    }
  });
});