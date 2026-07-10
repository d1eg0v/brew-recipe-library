// Server-rendered page for the yeast pitch-rate / starter calculator (BRE-33).
//
// All inputs are controlled entirely in the browser; the server only renders
// the shell. The client component calls `GET /api/pitch-rate` on every change.

import Link from "next/link";
import PitchRateCalculator from "./PitchRateCalculator";

export const dynamic = "force-dynamic";

export default function PitchRatePage() {
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
          Yeast pitch rate / starter calculator
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] max-w-2xl">
          Figure out how many packs of yeast you need and whether you should
          make a starter. Ale and lager have different pitch-rate targets —
          lager needs roughly twice the cell count at the same gravity. The
          calculator accounts for yeast age and form (liquid vs. dry).
        </p>
      </header>

      <PitchRateCalculator />
    </div>
  );
}
