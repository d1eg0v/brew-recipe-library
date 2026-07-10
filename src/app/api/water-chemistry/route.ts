// `GET /api/water-chemistry` — compute mineral profile and estimated mash pH.
//
// Inputs (query string):
//   - calcium, magnesium, sodium, sulfate, chloride, bicarbonate  (source water, ppm)
//   - volumeLiters  (strike/sparge volume)
//   - additions     (JSON array of { saltType, grams })
//
// Output: resulting mineral profile, per-salt contributions, residual
// alkalinity, and estimated mash pH. The route wraps
// `computeWaterChemistry` in `@/lib/brewing/water`.

import { NextResponse, type NextRequest } from "next/server";

import {
  badRequest,
  internalError,
  validationError,
} from "@/lib/api/errors";
import {
  BUILT_IN_PROFILES,
  computeWaterChemistry,
  type SaltAddition,
  type SaltType,
} from "@/lib/brewing/water";
import { waterChemistryQuerySchema } from "@/lib/api/schemas";
import type { SaltAdditionInput } from "@/lib/ui/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  const parsed = waterChemistryQuerySchema.safeParse({
    calcium: url.searchParams.get("calcium") ?? undefined,
    magnesium: url.searchParams.get("magnesium") ?? undefined,
    sodium: url.searchParams.get("sodium") ?? undefined,
    sulfate: url.searchParams.get("sulfate") ?? undefined,
    chloride: url.searchParams.get("chloride") ?? undefined,
    bicarbonate: url.searchParams.get("bicarbonate") ?? undefined,
    volumeLiters: url.searchParams.get("volumeLiters") ?? undefined,
    additions: url.searchParams.get("additions") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  const q = parsed.data;

  let additions: SaltAddition[] = [];
  if (q.additions) {
    try {
      const raw = JSON.parse(q.additions) as SaltAdditionInput[];
      if (!Array.isArray(raw)) {
        return badRequest("additions must be a JSON array");
      }
      additions = raw.map((a) => ({
        saltType: a.saltType as SaltType,
        grams: a.grams,
      }));
    } catch {
      return badRequest("additions must be valid JSON");
    }
  }

  try {
    const result = computeWaterChemistry({
      source: {
        calcium: q.calcium ?? 0,
        magnesium: q.magnesium ?? 0,
        sodium: q.sodium ?? 0,
        sulfate: q.sulfate ?? 0,
        chloride: q.chloride ?? 0,
        bicarbonate: q.bicarbonate ?? 0,
      },
      additions,
      volumeLiters: q.volumeLiters,
    });

    return NextResponse.json({
      data: {
        result,
        profiles: BUILT_IN_PROFILES.map((p) => ({
          name: p.name,
          description: p.description,
          calcium: p.calcium,
          magnesium: p.magnesium,
          sodium: p.sodium,
          sulfate: p.sulfate,
          chloride: p.chloride,
          bicarbonate: p.bicarbonate,
        })),
      },
    });
  } catch (err) {
    console.error("GET /api/water-chemistry failed:", err);
    return internalError();
  }
}
