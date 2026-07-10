import { describe, expect, it } from "vitest";

import {
  DEFAULT_UNIT_SYSTEM,
  STORAGE_KEY,
  UNIT_SYSTEMS,
  isUnitSystem,
  resolveInitialUnitSystem,
} from "@/lib/units/units";
import { UNIT_BOOT_SCRIPT } from "@/lib/units/bootScript";

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

describe("units module", () => {
  it("exposes exactly the two known unit systems", () => {
    expect(UNIT_SYSTEMS).toEqual(["metric", "imperial"]);
  });

  it("exposes a non-empty storage key that matches no theme key", () => {
    expect(STORAGE_KEY).toBeTruthy();
    expect(typeof STORAGE_KEY).toBe("string");
    expect(STORAGE_KEY).not.toBe("brew-theme");
  });

  it("defaults to metric", () => {
    expect(DEFAULT_UNIT_SYSTEM).toBe("metric");
  });

  it("isUnitSystem recognises the canonical ids and rejects everything else", () => {
    for (const u of UNIT_SYSTEMS) {
      expect(isUnitSystem(u)).toBe(true);
    }
    expect(isUnitSystem("nope")).toBe(false);
    expect(isUnitSystem("")).toBe(false);
    expect(isUnitSystem(null)).toBe(false);
    expect(isUnitSystem(undefined)).toBe(false);
    expect(isUnitSystem(42)).toBe(false);
    expect(isUnitSystem({})).toBe(false);
  });
});

describe("resolveInitialUnitSystem", () => {
  it("returns the stored choice when localStorage has a valid id", () => {
    const storage = makeStorage({ [STORAGE_KEY]: "imperial" });
    expect(resolveInitialUnitSystem(storage)).toBe("imperial");
  });

  it("falls back to the default when nothing is stored", () => {
    expect(resolveInitialUnitSystem(makeStorage())).toBe(DEFAULT_UNIT_SYSTEM);
  });

  it("ignores stored values that are not a known unit system", () => {
    const storage = makeStorage({ [STORAGE_KEY]: "furlongs" });
    expect(resolveInitialUnitSystem(storage)).toBe(DEFAULT_UNIT_SYSTEM);
  });

  it("tolerates a throwing localStorage (private mode)", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(resolveInitialUnitSystem(broken)).toBe(DEFAULT_UNIT_SYSTEM);
  });

  it("survives a missing storage argument", () => {
    expect(resolveInitialUnitSystem(null)).toBe(DEFAULT_UNIT_SYSTEM);
    expect(resolveInitialUnitSystem(undefined)).toBe(DEFAULT_UNIT_SYSTEM);
  });
});

describe("UNIT_BOOT_SCRIPT", () => {
  it("is a non-empty string containing the storage key", () => {
    expect(typeof UNIT_BOOT_SCRIPT).toBe("string");
    expect(UNIT_BOOT_SCRIPT.length).toBeGreaterThan(0);
    expect(UNIT_BOOT_SCRIPT).toContain(STORAGE_KEY);
  });

  it("mentions every known unit system so the inline script can validate", () => {
    for (const u of UNIT_SYSTEMS) {
      expect(UNIT_BOOT_SCRIPT).toContain(u);
    }
  });

  it("sets data-units on documentElement", () => {
    expect(UNIT_BOOT_SCRIPT).toContain("data-units");
    expect(UNIT_BOOT_SCRIPT).toContain("documentElement");
  });

  it("wraps the body in an IIFE so it does not leak globals", () => {
    expect(UNIT_BOOT_SCRIPT.trimStart()).toMatch(/^\(function\s*\(\)/);
  });

  it("never throws on a missing localStorage (try/catch envelope)", () => {
    expect(UNIT_BOOT_SCRIPT).toMatch(/try\s*{[\s\S]*}\s*catch/);
  });
});