// UI tests for the strike-water calculator.
//
// The standalone `/strike-water` page renders a client form that calls
// `GET /api/strike-water`. We mock `fetch` so the page renders with canned
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
import type { StrikeWaterResponse } from "@/lib/ui/types";

let db: TestDatabase;
let recipesRoute: typeof import("@/app/api/recipes/route");
let StrikeWaterPage: typeof import("@/app/strike-water/page")["default"];

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  recipesRoute = await import("@/app/api/recipes/route");
  const pageMod = await import("@/app/strike-water/page");
  StrikeWaterPage = pageMod.default;
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

async function createRecipe() {
  const res = await recipesRoute.POST(
    buildRequest("/api/recipes", {
      method: "POST",
      body: {
        title: "Test Pale Ale",
        category: "beer",
        batchSizeLiters: 20,
        fermentables: [{ name: "Pale 2-Row", type: "grain", amountKg: 5 }],
      },
    }) as unknown as Parameters<typeof recipesRoute.POST>[0],
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

const SAMPLE_RESPONSE: StrikeWaterResponse = {
  data: {
    result: {
      volumeLiters: 15,
      strikeTempC: 73.3,
      waterToGrainRatioLPerKg: 3,
      input: {
        grainKg: 5,
        targetMashTempC: 67,
        grainTempC: 20,
        waterToGrainRatioLPerKg: 3,
      },
    },
    source: "standalone",
  },
};

function mockStrikeWaterApi(): typeof fetch {
  const original = global.fetch;
  const mock = vi.fn(
    async (input: RequestInfo | URL): Promise<Response> => {
      const url =
        typeof input === "string"
          ? new URL(input)
          : input instanceof URL
            ? input
            : new URL((input as Request).url);
      if (url.pathname === "/api/strike-water") {
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

describe("/strike-water page", () => {
  it("renders the standalone form when no recipeId is given", async () => {
    const original = mockStrikeWaterApi();
    try {
      const element = await StrikeWaterPage({
        searchParams: Promise.resolve({}),
      });
      const html = renderToStaticMarkup(element);
      expect(html).toContain("Strike-water calculator");
      // Standalone: no recipe pre-fill callout.
      expect(html).not.toContain("Pre-filled from");
      // Form controls are present.
      expect(html).toContain('id="grain-kg"');
      expect(html).toContain('id="target-mash-temp"');
      expect(html).toContain('id="grain-temp"');
      expect(html).toContain('id="ratio"');
      // Mash-preset chips.
      expect(html).toContain("Saccharification");
      expect(html).toContain("β-amylase rest");
      // Ratio-preset chips.
      expect(html).toContain("Classic (3.0 L/kg");
      expect(html).toContain("Thin (3.5 L/kg");
    } finally {
      restoreFetch(original);
    }
  });

  it("shows the recipe pre-fill callout when recipeId is given", async () => {
    const id = await createRecipe();
    const original = mockStrikeWaterApi();
    try {
      const element = await StrikeWaterPage({
        searchParams: Promise.resolve({ recipeId: id }),
      });
      const html = renderToStaticMarkup(element);
      expect(html).toContain("Pre-filled from");
      expect(html).toContain("Test Pale Ale");
      expect(html).toContain('data-testid="recipe-prefill"');
    } finally {
      restoreFetch(original);
    }
  });

  it("returns 404 for an unknown recipeId", async () => {
    const original = mockStrikeWaterApi();
    try {
      let threw = false;
      try {
        await StrikeWaterPage({
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
});