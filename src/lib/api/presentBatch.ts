// Presentation helper for Batch rows: attaches derived metrics (actualAbv,
// apparentAttenuation, brewhouseEfficiency) so route handlers stay thin.
//
// The stored row keeps only raw measurements — everything else is computed on
// demand from `@/lib/brewing/batch.ts`. Missing inputs collapse to `null`
// instead of `0` so the client can distinguish "unknown" from "measured zero".

import {
  actualAbv,
  apparentAttenuation,
  brewhouseEfficiency,
} from "@/lib/brewing/batch";
import type { FermentableInput } from "@/lib/brewing/types";

export interface BatchRow {
  id: string;
  recipeId: string;
  brewDate: Date;
  measuredOg: number | null;
  measuredFg: number | null;
  volumeLiters: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FermentableRow {
  type?: string | null;
  amountKg?: number | null;
  potentialPpg?: number | null;
  colorLovibond?: number | null;
}

export interface DerivedMetrics {
  actualAbv: number | null;
  apparentAttenuation: number | null;
  brewhouseEfficiency: number | null;
}

function toFermentableInputs(rows: FermentableRow[]): FermentableInput[] {
  const out: FermentableInput[] = [];
  for (const f of rows) {
    if (typeof f.amountKg !== "number") continue;
    out.push({
      type: f.type ?? undefined,
      amountKg: f.amountKg,
      potentialPpg: f.potentialPpg ?? null,
      colorLovibond: f.colorLovibond ?? null,
    });
  }
  return out;
}

export function computeDerived(
  batch: Pick<BatchRow, "measuredOg" | "measuredFg" | "volumeLiters">,
  fermentables: FermentableRow[] | undefined,
): DerivedMetrics {
  const og = batch.measuredOg;
  const fg = batch.measuredFg;
  const vol = batch.volumeLiters;

  const abv = og != null && fg != null ? actualAbv(og, fg) : null;
  const att = og != null && fg != null ? apparentAttenuation(og, fg) : null;

  let eff: number | null = null;
  if (og != null && vol != null && vol > 0 && fermentables && fermentables.length > 0) {
    const inputs = toFermentableInputs(fermentables);
    if (inputs.length > 0) {
      eff = brewhouseEfficiency(inputs, og, vol);
    }
  }

  return {
    actualAbv: abv,
    apparentAttenuation: att,
    brewhouseEfficiency: eff,
  };
}

export function presentBatch(
  batch: BatchRow,
  fermentables?: FermentableRow[],
) {
  return {
    ...batch,
    derived: computeDerived(batch, fermentables),
  };
}
