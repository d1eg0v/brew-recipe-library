"use client";

import { useCallback, useEffect, useState } from "react";

import {
  FAVORITES_CHANGE_EVENT,
  emitFavoritesChange,
  isFavoriteId,
  readFavorites,
  toggleFavoriteId,
  writeFavorites,
  type StorageLike,
} from "./favorites";

/**
 * React hook for the per-browser favorites set (BRE-46).
 *
 * Components that want to show "is this favorited?" state share this hook so
 * they stay in sync via the global `brew-favorites-change` event — a click
 * on the detail-page toggle should re-render the star on the card on the
 * previous browse screen instantly.
 *
 * Pattern mirrors `src/lib/units/units.ts`:
 *   - Initial state matches SSR (empty list) so the first paint after a
 *     hard refresh matches what the server sent.
 *   - A post-mount effect reads `localStorage` once and replaces state.
 *   - The change event keeps multiple subscribers aligned after the first
 *     hydration (card / filter / detail header all see each other's writes).
 */
export function useFavorites(): {
  ids: readonly string[];
  isFavorite: (id: string) => boolean;
  toggle: (id: string) => { added: boolean };
  count: number;
} {
  const [ids, setIds] = useState<string[]>([]);

  // Read the persisted set once after mount. Re-runs when the change event
  // fires (a sibling component toggled the same id) so we don't store
  // stale lists in multiple components.
  useEffect(() => {
    const storage: StorageLike | undefined =
      typeof window !== "undefined" && window.localStorage
        ? window.localStorage
        : undefined;

    function applyFromStorage() {
      setIds(readFavorites(storage));
    }

    function applyFromEvent(event: Event) {
      const detail = (event as CustomEvent<{ ids: string[] }>).detail;
      if (detail && Array.isArray(detail.ids)) {
        setIds(detail.ids);
        return;
      }
      applyFromStorage();
    }

    applyFromStorage();
    window.addEventListener(FAVORITES_CHANGE_EVENT, applyFromEvent);
    return () => {
      window.removeEventListener(FAVORITES_CHANGE_EVENT, applyFromEvent);
    };
  }, []);

  const isFavorite = useCallback(
    (id: string) => isFavoriteId(ids, id),
    [ids],
  );

  const toggle = useCallback(
    (id: string): { added: boolean } => {
      const result = toggleFavoriteId(ids, id);
      setIds(result.ids);
      const storage: StorageLike | undefined =
        typeof window !== "undefined" && window.localStorage
          ? window.localStorage
          : undefined;
      writeFavorites(storage, result.ids);
      emitFavoritesChange(result.ids);
      return { added: result.added };
    },
    [ids],
  );

  return {
    ids,
    isFavorite,
    toggle,
    count: ids.length,
  };
}
