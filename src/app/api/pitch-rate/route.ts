// `GET /api/pitch-rate` — compute yeast pitch rate, packs, and starter size.
//
// Inputs (query string):
//   - og                 original gravity (e.g. 1.050)
//   - batchSizeLiters    batch volume at pitching
//   - beerType           "ale" | "lager"
//   - yeastForm          "dry" | "liquid"
//   - daysSinceProduction (optional) days since manufacture
//   - viabilityOverride  (optional) explicit viability 0–1
//   - cellsPerPackOverride (optional) cells per pack in billions
//
// Output: recommended cell count, viable cells per pack, packs needed,
// starter recommendation, viability, degrees Plato, and input echo. The route
// is a thin wrapper over `computePitchRate` in `@/lib/brewing/pitchRate`.

import { NextResponse, type NextRequest } from "next/server";

import {
  badRequest,
  internalError,
  validationError,
} from "@/lib/api/errors";
import {
  computePitchRate,
  type PitchRateInput,
} from "@/lib/brewing/pitchRate";
import { pitchRateQuerySchema } from "@/lib/api/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = pitchRateQuerySchema.safeParse({
    og: url.searchParams.get("og") ?? undefined,
    batchSizeLiters: url.searchParams.get("batchSizeLiters") ?? undefined,
    beerType: url.searchParams.get("beerType") ?? undefined,
    yeastForm: url.searchParams.get("yeastForm") ?? undefined,
    daysSinceProduction:
      url.searchParams.get("daysSinceProduction") ?? undefined,
    viabilityOverride: url.searchParams.get("viabilityOverride") ?? undefined,
    cellsPerPackOverride:
      url.searchParams.get("cellsPerPackOverride") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  const q = parsed.data;

  try {
    const input: PitchRateInput = {
      og: q.og,
      batchSizeLiters: q.batchSizeLiters,
      beerType: q.beerType as PitchRateInput["beerType"],
      yeastForm: q.yeastForm as PitchRateInput["yeastForm"],
      daysSinceProduction: q.daysSinceProduction,
      viabilityOverride: q.viabilityOverride,
      cellsPerPackOverride: q.cellsPerPackOverride,
    };
    const result = computePitchRate(input);

    return NextResponse.json({ data: { result } });
  } catch (err) {
    console.error("GET /api/pitch-rate failed:", err);
    return internalError();
  }
}
