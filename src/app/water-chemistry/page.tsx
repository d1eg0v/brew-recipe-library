// Server-rendered page for the water-chemistry calculator.
//
// The client component is a form that re-fetches
// `GET /api/water-chemistry` whenever an input changes.

import Link from "next/link";

import WaterChemistryCalculator from "./WaterChemistryCalculator";

export const dynamic = "force-dynamic";

export default async function WaterChemistryPage() {
  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link
          href="/"
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] no-underline"
        >
          ← All recipes
        </Link>
      </nav>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Water chemistry calculator
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] max-w-2xl">
          Pick a source-water profile, set your batch volume, and add brewing
          salts (gypsum, calcium chloride, etc.) to see the resulting mineral
          profile, residual alkalinity, and estimated mash pH. The math follows
          the Kolbach residual-alkalinity model with a simplified pH estimator.
        </p>
      </header>

      <WaterChemistryCalculator />
    </div>
  );
}
