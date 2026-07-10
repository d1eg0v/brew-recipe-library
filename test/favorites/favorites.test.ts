// Unit tests for the favorites storage module (BRE-46).
//
// Drives `localStorage` through an in-memory `Storage`-like helper so the
// tests run in plain Node (no jsdom needed). Mirrors the style of
// `test/units/units.test.ts`.

import { describe, expect, it } from "vitest";

import {
  FAVORITES_CHANGE_EVENT,
  FAVORITES_STORAGE_KEY,
  type StorageLike,
  isFavoriteId,
  parseFavorites,
  readFavorites,
  toggleFavoriteId,
  writeFavorites,
} from "@/lib/favorites/favorites";
import { FAVORITES_BOOT_SCRIPT } from "@/lib/favorites/bootScript";

function makeStorage(initial: Record<string, string> = {}): StorageLike {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? (data.get(key) as string) : null),
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, String(value));
    },
  };
}

describe("favorites module", () => {
  it("uses the brew-favorites key and never collides with theme/units keys", () => {
    expect(FAVORITES_STORAGE_KEY).toBe("brew-favorites");
    expect(FAVORITES_STORAGE_KEY).not.toBe("brew-theme");
    expect(FAVORITES_STORAGE_KEY).not.toBe("brew-units");
  });

  it("exposes a stable change-event name", () => {
    expect(FAVORITES_CHANGE_EVENT).toBe("brew-favorites-change");
  });
});

describe("parseFavorites", () => {
  it("returns an empty list for null input", () => {
    expect(parseFavorites(null)).toEqual([]);
  });

  it("returns an empty list for empty string", () => {
    expect(parseFavorites("")).toEqual([]);
  });

  it("returns an empty list for malformed JSON", () => {
    expect(parseFavorites("not-json")).toEqual([]);
  });

  it("returns an empty list for non-array JSON", () => {
    expect(parseFavorites('{"a":1}')).toEqual([]);
    expect(parseFavorites("42")).toEqual([]);
    expect(parseFavorites('"hello"')).toEqual([]);
  });

  it("parses a valid array of ids", () => {
    expect(parseFavorites('["rec-1","rec-2"]')).toEqual(["rec-1", "rec-2"]);
  });

  it("drops non-string entries and blanks", () => {
    expect(
      parseFavorites('[null, "", "  ", 42, "rec-1", "rec-1", "rec-2"]'),
    ).toEqual(["rec-1", "rec-2"]);
  });

  it("dedupes while preserving first-seen order", () => {
    expect(parseFavorites('["a", "b", "a", "c", "b"]')).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("trims whitespace around ids", () => {
    // Double-quoted JS string so the JSON sees a literal `\n` escape,
    // not a bare newline (which would break the JSON parser).
    expect(parseFavorites('["  rec-1  ", "rec-2\\n"]')).toEqual([
      "rec-1",
      "rec-2",
    ]);
  });
});

describe("readFavorites", () => {
  it("returns [] when storage is missing", () => {
    expect(readFavorites(null)).toEqual([]);
    expect(readFavorites(undefined)).toEqual([]);
  });

  it("returns [] when the key is absent", () => {
    expect(readFavorites(makeStorage())).toEqual([]);
  });

  it("returns [] for malformed payloads", () => {
    expect(readFavorites(makeStorage({ [FAVORITES_STORAGE_KEY]: "oops" }))).toEqual(
      [],
    );
  });

  it("returns the parsed list when present", () => {
    const storage = makeStorage({ [FAVORITES_STORAGE_KEY]: '["a","b"]' });
    expect(readFavorites(storage)).toEqual(["a", "b"]);
  });
});

describe("writeFavorites", () => {
  it("removes the key when the list is empty", () => {
    const storage = makeStorage({
      [FAVORITES_STORAGE_KEY]: JSON.stringify(["a"]),
    });
    writeFavorites(storage, []);
    expect(storage.getItem(FAVORITES_STORAGE_KEY)).toBeNull();
  });

  it("stores JSON for non-empty lists", () => {
    const storage = makeStorage();
    writeFavorites(storage, ["a", "b"]);
    expect(storage.getItem(FAVORITES_STORAGE_KEY)).toBe('["a","b"]');
  });

  it("dedupes and trims before serialising", () => {
    const storage = makeStorage();
    writeFavorites(storage, ["b", "a", "b", "  a  ", "", "  "]);
    expect(storage.getItem(FAVORITES_STORAGE_KEY)).toBe('["b","a"]');
  });

  it("ignores non-string entries", () => {
    const storage = makeStorage();
    // Force a mixed list past TS — the runtime guard should still filter.
    writeFavorites(
      storage,
      // @ts-expect-error — runtime guard is what we're testing.
      ["a", null, 42, "b"],
    );
    expect(storage.getItem(FAVORITES_STORAGE_KEY)).toBe('["a","b"]');
  });

  it("no-ops silently when storage is null", () => {
    expect(() => writeFavorites(null, ["a"])).not.toThrow();
    expect(() => writeFavorites(undefined, ["a"])).not.toThrow();
  });

  it("swallows storage write errors so the in-memory state still updates", () => {
    const broken: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(() => writeFavorites(broken, ["a"])).not.toThrow();
    expect(() => writeFavorites(broken, [])).not.toThrow();
  });
});

describe("toggleFavoriteId", () => {
  it("adds an id when it is not in the list", () => {
    const result = toggleFavoriteId([], "rec-1");
    expect(result.added).toBe(true);
    expect(result.ids).toEqual(["rec-1"]);
  });

  it("removes an id when it is already present", () => {
    const result = toggleFavoriteId(["rec-1", "rec-2"], "rec-1");
    expect(result.added).toBe(false);
    expect(result.ids).toEqual(["rec-2"]);
  });

  it("puts newly added ids at the front", () => {
    const result = toggleFavoriteId(["a", "b"], "c");
    expect(result.ids).toEqual(["c", "a", "b"]);
  });

  it("trims whitespace around the candidate id", () => {
    const result = toggleFavoriteId([], "  rec-1\n");
    expect(result.ids).toEqual(["rec-1"]);
  });

  it("treats an empty candidate as a no-op", () => {
    const result = toggleFavoriteId(["a"], "   ");
    expect(result.added).toBe(false);
    expect(result.ids).toEqual(["a"]);
  });

  it("does not mutate the input list", () => {
    const list = ["a", "b"];
    const result = toggleFavoriteId(list, "c");
    expect(list).toEqual(["a", "b"]);
    expect(result.ids).not.toBe(list);
  });
});

describe("isFavoriteId", () => {
  it("returns true for present ids", () => {
    expect(isFavoriteId(["a", "b"], "a")).toBe(true);
  });

  it("returns false for missing ids", () => {
    expect(isFavoriteId(["a", "b"], "c")).toBe(false);
  });

  it("is case-sensitive (ids are opaque strings)", () => {
    expect(isFavoriteId(["ABC"], "abc")).toBe(false);
  });

  it("does not treat a blank string as a favorite", () => {
    expect(isFavoriteId([], "")).toBe(false);
  });
});

describe("FAVORITES_BOOT_SCRIPT", () => {
  it("is a self-invoking IIFE that guards against missing localStorage", () => {
    expect(FAVORITES_BOOT_SCRIPT.startsWith("(function(){")).toBe(true);
    expect(FAVORITES_BOOT_SCRIPT.endsWith(")();"),).toBe(true);
    expect(FAVORITES_BOOT_SCRIPT).toContain("brew-favorites");
    expect(FAVORITES_BOOT_SCRIPT).toContain("data-favorites-count");
  });

  it("does not throw when JSON.parse blows up", () => {
    // The script wraps `JSON.parse(raw)` in a `try { … } catch { ids = [] }`
    // so a corrupt payload (older version wrote non-JSON, user-edited
    // localStorage, etc.) is silently ignored. Verify the structural shape
    // so a future edit can't accidentally remove either half.
    expect(FAVORITES_BOOT_SCRIPT).toContain("JSON.parse(raw)");
    expect(FAVORITES_BOOT_SCRIPT).toMatch(/catch\(e\)\{ids=\[\]\}/);
  });
});
