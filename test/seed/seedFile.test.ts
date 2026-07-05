// End-to-end seed loader test against a real SQLite database.

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import path from "node:path";

import {
  setupTestDatabase,
  type TestDatabase,
} from "../helpers/db";

let db: TestDatabase;
let seedFromFile: typeof import("@/../prisma/seed")["seedFromFile"];

beforeAll(async () => {
  db = await setupTestDatabase();
  // The seed loader imports `@/lib/db`; mock it to use the test DB.
  vi.doMock("@/lib/db", () => ({ prisma: db.prisma }));
  const mod = await import("@/../prisma/seed");
  seedFromFile = mod.seedFromFile;
});

beforeEach(async () => {
  await db.reset();
});

afterAll(async () => {
  await db.teardown();
});

describe("seedFromFile", () => {
  it("ingests the curated seed JSON and replaces existing rows", async () => {
    const seedPath = path.resolve(
      process.cwd(),
      "prisma/seed/recipes.json",
    );
    const report = await seedFromFile(seedPath);
    expect(report.loaded).toBeGreaterThanOrEqual(12);
    expect(report.inserted).toBe(report.loaded);
    expect(report.source).toBe(seedPath);

    const total = await db.prisma.recipe.count();
    expect(total).toBe(report.inserted);

    const cats = await db.prisma.recipe.groupBy({
      by: ["category"],
      _count: { _all: true },
    });
    // We don't know exact counts ahead of time, but at least these should be
    // present in any reasonable seed set for this project.
    const names = cats.map((c) => c.category);
    expect(names).toContain("beer");

    // Re-seeding clears the previous batch.
    const second = await seedFromFile(seedPath);
    expect(second.loaded).toBe(report.loaded);
    expect((await db.prisma.recipe.count())).toBe(second.inserted);
  });
});
