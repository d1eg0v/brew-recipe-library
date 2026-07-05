// Standalone seed loader — wipes the existing recipe tables, then inserts the
// curator's seed JSON. Intended to be invoked via `npm run db:seed`.

import { readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "@/lib/db";
import {
  loadSeedRecipes,
} from "@/lib/seed/load";

const DEFAULT_SEED_PATH = path.resolve(
  process.cwd(),
  "prisma/seed/recipes.json",
);

export interface SeedReport {
  /** Recipes ingested from the source file (after validation). */
  loaded: number;
  /** Recipes inserted into the DB. */
  inserted: number;
  /** Recipes that already existed and were removed. */
  deleted: number;
  /** Source file the recipes came from. */
  source: string;
}

/**
 * Wipe existing recipe data and re-seed from `filePath`.
 *  - Existing rows are removed in dependency order before insertion.
 *  - Each recipe is inserted with its children atomically (nested create).
 *  - Title uniqueness is enforced by appending ` (copy)` to duplicates found
 *    within the same batch.
 */
export async function seedFromFile(filePath: string = DEFAULT_SEED_PATH): Promise<SeedReport> {
  const text = readFileSync(filePath, "utf8");
  const recipes = loadSeedRecipes(JSON.parse(text));

  // Deduplicate titles within the batch by appending a counter suffix — the
  // schema doesn't enforce uniqueness on `title` (we use `id`), but a UI
  // listing by title would otherwise show duplicates.
  const titleCounts = new Map<string, number>();
  for (const r of recipes) {
    const base = r.title;
    const seen = (titleCounts.get(base) ?? 0) + 1;
    titleCounts.set(base, seen);
    if (seen > 1) r.title = `${base} (${seen})`;
  }

  // Wipe existing rows. Children cascade-delete with `Recipe`, so a single
  // deleteMany on Recipe suffices.
  const deleted = await prisma.recipe.deleteMany({});

  let inserted = 0;
  for (const r of recipes) {
    const children = {
      fermentables: { create: (r.fermentables ?? []).map((c, i) => ({ ...c, position: c.position ?? i })) },
      hops: { create: (r.hops ?? []).map((c, i) => ({ ...c, position: c.position ?? i })) },
      yeasts: { create: (r.yeasts ?? []).map((c, i) => ({ ...c, position: c.position ?? i })) },
      mashSteps: { create: (r.mashSteps ?? []).map((c, i) => ({ ...c, position: c.position ?? i })) },
      processSteps: { create: (r.processSteps ?? []).map((c, i) => ({ ...c, position: c.position ?? i })) },
      additions: { create: (r.additions ?? []).map((c, i) => ({ ...c, position: c.position ?? i })) },
    };
    const { ...scalars } = r;
    await prisma.recipe.create({
      data: { ...scalars, ...children },
    });
    inserted++;
  }

  return {
    loaded: recipes.length,
    inserted,
    deleted: deleted.count,
    source: filePath,
  };
}

// CLI entry: only when invoked directly via `tsx prisma/seed.ts`.
if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  seedFromFile()
    .then((report) => {
      console.log(
        `[seed] loaded=${report.loaded} inserted=${report.inserted} deleted=${report.deleted} source=${report.source}`,
      );
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error("[seed] failed:", err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
