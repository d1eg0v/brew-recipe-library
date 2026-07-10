// Standalone seed loader — wipes the existing recipe tables, then inserts the
// curator's seed JSON. Intended to be invoked via `npm run db:seed`.
//
// BRE-44: also upserts the BJCP style-range seed (`bjcp.json`) so the
// recipe-detail view can flag in/out-of-range vitals. Style rows are keyed
// on `code` and are *upserted* (recipes are wiped-and-replaced; styles are
// idempotent) — re-running the seed should not drop manual style tweaks,
// and BJCP codes rarely change.

import { readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "@/lib/db";
import {
  loadSeedRecipes,
} from "@/lib/seed/load";
import {
  loadBjcpStyles,
  type BjcpStyleRow,
} from "@/lib/seed/loadBjcp";

const DEFAULT_SEED_PATH = path.resolve(
  process.cwd(),
  "prisma/seed/recipes.json",
);
const DEFAULT_BJCP_PATH = path.resolve(
  process.cwd(),
  "prisma/seed/bjcp.json",
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
  /** BJCP styles upserted (BRE-44). */
  bjcpUpserted: number;
  /** Source file the BJCP styles came from. */
  bjcpSource: string;
}

/**
 * Wipe existing recipe data and re-seed from `filePath`.
 *  - Existing rows are removed in dependency order before insertion.
 *  - Each recipe is inserted with its children atomically (nested create).
 *  - Title uniqueness is enforced by appending ` (copy)` to duplicates found
 *    within the same batch.
 *  - BJCP style rows are upserted by `code` so re-runs are idempotent.
 */
export async function seedFromFile(
  filePath: string = DEFAULT_SEED_PATH,
  bjcpPath: string = DEFAULT_BJCP_PATH,
): Promise<SeedReport> {
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
  // deleteMany on Recipe suffices. BjcpStyle is independent and is upserted
  // below rather than wiped.
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

  const bjcpUpserted = await upsertBjcpStyles(bjcpPath);

  return {
    loaded: recipes.length,
    inserted,
    deleted: deleted.count,
    source: filePath,
    bjcpUpserted,
    bjcpSource: bjcpPath,
  };
}

/**
 * Upsert BJCP style rows keyed on `code`. Existing rows are updated in place;
 * new codes are inserted. Returns the number of rows touched.
 */
export async function upsertBjcpStyles(
  bjcpPath: string = DEFAULT_BJCP_PATH,
): Promise<number> {
  const text = readFileSync(bjcpPath, "utf8");
  const rows = loadBjcpStyles(JSON.parse(text));
  let count = 0;
  for (const row of rows) {
    await prisma.bjcpStyle.upsert({
      where: { code: row.code },
      create: row as BjcpStyleRow,
      update: row as BjcpStyleRow,
    });
    count += 1;
  }
  return count;
}

// CLI entry: only when invoked directly via `tsx prisma/seed.ts`.
if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  seedFromFile()
    .then((report) => {
      console.log(
        `[seed] loaded=${report.loaded} inserted=${report.inserted} deleted=${report.deleted} source=${report.source}`,
      );
      console.log(
        `[seed] bjcp_upserted=${report.bjcpUpserted} source=${report.bjcpSource}`,
      );
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error("[seed] failed:", err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
