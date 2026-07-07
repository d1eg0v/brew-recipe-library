// Integration tests for the BeerXML import/export API routes.
//
// Mocks `@/lib/db` so the routes run against a temp SQLite database. Each
// test starts from a clean database via `resetDatabase`.

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
let exportRoute: typeof import("@/app/api/recipes/[id]/export/route");
let importRoute: typeof import("@/app/api/recipes/import/route");

beforeAll(async () => {
  db = await setupTestDatabase();
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  recipesRoute = await import("@/app/api/recipes/route");
  exportRoute = await import("@/app/api/recipes/[id]/export/route");
  importRoute = await import("@/app/api/recipes/import/route");
});

beforeEach(async () => {
  await db.reset();
});

afterAll(async () => {
  await db.teardown();
});

function buildRequest(url: string, init?: { method?: string; body?: unknown; headers?: Record<string, string>; contentType?: string }) {
  const u = new URL(url, "http://localhost");
  const headers: Record<string, string> = { ...(init?.headers ?? {}) };
  if (init?.body !== undefined) {
    headers["content-type"] = init.contentType ?? "application/json";
  }
  return new Request(u, {
    method: init?.method ?? "GET",
    headers,
    body: typeof init?.body === "string" ? init.body : (init?.body !== undefined ? JSON.stringify(init.body) : undefined),
  });
}

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

function routeCtx(id: string) {
  return { params: Promise.resolve({ id }) } as Parameters<typeof exportRoute.GET>[1];
}

describe("GET /api/recipes/[id]/export", () => {
  it("returns an XML body for an existing recipe", async () => {
    const create = await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe(),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    const { data } = await readJson<{ data: { id: string; title: string } }>(create);

    const res = await exportRoute.GET(
      buildRequest(`/api/recipes/${data.id}/export`) as unknown as Parameters<typeof exportRoute.GET>[0],
      routeCtx(data.id),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/xml/);
    expect(res.headers.get("content-disposition")).toMatch(/attachment.*\.beerxml/);
    const xml = await res.text();
    expect(xml).toContain("<RECIPES>");
    expect(xml).toContain(`<NAME>${data.title}</NAME>`);
    expect(xml).toContain("<FERMENTABLE>");
  });

  it("returns JSON envelope when ?format=json is set", async () => {
    const create = await recipesRoute.POST(
      buildRequest("/api/recipes", {
        method: "POST",
        body: fixtureRecipe(),
      }) as unknown as Parameters<typeof recipesRoute.POST>[0],
    );
    const { data } = await readJson<{ data: { id: string } }>(create);

    const res = await exportRoute.GET(
      buildRequest(`/api/recipes/${data.id}/export?format=json`) as unknown as Parameters<typeof exportRoute.GET>[0],
      routeCtx(data.id),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{ data: { xml: string } }>(res);
    expect(body.data.xml).toContain("<RECIPES>");
  });

  it("returns 404 for an unknown id", async () => {
    const res = await exportRoute.GET(
      buildRequest("/api/recipes/does-not-exist/export") as unknown as Parameters<typeof exportRoute.GET>[0],
      routeCtx("does-not-exist"),
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/recipes/import", () => {
  const sampleBeerXml = `<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>Imported Pale Ale</NAME>
    <BREWER>Tester</BREWER>
    <BATCH_SIZE>20</BATCH_SIZE>
    <BOIL_TIME>60</BOIL_TIME>
    <EFFICIENCY>72</EFFICIENCY>
    <STYLE>
      <NAME>American Pale Ale</NAME>
      <CATEGORY>18A</CATEGORY>
    </STYLE>
    <OG>1.052</OG>
    <FG>1.012</FG>
    <IBU>35</IBU>
    <COLOR>5</COLOR>
    <ABV>5.2</ABV>
    <NOTES>Round-trip test.</NOTES>
    <FERMENTABLES>
      <FERMENTABLE>
        <NAME>Pale 2-Row</NAME>
        <TYPE>Grain</TYPE>
        <AMOUNT>4.0</AMOUNT>
        <COLOR>2</COLOR>
      </FERMENTABLE>
    </FERMENTABLES>
    <HOPS>
      <HOP>
        <NAME>Cascade</NAME>
        <AMOUNT>25</AMOUNT>
        <ALPHA>5.5</ALPHA>
        <TIME>60</TIME>
        <USE>Boil</USE>
        <FORM>Pellet</FORM>
      </HOP>
    </HOPS>
    <YEASTS>
      <YEAST>
        <NAME>US-05</NAME>
        <FORM>Dry</FORM>
        <ATTENUATION>81</ATTENUATION>
      </YEAST>
    </YEASTS>
    <MASH>
      <MASH_STEPS>
        <MASH_STEP>
          <NAME>Sacc rest</NAME>
          <TYPE>Infusion</TYPE>
          <STEP_TEMP>66</STEP_TEMP>
          <STEP_TIME>60</STEP_TIME>
        </MASH_STEP>
      </MASH_STEPS>
    </MASH>
  </RECIPE>
</RECIPES>`;

  it("creates a recipe from a valid BeerXML body", async () => {
    const res = await importRoute.POST(
      buildRequest("/api/recipes/import", {
        method: "POST",
        body: sampleBeerXml,
        contentType: "application/xml",
      }) as unknown as Parameters<typeof importRoute.POST>[0],
    );
    expect(res.status).toBe(201);
    const body = await readJson<{
      data: {
        id: string;
        title: string;
        styleName: string;
        targetIbu: number;
        fermentables: Array<{ name: string; type: string }>;
        hops: Array<{ name: string; use: string }>;
        yeasts: Array<{ name: string; form: string }>;
      };
    }>(res);
    expect(body.data.title).toBe("Imported Pale Ale");
    expect(body.data.styleName).toBe("American Pale Ale");
    expect(body.data.targetIbu).toBe(35);
    expect(body.data.fermentables).toHaveLength(1);
    expect(body.data.fermentables[0].name).toBe("Pale 2-Row");
    expect(body.data.fermentables[0].type).toBe("grain");
    expect(body.data.hops[0].use).toBe("boil");
    expect(body.data.yeasts[0].form).toBe("dry");
  });

  it("returns 400 for malformed XML", async () => {
    const res = await importRoute.POST(
      buildRequest("/api/recipes/import", {
        method: "POST",
        body: "not xml at all",
        contentType: "application/xml",
      }) as unknown as Parameters<typeof importRoute.POST>[0],
    );
    expect(res.status).toBe(400);
    const body = await readJson<{ error: { message: string } }>(res);
    expect(body.error.message).toMatch(/BeerXML/);
  });

  it("returns 400 for XML missing required fields", async () => {
    const xml = `<?xml version="1.0"?>
<RECIPES>
  <RECIPE>
    <FERMENTABLES/>
    <HOPS/>
    <YEASTS/>
  </RECIPE>
</RECIPES>`;
    const res = await importRoute.POST(
      buildRequest("/api/recipes/import", {
        method: "POST",
        body: xml,
        contentType: "application/xml",
      }) as unknown as Parameters<typeof importRoute.POST>[0],
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on an unsupported content-type", async () => {
    const res = await importRoute.POST(
      buildRequest("/api/recipes/import", {
        method: "POST",
        body: sampleBeerXml,
        contentType: "application/json",
      }) as unknown as Parameters<typeof importRoute.POST>[0],
    );
    expect(res.status).toBe(400);
  });

  it("accepts multipart/form-data with a file field", async () => {
    const form = new FormData();
    form.append("file", new File([sampleBeerXml], "test.xml", { type: "application/xml" }));
    const req = new Request("http://localhost/api/recipes/import", {
      method: "POST",
      body: form,
    });
    const res = await importRoute.POST(
      req as unknown as Parameters<typeof importRoute.POST>[0],
    );
    expect(res.status).toBe(201);
    const body = await readJson<{ data: { title: string } }>(res);
    expect(body.data.title).toBe("Imported Pale Ale");
  });

  it("round-trips: export the imported recipe and re-import", async () => {
    const first = await importRoute.POST(
      buildRequest("/api/recipes/import", {
        method: "POST",
        body: sampleBeerXml,
        contentType: "application/xml",
      }) as unknown as Parameters<typeof importRoute.POST>[0],
    );
    const { data: created } = await readJson<{ data: { id: string; title: string; targetIbu: number } }>(first);

    const exportRes = await exportRoute.GET(
      buildRequest(`/api/recipes/${created.id}/export`) as unknown as Parameters<typeof exportRoute.GET>[0],
      routeCtx(created.id),
    );
    const xml = await exportRes.text();

    const second = await importRoute.POST(
      buildRequest("/api/recipes/import", {
        method: "POST",
        body: xml,
        contentType: "application/xml",
      }) as unknown as Parameters<typeof importRoute.POST>[0],
    );
    expect(second.status).toBe(201);
    const secondBody = await readJson<{ data: { title: string; targetIbu: number; id: string } }>(second);
    expect(secondBody.data.title).toBe(created.title);
    expect(secondBody.data.targetIbu).toBe(created.targetIbu);
    expect(secondBody.data.id).not.toBe(created.id);
  });
});