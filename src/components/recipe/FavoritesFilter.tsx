"use client";

import Link from "next/link";

import { useEffect, useState } from "react";

import {
  FAVORITES_CHANGE_EVENT,
  readFavorites,
  type StorageLike,
} from "@/lib/favorites/favorites";

interface FavoritesFilterProps {
  /**
   * Pre-built destination URL for the chip. The server component
   * computes the URL with / without `favorites=1` based on the current
   * searchParams, then hands the result here. Keeping this prop-driven
   * means the chip stays a dumb `<Link>` — it works in live App Router
   * soft-nav and in SSR / no-router test contexts alike.
   */
  href: string;
  /** Whether the chip should render in its active state. */
  active: boolean;
}

/**
 * "Favorites only" filter for the browse page (BRE-46).
 *
 * Renders a single `<Link>` whose destination the page computes
 * server-side so navigating to / from the filter preserves every other
 * URL param (category, tag, range, sort). The chip reads the current
 * favorites count from `localStorage` so the label stays in sync with
 * the user's stored set without a refetch.
 *
 * Hydration note: the server has no `localStorage`, so the initial
 * render shows "0". The boot script in `src/lib/favorites/bootScript.ts`
 * writes the real count to `<html data-favorites-count>` before paint;
 * the client then reads `localStorage` in an effect and updates the
 * count once. `suppressHydrationWarning` on the count span keeps React
 * quiet about the inevitable text mismatch on the first paint.
 *
 * The card grid on the same page honours `?favorites=1` via
 * `BrowseFavoritesGrid`, which reads the favorites set after mount and
 * hides non-favorites. Until then every card is visible — that's the
 * same flash pattern `UnitToggle` already exhibits for its metric/imperial
 * labels, which the existing UI accepts.
 */
export default function FavoritesFilter({ href, active }: FavoritesFilterProps) {
  // Server can't read localStorage, so the initial render shows "0". The
  // boot script in `src/lib/favorites/bootScript.ts` writes the real count
  // to `<html data-favorites-count>` before paint so a CSS hook could read
  // it; here we just re-read storage on mount and then stay in sync via
  // the favorites change event. `suppressHydrationWarning` on the count
  // span keeps React quiet about the inevitable text mismatch on the
  // first paint.
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage) return;
    const storage: StorageLike | undefined = window.localStorage;
    const apply = () => setCount(readFavorites(storage).length);
    apply();
    const handler = () => apply();
    window.addEventListener(FAVORITES_CHANGE_EVENT, handler);
    return () => window.removeEventListener(FAVORITES_CHANGE_EVENT, handler);
  }, []);
  return (
    <Link
      href={href}
      data-active={active ? "true" : "false"}
      aria-pressed={active}
      data-testid="favorites-filter"
      prefetch={false}
      className={`chip no-underline${active ? " chip-active" : ""}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M12 3.6 14.7 9l5.9.6-4.4 4 1.3 5.8L12 16.6 6.5 19.4 7.8 13.6 3.4 9.6 9.3 9Z" />
      </svg>
      <span className="font-medium">Favorites</span>
      <span className="chip-count" suppressHydrationWarning>
        {count}
      </span>
    </Link>
  );
}
