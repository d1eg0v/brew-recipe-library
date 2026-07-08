// UI tests for the TagEditor client component (BRE-29).
//
// The component is a client component with `useTransition` and async fetch
// calls, so we only test its render-side shape with `renderToStaticMarkup` —
// the interactive paths are covered end-to-end by the API route tests.

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import TagEditor from "@/components/recipe/TagEditor";

describe("TagEditor", () => {
  it("renders the initial tags", () => {
    const html = renderToStaticMarkup(
      <TagEditor recipeId="r1" initialTags={["summer", "session"]} />,
    );
    expect(html).toContain("summer");
    expect(html).toContain("session");
    // Each tag has a remove button labelled for accessibility.
    expect(html).toContain("Remove tag summer");
    expect(html).toContain("Remove tag session");
  });

  it("renders the empty-state when no tags are present", () => {
    const html = renderToStaticMarkup(
      <TagEditor recipeId="r1" initialTags={[]} />,
    );
    expect(html).toContain("No tags yet");
  });

  it("shows the add-tag input and submit button", () => {
    const html = renderToStaticMarkup(
      <TagEditor recipeId="r1" initialTags={[]} />,
    );
    expect(html).toContain('aria-label="New tag"');
    expect(html).toContain("Add");
  });
});
