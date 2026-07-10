// Per-browser "favorites" set (BRE-46).
//
// The library has no auth/user system, so favorites are a personal, per-browser
// list persisted to `localStorage`. The store is shaped like the existing
// `tag` and `theme` helpers: a typed wrapper around the storage API, a change
// event so React components can re-render, and pure parsers that unit tests
// can drive without a DOM.
//
// Storage shape: `localStorage["brew-favorites"]` holds a JSON array of
// recipe ids (recipe table primary keys are `cuid()` strings). We keep the
// most-recent id first and dedupe by appending, so the list reflects the
// user's last action without re-sorting on every write.

/** `localStorage` key for the user's favorites set. */
export const FAVORITES_STORAGE_KEY = "brew-favorites";

/**
 * Custom event name fired on `window` whenever the favorites set changes
 * (toggle on the detail page, button on a card, etc.). Subscribers that
 * render a star/filter UI listen for this to re-render without a full page
 * reload. Mirrors `UNITS_CHANGE_EVENT` in `src/lib/units/units.ts`.
 */
export const FAVORITES_CHANGE_EVENT = "brew-favorites-change";

/** A minimal storage handle for tests. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Parse the raw `localStorage` string into a clean array of ids. Defensive:
 * returns an empty list for null/empty/non-array input so callers don't have
 * to guard against bad payloads written by an older version of the app or by
 * a user poking at devtools.
 *
 * Pure: takes a storage handle so tests can drive it without a DOM. Same
 * shape as `resolveInitialUnitSystem` in `src/lib/units/units.ts`.
 */
export function parseFavorites(raw: string | null): string[] {
  if (raw == null || raw.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  // Dedupe while preserving order — keeps the "most-recent first" convention
  // intact even if two writes race. Drop blank/non-string entries.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of parsed) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed.length === 0) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/** Read the current favorites list from the provided storage handle. */
export function readFavorites(storage: StorageLike | null | undefined): string[] {
  if (!storage) return [];
  try {
    return parseFavorites(storage.getItem(FAVORITES_STORAGE_KEY));
  } catch {
    return [];
  }
}

/**
 * Write the favorites list back to `localStorage` and broadcast a change
 * event so listeners can re-render. Silently no-ops if storage is unavailable
 * (private mode / quota), matching the pattern in `src/lib/theme/themes.ts` —
 * the in-memory UI state still updates for the rest of the session.
 */
export function writeFavorites(
  storage: StorageLike | null | undefined,
  ids: readonly string[],
): void {
  if (!storage) return;
  // Serialise the deduped, ordered set so a later read sees the canonical
  // form. Trimming twice (parse + write) keeps the storage tidy.
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    cleaned.push(trimmed);
  }
  try {
    if (cleaned.length === 0) {
      storage.removeItem(FAVORITES_STORAGE_KEY);
    } else {
      storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(cleaned));
    }
  } catch {
    // Ignore storage failures; the in-memory state inside the component is
    // still updated for this session.
  }
}

/**
 * Build the next favorites list by adding or removing `id`. Returning the
 * array (rather than mutating in place) lets callers thread it into React
 * state without surprises. The id is moved to the front on add so the
 * "most-recent first" ordering stays intuitive.
 *
 * Pure: takes the current list and a candidate id; does not touch storage.
 * Callers should hand the result to `writeFavorites` and update local state.
 */
export function toggleFavoriteId(
  current: readonly string[],
  id: string,
): { ids: string[]; added: boolean } {
  const trimmed = id.trim();
  if (trimmed.length === 0) {
    return { ids: [...current], added: false };
  }
  const idx = current.indexOf(trimmed);
  if (idx >= 0) {
    const ids = current.slice();
    ids.splice(idx, 1);
    return { ids, added: false };
  }
  const ids = [trimmed, ...current];
  return { ids, added: true };
}

/** True when `id` is in the favorites list. O(n) is fine — sets stay tiny. */
export function isFavoriteId(
  ids: readonly string[],
  id: string,
): boolean {
  return ids.indexOf(id) >= 0;
}

/**
 * Best-effort `window` reference. Kept as a tiny helper so client code and
 * the boot script both ask for it the same way (`undefined` on the server,
 * the real `window` in the browser).
 */
export function getWindow(): (Window & typeof globalThis) | undefined {
  if (typeof window === "undefined") return undefined;
  return window;
}

/**
 * Broadcast a favorites-change event on `window`. The detail payload is the
 * full id list so subscribers can replace their local state without
 * re-reading storage (avoids racey reads right after a write).
 */
export function emitFavoritesChange(ids: readonly string[]): void {
  const win = getWindow();
  if (!win) return;
  try {
    win.dispatchEvent(
      new CustomEvent(FAVORITES_CHANGE_EVENT, { detail: { ids: [...ids] } }),
    );
  } catch {
    // CustomEvent can throw in non-DOM test environments; ignore.
  }
}
