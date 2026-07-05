import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME,
  STORAGE_KEY,
  THEMES,
  isThemeId,
  resolveInitialTheme,
} from "@/lib/theme/themes";
import { THEME_BOOT_SCRIPT } from "@/lib/theme/bootScript";

function makeStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
  } as Storage;
}

describe("theme module", () => {
  it("lists at least 4 themes, with two light and two dark options", () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(4);
    const lights = THEMES.filter((t) => t.mode === "light").map((t) => t.id);
    const darks = THEMES.filter((t) => t.mode === "dark").map((t) => t.id);
    expect(lights.length).toBeGreaterThanOrEqual(2);
    expect(darks.length).toBeGreaterThanOrEqual(2);
  });

  it("exposes a non-empty storage key", () => {
    expect(STORAGE_KEY).toBeTruthy();
    expect(typeof STORAGE_KEY).toBe("string");
  });

  it("isThemeId recognises the canonical ids and rejects everything else", () => {
    for (const t of THEMES) {
      expect(isThemeId(t.id)).toBe(true);
    }
    expect(isThemeId("nope")).toBe(false);
    expect(isThemeId("")).toBe(false);
    expect(isThemeId(null)).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
    expect(isThemeId(42)).toBe(false);
  });
});

describe("resolveInitialTheme", () => {
  it("returns the stored choice when localStorage has a valid id", () => {
    const storage = makeStorage({ [STORAGE_KEY]: "midnight" });
    expect(resolveInitialTheme(storage, null)).toBe("midnight");
  });

  it("falls back to prefers-color-scheme when nothing is stored", () => {
    expect(resolveInitialTheme(makeStorage(), { matches: true })).toBe("dark");
    expect(resolveInitialTheme(makeStorage(), { matches: false })).toBe(
      DEFAULT_THEME,
    );
    expect(resolveInitialTheme(makeStorage(), null)).toBe(DEFAULT_THEME);
  });

  it("ignores stored values that are not a known theme id", () => {
    const storage = makeStorage({ [STORAGE_KEY]: "fuchsia" });
    expect(resolveInitialTheme(storage, null)).toBe(DEFAULT_THEME);
    expect(resolveInitialTheme(storage, { matches: true })).toBe("dark");
  });

  it("tolerates a throwing localStorage (private mode)", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(resolveInitialTheme(broken, { matches: true })).toBe("dark");
    expect(resolveInitialTheme(broken, { matches: false })).toBe(DEFAULT_THEME);
  });

  it("survives a missing storage argument", () => {
    expect(resolveInitialTheme(undefined, undefined)).toBe(DEFAULT_THEME);
  });
});

describe("THEME_BOOT_SCRIPT", () => {
  it("is a non-empty string containing the storage key", () => {
    expect(typeof THEME_BOOT_SCRIPT).toBe("string");
    expect(THEME_BOOT_SCRIPT.length).toBeGreaterThan(0);
    expect(THEME_BOOT_SCRIPT).toContain(STORAGE_KEY);
  });

  it("mentions every known theme id so the inline script can validate", () => {
    for (const t of THEMES) {
      expect(THEME_BOOT_SCRIPT).toContain(t.id);
    }
  });

  it("references prefers-color-scheme as the fallback default", () => {
    expect(THEME_BOOT_SCRIPT).toContain("prefers-color-scheme");
  });

  it("sets data-theme on documentElement", () => {
    expect(THEME_BOOT_SCRIPT).toContain("data-theme");
    expect(THEME_BOOT_SCRIPT).toContain("documentElement");
  });
});