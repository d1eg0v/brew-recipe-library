"use client";

import { litersToGallons } from "@/lib/brewing/units";
import { useUnitSystem } from "@/components/useUnitSystem";
import { fmtNumber } from "@/lib/ui/format";

/**
 * Render a batch-size stat that follows the global unit-system preference
 * (header `<UnitToggle />`, persisted in `localStorage["brew-units"]`).
 *
 * Server-rendered output is always metric to keep SSR deterministic and avoid
 * a hydration mismatch; the `useUnitSystem` hook re-renders with the user's
 * stored preference on mount, then again whenever the header toggle fires
 * `UNITS_CHANGE_EVENT`. See `src/lib/units/units.ts`.
 */
export default function BatchSizeStat({
  liters,
  decimals = 1,
}: {
  liters: number;
  decimals?: number;
}) {
  const units = useUnitSystem();
  if (units === "imperial") {
    return (
      <span className="font-mono text-sm">
        {fmtNumber(litersToGallons(liters), decimals)} gal
      </span>
    );
  }
  return (
    <span className="font-mono text-sm">
      {fmtNumber(liters, decimals)} L
    </span>
  );
}