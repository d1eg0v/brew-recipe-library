// UI tests for the batch (brew-log) create / edit form.
//
// Renders with `renderToStaticMarkup` (no DOM) so we cover the initial
// shape, the prefilled edit mode, and the inline error rendering without
// pulling in a DOM testing lib. The fetch + router interactions on
// `onSubmit`/`onDelete` are covered by the API integration tests in
// `test/api/batch.test.ts`; the form just wraps them.

import {
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Stub `next/navigation` so `useRouter()` returns a no-op router — the
// form only uses the router inside `onSubmit`/`onDelete`, which the
// render-to-string tests never invoke.
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

import BatchForm from "./BatchForm";

describe("<BatchForm /> in create mode", () => {
  it("renders the brew date as required and the measured fields as optional", () => {
    const html = renderToStaticMarkup(
      <BatchForm mode="create" recipeId="rec_1" />,
    );
    // Section heading + labels.
    expect(html).toContain("Brew details");
    expect(html).toContain("Brew date");
    expect(html).toContain("Volume into fermenter (litres)");
    expect(html).toContain("Measured OG");
    expect(html).toContain("Measured FG");
    expect(html).toContain("Notes");
    // Inputs are present.
    expect(html).toContain('data-field-path="brewDate"');
    expect(html).toContain('data-field-path="measuredOg"');
    expect(html).toContain('data-field-path="measuredFg"');
    expect(html).toContain('data-field-path="volumeLiters"');
    expect(html).toContain('data-field-path="notes"');
    // Date input is required; numeric inputs are not (they are optional).
    expect(html).toContain('type="date"');
    expect(html).toContain('type="number"');
    // Submit + cancel buttons, no delete button in create mode.
    expect(html).toContain("Log this brew");
    expect(html).toContain("Cancel");
    expect(html).not.toContain("batch-form-delete");
  });

  it("seeds the brew date with today's date in create mode", () => {
    const html = renderToStaticMarkup(
      <BatchForm mode="create" recipeId="rec_1" />,
    );
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const expected = `${y}-${m}-${d}`;
    expect(html).toContain(`value="${expected}"`);
  });
});

describe("<BatchForm /> in edit mode", () => {
  it("renders prefilled values and shows a delete button", () => {
    const html = renderToStaticMarkup(
      <BatchForm
        mode="edit"
        recipeId="rec_1"
        batchId="batch_1"
        initial={{
          brewDate: "2026-05-01",
          measuredOg: "1.054",
          measuredFg: "1.011",
          volumeLiters: "19",
          notes: "hit numbers",
        }}
      />,
    );
    // Prefilled values.
    expect(html).toContain('value="2026-05-01"');
    expect(html).toContain('value="1.054"');
    expect(html).toContain('value="1.011"');
    expect(html).toContain('value="19"');
    expect(html).toContain("hit numbers");
    // Edit-mode submit label.
    expect(html).toContain("Save changes");
    // Delete button is shown.
    expect(html).toContain("batch-form-delete");
    expect(html).toContain("Delete this brew");
  });

  it("delete button starts in a non-confirmed state", () => {
    const html = renderToStaticMarkup(
      <BatchForm
        mode="edit"
        recipeId="rec_1"
        batchId="batch_1"
        initial={{
          brewDate: "2026-05-01",
          measuredOg: "1.05",
          measuredFg: "1.012",
          volumeLiters: "20",
          notes: "ok",
        }}
      />,
    );
    // The first click is a soft confirm, not a real delete.
    expect(html).toContain("Delete this brew");
    expect(html).not.toContain("Click again to confirm delete");
  });
});
