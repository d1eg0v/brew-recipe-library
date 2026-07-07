// UI tests for the priming-sugar calculator.
//
// The standalone `/priming-sugar` page renders a client form that calls
// `GET /api/priming-sugar`. We mock `fetch` so the page renders with canned
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
import type { PrimingSugarResponse } from "@/lib/ui/types";

let db: TestDatabase;
let recipesRoute: typeof import("@/app/api/recipes/route");
let PrimingSugarPage: typeof import("@/app/priming-sugar/page")["default"];

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  recipesRoute = await import("@/app/api/recipes/route");
  const pageMod = await import("@/app/priming-sugar/page");
  PrimingSugarPage = pageMod.default;
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
        title: "Test IPA",
        category: "beer",
        batchSizeLiters: 19,
        fermentables: [{ name: "Pale 2-Row", type: "grain", amountKg: 4.5 }],
      },
    }) as unknown as Parameters<typeof recipesRoute.POST>[0],
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

const SAMPLE_RESPONSE: PrimingSugarResponse = {
  data: {
    result: {
      weightGrams: 108.4,
      weightOz: 3.82,
      residualVolumes: 0.85,
      volumesToAdd: 1.65,
      sugarType: "cornSugar",
      input: {
        volumeLiters: 20,
        targetVolumes: 2.5,
        temperatureC: 20,
        sugarType: "cornSugar",
      },
    },
    source: "standalone",
  },
};

function mockPrimingSugarApi(): typeof fetch {
  const original = global.fetch;
  const mock = vi.fn(
    async (input: RequestInfo | URL): Promise<Response> => {
      const url =
        typeof input === "string"
          ? new URL(input)
          : input instanceof URL
            ? input
            : new URL((input as Request).url);
      if (url.pathname === "/api/priming-sugar") {
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

describe("/priming-sugar page", () => {
  it("renders the standalone form when no recipeId is given", async () => {
    const original = mockPrimingSugarApi();
    try {
      const element = await PrimingSugarPage({
        searchParams: Promise.resolve({}),
      });
      const html = renderToStaticMarkup(element);
      expect(html).toContain("Priming sugar calculator");
      // Standalone: no recipe pre-fill callout.
      expect(html).not.toContain("Pre-filled from");
      // Form controls are present.
      expect(html).toContain('id="batch-size"');
      expect(html).toContain('id="target-volumes"');
      expect(html).toContain('id="temperature"');
      // Sugar-type radio buttons render.
      expect(html).toContain("Corn sugar (dextrose)");
      expect(html).toContain("Table sugar (sucrose)");
      expect(html).toContain("Dry malt extract (DME)");
      // Style-preset chips.
      expect(html).toContain("American ale");
      expect(html).toContain("Belgian / wheat");
    } finally {
      restoreFetch(original);
    }
  });

  it("shows the recipe pre-fill callout when recipeId is given", async () => {
    const id = await createRecipe();
    const original = mockPrimingSugarApi();
    try {
      const element = await PrimingSugarPage({
        searchParams: Promise.resolve({ recipeId: id }),
      });
      const html = renderToStaticMarkup(element);
      expect(html).toContain("Pre-filled from");
      expect(html).toContain("Test IPA");
      expect(html).toContain("data-testid=\"recipe-prefill\"");
    } finally {
      restoreFetch(original);
    }
  });

  it("returns 404 for an unknown recipeId", async () => {
    const original = mockPrimingSugarApi();
    try {
      let threw = false;
      try {
        await PrimingSugarPage({
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
