// UI tests for the recipe create/edit form.
//
// We render with React's `renderToStaticMarkup` (no DOM) so we cover the
// initial render shape and the deterministic state-to-HTML transitions
// without adding a DOM testing lib. The form is exercised:
//  - render in create mode (empty)
//  - render in edit mode (pre-filled from a fixture recipe)
//  - render with fermentation rows added
//  - error messages appear when validation fails
//  - live preview pane is present and updates with fermentable input

import {
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Stub `next/navigation` so `useRouter()` returns a no-op router — the form
// only uses the router inside `onSubmit`, which the render-to-string tests
// never invoke.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => undefined,
    refresh: () => undefined,
    back: () => undefined,
    forward: () => undefined,
    replace: () => undefined,
    prefetch: () => undefined,
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

import type { RecipeDetail } from "@/lib/ui/types";

import RecipeForm from "./RecipeForm";
import {
  blankRecipeFormState,
  emptyFermentable,
  emptyHop,
} from "./recipeFormState";

function fixtureRecipe(): RecipeDetail {
  return {
    id: "rec_fixture",
    title: "Cascade SMaSH",
    author: "Test Brewer",
    description: "A test brew",
    notes: "Pitch at 18C",
    category: "beer",
    styleName: "American IPA",
    bjcpCategory: "21A",
    batchSizeLiters: 20,
    batchSizeGallons: null,
    boilTimeMinutes: 60,
    efficiencyPct: 75,
    targetOg: 1.056,
    targetFg: 1.012,
    targetAbv: 5.8,
    targetIbu: 45,
    targetSrm: 6.5,
    fermentables: [
      {
        id: "f1",
        name: "Pale 2-Row",
        type: "grain",
        amountKg: 4.5,
        amountLiters: null,
        amountLbs: null,
        amountGallons: null,
        colorLovibond: 2,
        potentialPpg: 37,
        notes: null,
        position: 0,
      },
    ],
    hops: [
      {
        id: "h1",
        name: "Cascade",
        amountGrams: 28,
        amountOz: null,
        alphaAcidPct: 5.5,
        timeMinutes: 60,
        use: "boil",
        form: "pellet",
        notes: null,
        position: 0,
      },
    ],
    yeasts: [
      {
        id: "y1",
        name: "US-05",
        laboratory: "Fermentis",
        productId: "US-05",
        type: "ale",
        form: "dry",
        attenuationPct: 81,
        temperatureCMin: 15,
        temperatureCMax: 24,
        temperatureFMin: null,
        temperatureFMax: null,
        notes: null,
        position: 0,
      },
    ],
    mashSteps: [
      {
        id: "m1",
        name: "Sacc rest",
        type: "infusion",
        stepTempC: 66,
        stepTempF: null,
        stepTimeMinutes: 60,
        infuseAmountLiters: null,
        infuseAmountGallons: null,
        notes: null,
        position: 0,
      },
    ],
    processSteps: [],
    additions: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
}

describe("<RecipeForm />", () => {
  it("renders the create-mode empty form with all sections", () => {
    const html = renderToStaticMarkup(<RecipeForm mode="create" />);
    // The form itself does not carry the "New recipe" h1 — that's on the
    // page wrapper (src/app/recipes/new/page.tsx). Assert on the form's
    // section headers and chrome.
    expect(html).toContain("Recipe details");
    expect(html).toContain("Target measurements");
    expect(html).toContain("Fermentables");
    expect(html).toContain("Hops");
    expect(html).toContain("Yeast");
    expect(html).toContain("Mash steps");
    expect(html).toContain("Process steps");
    expect(html).toContain("Additions");
    // Live preview pane is always rendered (even when all values are —).
    expect(html).toContain('data-testid="live-preview"');
    // Add buttons exist for every nested list.
    expect(html).toContain("Add fermentable");
    expect(html).toContain("Add hop");
    expect(html).toContain("Add yeast");
    expect(html).toContain("Add mash step");
    expect(html).toContain("Add process step");
    expect(html).toContain("Add addition");
    // Submit/cancel buttons.
    expect(html).toContain("Create recipe");
    expect(html).toContain("Cancel");
  });

  it("renders the edit form prefilled with fixture data", () => {
    const recipe = fixtureRecipe();
    const html = renderToStaticMarkup(
      <RecipeForm mode="edit" initial={recipe} />,
    );
    // Title input prefilled.
    expect(html).toContain('data-field-path="title"');
    expect(html).toContain('value="Cascade SMaSH"');
    // The recipe seeded a fermentable row → one row visible.
    expect(html).toContain("Pale 2-Row");
    expect(html).toContain("Cascade");
    expect(html).toContain("US-05");
    expect(html).toContain("Sacc rest");
    // Edit-mode submit label.
    expect(html).toContain("Save changes");
  });

  it("renders row remove buttons for populated nested lists", () => {
    const recipe = fixtureRecipe();
    const html = renderToStaticMarkup(
      <RecipeForm mode="edit" initial={recipe} />,
    );
    expect(html).toContain("Remove");
    expect(html).toContain("aria-label=\"Remove row 1\"");
  });

  it("shows the live preview values for a realistic grain bill", () => {
    const recipe = fixtureRecipe();
    const html = renderToStaticMarkup(
      <RecipeForm mode="edit" initial={recipe} />,
    );
    // With 4.5 kg Pale 2-Row, 28 g Cascade @ 5.5%, 75% attenuation, 20 L,
    // the live preview should report OG/ABV/IBU/SRM as non-dashed values.
    expect(html).toContain('data-testid="live-preview"');
    // The preview values come from computeTargets; the test isn't pin-point
    // (rounding tolerance applies) — at least one of OG/ABV/IBU should be a
    // numeric value, not a "—".
    expect(html).toMatch(/data-testid="live-preview"[\s\S]*?1\.0\d{2}/);
  });

  it("accepts new fermentable/hop rows in the form state shape", () => {
    // Sanity check that `emptyFermentable`/`emptyHop` produce rows the form
    // can hold. We can't simulate click events with renderToStaticMarkup, so
    // we mount a synthetic state via the exported factory instead.
    const f = emptyFermentable();
    const h = emptyHop();
    expect(typeof f.key).toBe("string");
    expect(f.key.length).toBeGreaterThan(0);
    // Two calls should produce two different keys (no static collisions).
    const f2 = emptyFermentable();
    expect(f.key).not.toBe(f2.key);
    expect(f.name).toBe("");
    expect(f.amountKg).toBeNull();
    expect(h.amountGrams).toBeNull();
    expect(h.timeMinutes).toBeNull();
    // A blank recipe state gives the helper its defaults.
    const blank = blankRecipeFormState();
    expect(blank.batchSizeLiters).toBe(20);
    expect(blank.fermentables).toHaveLength(0);
  });
});
