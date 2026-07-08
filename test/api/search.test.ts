// Search/filter clause builder tests — verify the where-clause Prisma receives.

import { describe, it, expect } from "vitest";

import {
  buildRecipeOrderBy,
  buildRecipeWhere,
} from "@/lib/api/search";
import type {
  RecipeListQuery,
  RecipeSortDir,
  RecipeSortField,
} from "@/lib/api/schemas";

function where(q: Partial<RecipeListQuery> = {}): Record<string, unknown> {
  return buildRecipeWhere({
    limit: 50,
    offset: 0,
    sort: "date",
    dir: "desc",
    ...q,
  });
}

describe("buildRecipeWhere", () => {
  it("returns an empty object when no filters are supplied", () => {
    expect(where({})).toEqual({});
  });

  it("compiles a category filter", () => {
    expect(where({ category: "wine" })).toEqual({ category: "wine" });
  });

  it("compiles ABV bounds", () => {
    expect(where({ abvMin: 4, abvMax: 8 })).toEqual({
      targetAbv: { gte: 4, lte: 8 },
    });
  });

  it("compiles IBU bounds", () => {
    expect(where({ ibuMin: 20, ibuMax: 60 })).toEqual({
      targetIbu: { gte: 20, lte: 60 },
    });
  });

  it("compiles SRM bounds", () => {
    expect(where({ srmMin: 4, srmMax: 12 })).toEqual({
      targetSrm: { gte: 4, lte: 12 },
    });
  });

  it("compiles OG bounds", () => {
    expect(where({ ogMin: 1.05, ogMax: 1.075 })).toEqual({
      targetOg: { gte: 1.05, lte: 1.075 },
    });
  });

  it("treats open-ended bounds as gte/lte-only", () => {
    expect(where({ ibuMin: 50 })).toEqual({ targetIbu: { gte: 50 } });
    expect(where({ ogMax: 1.06 })).toEqual({ targetOg: { lte: 1.06 } });
  });

  it("stacks all four range filters in one where clause", () => {
    expect(
      where({
        abvMin: 4,
        abvMax: 8,
        ibuMin: 20,
        ibuMax: 60,
        srmMin: 4,
        srmMax: 12,
        ogMin: 1.04,
        ogMax: 1.08,
      }),
    ).toEqual({
      targetAbv: { gte: 4, lte: 8 },
      targetIbu: { gte: 20, lte: 60 },
      targetSrm: { gte: 4, lte: 12 },
      targetOg: { gte: 1.04, lte: 1.08 },
    });
  });

  it("stacks ABV bounds with category", () => {
    expect(
      where({ category: "beer", abvMin: 5, abvMax: 9 }),
    ).toEqual({
      category: "beer",
      targetAbv: { gte: 5, lte: 9 },
    });
  });

  it("combines q + ingredient into a single OR with subqueries", () => {
    const out = where({ q: "ipa", ingredient: "Cascade" });
    const or = out.OR as Array<Record<string, unknown>>;
    expect(or).toHaveLength(7);
    expect(or.slice(0, 4)).toEqual([
      { title: { contains: "ipa" } },
      { author: { contains: "ipa" } },
      { description: { contains: "ipa" } },
      { notes: { contains: "ipa" } },
    ]);
    expect(or[4]).toEqual({
      fermentables: { some: { name: { contains: "Cascade" } } },
    });
    expect(or[5]).toEqual({
      hops: { some: { name: { contains: "Cascade" } } },
    });
    expect(or[6]).toEqual({
      yeasts: { some: { name: { contains: "Cascade" } } },
    });
  });

  it("escapes LIKE wildcards in ingredient names", () => {
    const out = where({ ingredient: "50% Wheat" });
    expect(out.OR).toEqual([
      {
        fermentables: { some: { name: { contains: "50\\% Wheat" } } },
      },
      {
        hops: { some: { name: { contains: "50\\% Wheat" } } },
      },
      {
        yeasts: { some: { name: { contains: "50\\% Wheat" } } },
      },
    ]);
  });

  it("escapes LIKE wildcards in q", () => {
    const out = where({ q: "100% wheat" });
    expect(out.OR).toEqual([
      { title: { contains: "100\\% wheat" } },
      { author: { contains: "100\\% wheat" } },
      { description: { contains: "100\\% wheat" } },
      { notes: { contains: "100\\% wheat" } },
    ]);
  });

  it("trims whitespace around q before compiling", () => {
    const out = where({ q: "  ipa  " });
    expect(out.OR).toEqual([
      { title: { contains: "ipa" } },
      { author: { contains: "ipa" } },
      { description: { contains: "ipa" } },
      { notes: { contains: "ipa" } },
    ]);
  });

  it("ignores q when blank", () => {
    expect(where({ q: "" })).toEqual({});
    expect(where({ q: "   " })).toEqual({});
  });

  it("supports style name substring matching", () => {
    expect(where({ style: "Pale" })).toEqual({
      styleName: { contains: "Pale" },
    });
  });

  it("compiles a tag filter that matches the join on the normalised name", () => {
    expect(where({ tag: "Session" })).toEqual({
      recipeTags: { some: { tag: { name: "session" } } },
    });
  });

  it("ignores a blank tag value", () => {
    expect(where({ tag: "   " })).toEqual({});
  });

  it("combines tag + ABV bounds in the same where clause", () => {
    const out = where({ tag: "summer", abvMin: 4, abvMax: 7 });
    expect(out.recipeTags).toEqual({
      some: { tag: { name: "summer" } },
    });
    expect(out.targetAbv).toEqual({ gte: 4, lte: 7 });
  });
});

describe("buildRecipeOrderBy", () => {
  const cases: Array<{
    sort: RecipeSortField;
    dir: RecipeSortDir;
    primary: Record<string, RecipeSortDir>;
  }> = [
    { sort: "name", dir: "asc", primary: { title: "asc" } },
    { sort: "name", dir: "desc", primary: { title: "desc" } },
    { sort: "abv", dir: "asc", primary: { targetAbv: "asc" } },
    { sort: "abv", dir: "desc", primary: { targetAbv: "desc" } },
    { sort: "ibu", dir: "asc", primary: { targetIbu: "asc" } },
    { sort: "ibu", dir: "desc", primary: { targetIbu: "desc" } },
    { sort: "gravity", dir: "asc", primary: { targetOg: "asc" } },
    { sort: "gravity", dir: "desc", primary: { targetOg: "desc" } },
    { sort: "date", dir: "asc", primary: { createdAt: "asc" } },
    { sort: "date", dir: "desc", primary: { createdAt: "desc" } },
  ];

  for (const c of cases) {
    it(`maps ${c.sort}/${c.dir} to ${JSON.stringify(c.primary)} + id tiebreak`, () => {
      const out = buildRecipeOrderBy(c.sort, c.dir);
      expect(out).toHaveLength(2);
      expect(out[0]).toEqual(c.primary);
      expect(out[1]).toEqual({ id: "asc" });
    });
  }
});
