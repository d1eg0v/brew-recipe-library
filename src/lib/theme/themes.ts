export type ThemeId = "light" | "sepia" | "dark" | "midnight";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
  mode: "light" | "dark";
}

export const THEMES: readonly ThemeMeta[] = [
  {
    id: "light",
    label: "Light",
    description: "Warm white with amber accents",
    mode: "light",
  },
  {
    id: "sepia",
    label: "Sepia",
    description: "Paper / parchment for long reads",
    mode: "light",
  },
  {
    id: "dark",
    label: "Dark",
    description: "Neutral grays with amber accents",
    mode: "dark",
  },
  {
    id: "midnight",
    label: "Midnight",
    description: "Deep blue-black for night brewing",
    mode: "dark",
  },
] as const;

export const THEME_IDS = THEMES.map((t) => t.id);

export const DEFAULT_THEME: ThemeId = "light";

export const STORAGE_KEY = "brew-theme";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

/**
 * Resolve the theme the inline boot script should apply before first paint.
 *
 * Priority:
 *   1. `localStorage[STORAGE_KEY]` when the browser exposed it AND the value
 *      matches a known theme id.
 *   2. The user's `prefers-color-scheme` (dark ⇒ "dark", else ⇒ "light").
 *   3. The static default.
 *
 * Pure: takes a `storage` and `matchMedia` shape so it's easy to unit-test
 * without a DOM.
 */
export function resolveInitialTheme(
  storage: { getItem(key: string): string | null } | null | undefined,
  matchMedia: { matches: boolean } | null | undefined,
): ThemeId {
  if (storage) {
    try {
      const stored = storage.getItem(STORAGE_KEY);
      if (isThemeId(stored)) return stored;
    } catch {
      // localStorage can throw in private modes / sandboxed iframes; fall through.
    }
  }
  if (matchMedia?.matches) return "dark";
  return DEFAULT_THEME;
}