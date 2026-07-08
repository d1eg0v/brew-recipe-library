// Test helpers for spinning up an isolated SQLite database per test file.
//
// Each call to `setupTestDatabase` returns a client pointing at a temp DB with
// the migrations applied. The DB file is removed when the caller invokes the
// returned `teardown`. Tests that mutate the DB should call `resetDatabase` in
// their `beforeEach` to start from a clean slate.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { execSync } from "node:child_process";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

export interface TestDatabase {
  prisma: PrismaClient;
  databaseUrl: string;
  reset: () => Promise<void>;
  teardown: () => Promise<void>;
}

function runMigrations(databaseUrl: string) {
  // Run the CLI migration step against the temp DB. We do this synchronously
  // so the test setup is deterministic.
  execSync(
    `node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma`,
    {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
      cwd: process.cwd(),
    },
  );
}

export async function setupTestDatabase(): Promise<TestDatabase> {
  const dir = mkdtempSync(path.join(tmpdir(), "brew-recipe-test-"));
  const file = path.join(dir, "test.db");
  const databaseUrl = `file:${file}`;

  // Apply schema migrations to the temp file.
  runMigrations(databaseUrl);

  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  return {
    prisma,
    databaseUrl,
    async reset() {
      // Order matches the cascade — children first so FK constraints stay happy
      // even when running against a DB built without cascades.
      await prisma.recipeTag.deleteMany();
      await prisma.tag.deleteMany();
      await prisma.batch.deleteMany();
      await prisma.addition.deleteMany();
      await prisma.processStep.deleteMany();
      await prisma.mashStep.deleteMany();
      await prisma.yeast.deleteMany();
      await prisma.hop.deleteMany();
      await prisma.fermentable.deleteMany();
      await prisma.recipe.deleteMany();
    },
    async teardown() {
      await prisma.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** A minimal "valid recipe" payload suitable for POST /api/recipes. */
export function fixtureRecipe(overrides: Record<string, unknown> = {}) {
  return {
    title: "Test IPA",
    category: "beer",
    styleName: "American IPA",
    bjcpCategory: "21A",
    batchSizeLiters: 20,
    boilTimeMinutes: 60,
    efficiencyPct: 75,
    targetOg: 1.06,
    targetFg: 1.012,
    targetAbv: 6.3,
    targetIbu: 60,
    targetSrm: 6,
    fermentables: [
      { name: "Pale 2-Row", type: "grain", amountKg: 4.5 },
    ],
    hops: [
      { name: "Cascade", amountGrams: 25, timeMinutes: 60, use: "boil" },
    ],
    yeasts: [{ name: "US-05", form: "dry", attenuationPct: 81 }],
    mashSteps: [
      {
        name: "Sacc rest",
        type: "infusion",
        stepTempC: 66,
        stepTimeMinutes: 60,
      },
    ],
    processSteps: [],
    additions: [],
    ...overrides,
  };
}
