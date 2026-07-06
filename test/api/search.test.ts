// Search/filter clause builder tests — verify the where-clause Prisma receives.

import { describe, it, expect } from "vitest";

import { buildRecipeWhere } from "@/lib/api/search";
import type { RecipeListQuery } from "@/lib/api/schemas";

function where(q: Partial<RecipeListQuery>): Record<string, unknown> {
  return buildRecipeWhere({ limit: 50, offset: 0, ...q });
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
});
