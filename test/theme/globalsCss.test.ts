import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { THEMES } from "@/lib/theme/themes";

function loadGlobalsCss(): string {
  const url = new URL("../../src/app/globals.css", import.meta.url);
  return readFileSync(fileURLToPath(url), "utf8");
}

describe("globals.css theme blocks", () => {
  const css = loadGlobalsCss();

  for (const theme of THEMES) {
    it(`declares a [data-theme="${theme.id}"] block`, () => {
      expect(css).toContain(`[data-theme="${theme.id}"]`);
    });
  }

  it("maps every category badge to its own background + foreground tokens", () => {
    for (const category of ["beer", "mead", "wine", "cider", "other"]) {
      expect(css).toContain(`--badge-${category}-bg`);
      expect(css).toContain(`--badge-${category}-fg`);
    }
  });

  it("declares the three error tokens used by RecipeDetailClient", () => {
    expect(css).toContain("--error-bg");
    expect(css).toContain("--error-fg");
    expect(css).toContain("--error-border");
  });
});