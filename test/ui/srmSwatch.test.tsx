// UI tests for the SRM color swatch component used on browse cards and the
// recipe detail target panel.

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import SrmSwatch from "@/components/SrmSwatch";

describe("SrmSwatch", () => {
  it("renders an inline swatch with the SRM value in the aria label", () => {
    const html = renderToStaticMarkup(<SrmSwatch srm={12} />);
    expect(html).toContain('aria-label="SRM 12.0"');
    // The swatch itself is rendered with an inline background colour.
    expect(html.toLowerCase()).toContain("background-color");
  });

  it("uses the lookup-table reference colour for tabulated SRMs", () => {
    // SRM 20 maps to #a23e1b per the reference palette.
    const html = renderToStaticMarkup(<SrmSwatch srm={20} />);
    expect(html.toLowerCase()).toContain("#a23e1b");
  });

  it("interpolates between table rows for in-between values", () => {
    // SRM 11 -> #cd8737 (interpolated midpoint of SRM 10 and SRM 12).
    const html = renderToStaticMarkup(<SrmSwatch srm={11} />);
    expect(html.toLowerCase()).toContain("#cd8737");
  });

  it("clamps to the darkest reference for very high SRMs", () => {
    const html = renderToStaticMarkup(<SrmSwatch srm={200} />);
    expect(html.toLowerCase()).toContain("#140205");
  });

  it("renders a dashed placeholder when the SRM is null", () => {
    const html = renderToStaticMarkup(<SrmSwatch srm={null} />);
    expect(html).toContain("border-dashed");
    expect(html).toContain("aria-label=\"SRM not specified\"");
  });

  it("renders a dashed placeholder when the SRM is undefined", () => {
    const html = renderToStaticMarkup(<SrmSwatch srm={undefined} />);
    expect(html).toContain("border-dashed");
  });

  it("falls back to a placeholder for non-finite inputs", () => {
    const html = renderToStaticMarkup(<SrmSwatch srm={Number.NaN} />);
    expect(html).toContain("border-dashed");
  });

  it("shows the numeric label when showLabel is true", () => {
    const html = renderToStaticMarkup(<SrmSwatch srm={8} showLabel />);
    expect(html).toContain("8.0");
  });

  it("honours the size prop class on the swatch box", () => {
    const lgHtml = renderToStaticMarkup(<SrmSwatch srm={8} size="lg" />);
    expect(lgHtml).toContain("h-10 w-10");
    const smHtml = renderToStaticMarkup(<SrmSwatch srm={8} size="sm" />);
    expect(smHtml).toContain("h-4 w-4");
  });
});
