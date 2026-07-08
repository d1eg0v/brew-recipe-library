// Regression test for the UnitToggle hydration mismatch (BRE-30).
//
// The button label rendered on the server must match the first client render,
// otherwise React aborts hydration and regenerates the tree. We render the
// component twice — once in a "no document" pass (the SSR path) and once with
// a faked `data-units` differing from DEFAULT_UNIT_SYSTEM (the hydration
// path) — and assert the pressed state and rendered labels are identical in
// both. Together with the post-mount effect in the component itself, this
// pins both ends of the contract.
//
// Mirrors the shape of `test/ui/themeSwitcher.test.tsx` (BRE-22), since the
// two toggles share the same boot-script pattern.

import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { renderToStaticMarkup, renderToString } from "react-dom/server";

import UnitToggle from "@/components/UnitToggle";
import { DEFAULT_UNIT_SYSTEM, UNIT_SYSTEMS } from "@/lib/units/units";

type DocumentLike = {
  documentElement: {
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
  };
  addEventListener(): void;
  removeEventListener(): void;
};

function getDocumentSlot(): DocumentLike | undefined {
  return (globalThis as Record<string, unknown>).document as
    | DocumentLike
    | undefined;
}

function setDocumentSlot(value: DocumentLike | undefined): void {
  (globalThis as Record<string, unknown>).document = value;
}

describe("UnitToggle hydration (BRE-30)", () => {
  let originalDocument: DocumentLike | undefined;

  beforeEach(() => {
    originalDocument = getDocumentSlot();
  });

  afterEach(() => {
    setDocumentSlot(originalDocument);
    vi.restoreAllMocks();
  });

  function installDocumentWithUnits(units: string): void {
    const attrStore = new Map<string, string>([["data-units", units]]);
    const fakeDocument: DocumentLike = {
      documentElement: {
        getAttribute(name: string) {
          return attrStore.get(name) ?? null;
        },
        setAttribute(name: string, value: string) {
          attrStore.set(name, value);
        },
      },
      addEventListener() {},
      removeEventListener() {},
    };
    setDocumentSlot(fakeDocument);
  }

  it("renders without needing `document` (server SSR path)", () => {
    expect(getDocumentSlot()).toBeUndefined();

    const html = renderToStaticMarkup(<UnitToggle />);

    // Both options are rendered.
    expect(html).toContain("Metric");
    expect(html).toContain("Imperial");
    // Default unit system is pressed on the server.
    expect(html).toContain(`data-units-option="metric"`);
    expect(html).toContain(`data-units-option="imperial"`);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    // The role group wraps both buttons.
    expect(html).toContain('role="group"');
  });

  it("server output matches the first client render even when the boot script applied a non-default unit system", () => {
    // 1) Capture the server-rendered HTML (no DOM access).
    setDocumentSlot(undefined);
    const serverHtml = renderToString(<UnitToggle />);

    // 2) Simulate the browser after the inline boot script has run: a
    // `data-units` on <html> that differs from DEFAULT_UNIT_SYSTEM. The
    // first client render (i.e. before any effect fires) must still emit
    // the default pressed state — that's exactly what prevents the
    // hydration mismatch.
    installDocumentWithUnits("imperial");
    const clientFirstHtml = renderToString(<UnitToggle />);

    // Both renders must agree on which option is pressed; otherwise React
    // detects a hydration mismatch and aborts.
    expect(serverHtml).toContain(
      `data-units-option="${DEFAULT_UNIT_SYSTEM}" aria-pressed="true"`,
    );
    expect(clientFirstHtml).toContain(
      `data-units-option="${DEFAULT_UNIT_SYSTEM}" aria-pressed="true"`,
    );

    // The server must NOT leak the boot-script's chosen unit system into the
    // SSR markup; the boot script is the only thing allowed to flip it.
    expect(serverHtml).not.toContain(
      `data-units-option="imperial" aria-pressed="true"`,
    );
  });

  it("renders both unit systems as discrete options", () => {
    const html = renderToStaticMarkup(<UnitToggle />);
    for (const u of UNIT_SYSTEMS) {
      expect(html).toContain(`data-units-option="${u}"`);
    }
  });
});