// Global unit-system preference (metric ⇄ imperial).
//
// Mirrors `src/lib/theme/themes.ts`: the value is persisted to `localStorage`,
// resolved on the server only via an inline boot script (no cookies, no SSR
// branching), and read by client components that need to render quantities.
// The DB stays metric (see `docs/BACKLOG.md` BRE-30 and the storage convention
// in `src/lib/brewing/units.ts`).

export type UnitSystem = "metric" | "imperial";

export const UNIT_SYSTEMS = ["metric", "imperial"] as const satisfies readonly UnitSystem[];

export const DEFAULT_UNIT_SYSTEM: UnitSystem = "metric";

/** `localStorage` key for the user's unit-system preference. */
export const STORAGE_KEY = "brew-units";

/**
 * Custom event name fired on `window` whenever the unit-system preference
 * changes (e.g. header toggle click). Consumers that read `data-units` from
 * `<html>` listen for this to re-render without a full page reload.
 */
export const UNITS_CHANGE_EVENT = "brew-units-change";

export function isUnitSystem(value: unknown): value is UnitSystem {
  return (
    typeof value === "string" &&
    (UNIT_SYSTEMS as readonly string[]).includes(value)
  );
}

/**
 * Resolve the unit system the inline boot script should apply before first
 * paint. Priority:
 *
 *   1. `localStorage[STORAGE_KEY]` when the browser exposed it AND the value
 *      matches a known unit system.
 *   2. The static default (metric).
 *
 * Pure: takes a minimal `storage` shape so it's easy to unit-test without a
 * DOM. Mirrors `resolveInitialTheme` from `src/lib/theme/themes.ts`, minus
 * `prefers-color-scheme` (there is no equivalent system-level unit pref).
 */
export function resolveInitialUnitSystem(
  storage: { getItem(key: string): string | null } | null | undefined,
): UnitSystem {
  if (storage) {
    try {
      const stored = storage.getItem(STORAGE_KEY);
      if (isUnitSystem(stored)) return stored;
    } catch {
      // localStorage can throw in private modes / sandboxed iframes; fall through.
    }
  }
  return DEFAULT_UNIT_SYSTEM;
}

/**
 * Read the unit system the inline boot script applied to `<html>`.
 *
 * Returns `DEFAULT_UNIT_SYSTEM` when running on the server (no `document`) or
 * when the attribute is missing/malformed. Safe to call from React effects.
 */
export function readAppliedUnitSystem(): UnitSystem {
  if (typeof document === "undefined") return DEFAULT_UNIT_SYSTEM;
  const attr = document.documentElement.getAttribute("data-units");
  return isUnitSystem(attr) ? attr : DEFAULT_UNIT_SYSTEM;
}