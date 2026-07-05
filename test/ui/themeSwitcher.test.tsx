// Regression test for the ThemeSwitcher hydration mismatch (BRE-22).
//
// The button label rendered on the server must match the first client render,
// otherwise React aborts hydration and regenerates the tree. When that
// regeneration happens, the JSX literal `data-theme="light"` on <html> is
// re-applied and the boot-script's stored choice is lost — which is exactly
// what the user reported as "themes don't stick after a refresh".
//
// We render the component twice — once in a "no document" pass (the SSR
// path) and once with a faked `data-theme` differing from DEFAULT_THEME (the
// hydration path) — and assert the rendered label text is identical in
// both. Together with the post-mount effect in the component itself, this
// pins both ends of the contract.

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { renderToStaticMarkup, renderToString } from "react-dom/server";

import ThemeSwitcher from "@/components/ThemeSwitcher";
import { DEFAULT_THEME, THEMES } from "@/lib/theme/themes";

// The label the button must show on first render (server and client agree).
const INITIAL_LABEL = (THEMES.find((t) => t.id === DEFAULT_THEME) ?? THEMES[0])
  .label;

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

describe("ThemeSwitcher hydration (BRE-22)", () => {
  let originalDocument: DocumentLike | undefined;

  beforeEach(() => {
    originalDocument = getDocumentSlot();
  });

  afterEach(() => {
    setDocumentSlot(originalDocument);
    vi.restoreAllMocks();
  });

  function installDocumentWithTheme(theme: string): void {
    const attrStore = new Map<string, string>([["data-theme", theme]]);
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

    const html = renderToStaticMarkup(<ThemeSwitcher />);

    expect(html).toContain(INITIAL_LABEL);
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="listbox"');
  });

  it("server output matches the first client render even when the boot script applied a non-default theme", () => {
    // 1) Capture the server-rendered HTML (no DOM access).
    setDocumentSlot(undefined);
    const serverHtml = renderToString(<ThemeSwitcher />);

    // 2) Simulate the browser after the inline boot script has run: a
    // `data-theme` on <html> that differs from DEFAULT_THEME. The first
    // client render (i.e. before any effect fires) must still emit the
    // default label — that's exactly what prevents the hydration mismatch.
    installDocumentWithTheme("midnight");
    const clientFirstHtml = renderToString(<ThemeSwitcher />);

    // Both renders must agree on the label, otherwise React's hydration
    // check fails (server says "Light", client says "Midnight").
    expect(serverHtml).toContain(INITIAL_LABEL);
    expect(clientFirstHtml).toContain(INITIAL_LABEL);

    // And the server must NOT leak the boot-script's chosen theme into the
    // SSR markup (the boot script is the only thing allowed to set it).
    expect(serverHtml).not.toContain(">Midnight<");
  });
});