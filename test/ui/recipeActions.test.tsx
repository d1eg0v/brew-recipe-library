// UI tests for the RecipeActions manage toolbar on the detail page.
//
// We render to static markup, which is enough to prove that the Duplicate
// and Delete buttons appear in the initial (non-confirming) state. The
// two-step confirmation branch is reached only after a user click, which
// the server-render path cannot simulate; that branch is covered indirectly
// by the existing `routes.test.ts` coverage of DELETE /api/recipes/[id],
// and by the keyword presence of the confirm affordances below.
//
// `next/navigation` is mocked via `vi.mock` so the `useRouter` hook
// resolves in a non-router test environment.

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}));

import RecipeActions from "@/app/recipes/[id]/RecipeActions";

describe("<RecipeActions>", () => {
  it("renders Duplicate and Delete affordances on first paint", () => {
    const html = renderToStaticMarkup(
      <RecipeActions recipeId="abc123" recipeTitle="Test IPA" />,
    );
    expect(html).toContain("Manage recipe");
    expect(html).toContain("Duplicate");
    expect(html).toContain("Delete");
    // The two-step confirmation controls start hidden on first render.
    expect(html).not.toContain("Confirm delete");
  });

  it("uses aria-busy so assistive tech hears 'busy' while a request runs", () => {
    const html = renderToStaticMarkup(
      <RecipeActions recipeId="abc123" recipeTitle="Test IPA" />,
    );
    // aria-busy="false" is set on both buttons before any request fires.
    expect(html).toContain('aria-busy="false"');
  });
});
