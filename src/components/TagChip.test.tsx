// UI tests for the TagChip component (BRE-29).

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import TagChip, { tagBrowseHref } from "@/components/TagChip";

describe("TagChip", () => {
  it("renders the tag with a # prefix", () => {
    const html = renderToStaticMarkup(<TagChip name="session" />);
    expect(html).toContain("#");
    expect(html).toContain("session");
  });

  it("renders nothing for empty / whitespace-only names", () => {
    const html = renderToStaticMarkup(<TagChip name="   " />);
    expect(html).toBe("");
  });

  it("renders as a link to the browse page when asLink is true", () => {
    const html = renderToStaticMarkup(<TagChip name="Summer" asLink />);
    expect(html).toContain('href="/?tag=summer"');
  });

  it("applies the sm size class when requested", () => {
    const html = renderToStaticMarkup(<TagChip name="x" size="sm" />);
    expect(html).toContain("text-[10px]");
  });
});

describe("tagBrowseHref", () => {
  it("encodes the normalised name as a query param", () => {
    expect(tagBrowseHref("Summer Brews")).toBe("/?tag=summer+brews");
  });

  it("returns '/' for empty input", () => {
    expect(tagBrowseHref("   ")).toBe("/");
  });
});
