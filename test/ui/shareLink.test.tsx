// UI tests for the owner-side ShareLink component (BRE-43).
//
// The component fetches from `/api/recipes/[id]/share` and renders either an
// "Enable sharing" CTA or the share URL + a "Stop sharing" button. We render
// to static markup (no DOM) for the two initial states and verify the
// conditional branches don't leak owner-only copy into the shareable state
// (and vice versa).

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import ShareLink from "@/components/recipe/ShareLink";
import type { RecipeDetail } from "@/lib/ui/types";

function makeRecipe(overrides: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    id: "rec_share_test",
    title: "Test IPA",
    author: null,
    description: null,
    notes: null,
    category: "beer",
    styleName: null,
    bjcpCategory: null,
    batchSizeLiters: 20,
    batchSizeGallons: null,
    boilTimeMinutes: 60,
    efficiencyPct: 75,
    targetOg: null,
    targetFg: null,
    targetPh: null,
    targetAbv: null,
    targetIbu: null,
    targetSrm: null,
    fermentables: [],
    hops: [],
    yeasts: [],
    mashSteps: [],
    processSteps: [],
    additions: [],
    tags: [],
    tagDetails: [],
    shareable: false,
    shareUrl: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ShareLink", () => {
  it("renders an Enable sharing button when the recipe is not shareable", () => {
    const recipe = makeRecipe();
    const html = renderToStaticMarkup(<ShareLink recipe={recipe} />);
    expect(html).toContain("Share link");
    expect(html).toContain("Enable sharing");
    expect(html).not.toContain("Stop sharing");
    expect(html).not.toContain("data-testid=\"share-url-input\"");
  });

  it("renders the share URL and Stop sharing when shareable", () => {
    const recipe = makeRecipe({
      shareable: true,
      shareUrl: "https://brew.example.com/share/abc123",
    });
    const html = renderToStaticMarkup(<ShareLink recipe={recipe} />);
    expect(html).toContain("https://brew.example.com/share/abc123");
    expect(html).toContain("Copy");
    expect(html).toContain("Stop sharing");
    expect(html).not.toContain("Enable sharing");
  });
});

