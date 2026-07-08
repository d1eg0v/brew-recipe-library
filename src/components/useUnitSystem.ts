"use client";

import { useEffect, useState } from "react";

import {
  DEFAULT_UNIT_SYSTEM,
  UNITS_CHANGE_EVENT,
  type UnitSystem,
} from "@/lib/units/units";

/**
 * Read the active unit system and re-render when it changes.
 *
 * Server-rendered output uses the canonical metric values; on mount the
 * effect reads the `data-units` attribute the inline boot script applied
 * (see `src/lib/units/bootScript.ts`) and re-renders with the stored
 * preference if it differs. Subsequent changes — e.g. clicking the header
 * `<UnitToggle />` — fire `UNITS_CHANGE_EVENT` on `window`; this hook listens
 * so every consumer stays in sync without a server round-trip.
 *
 * Mirrors the pattern in `src/components/ThemeSwitcher.tsx` (BRE-22): keep
 * the initial state stable at `DEFAULT_UNIT_SYSTEM` so the first client paint
 * matches the SSR output (no hydration mismatch), then sync to the applied
 * value in an effect.
 */
export function useUnitSystem(): UnitSystem {
  const [units, setUnits] = useState<UnitSystem>(DEFAULT_UNIT_SYSTEM);

  useEffect(() => {
    function syncFromDocument() {
      const attr = document.documentElement.getAttribute("data-units");
      setUnits(attr === "imperial" ? "imperial" : "metric");
    }
    syncFromDocument();
    window.addEventListener(UNITS_CHANGE_EVENT, syncFromDocument);
    return () => {
      window.removeEventListener(UNITS_CHANGE_EVENT, syncFromDocument);
    };
  }, []);

  return units;
}