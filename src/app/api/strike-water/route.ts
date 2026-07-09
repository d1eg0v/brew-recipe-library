// `GET /api/strike-water` — compute strike-water volume and temperature.
//
// Inputs (query string):
//   - grainKg       total grain mass, kg (or recipeId to pre-fill from a
//                   recipe's grain bill)
//   - targetMashTempC  °C, 40–80 (typical 60–72)
//   - grainTempC       °C, -10–40 (room-temp grain ~20)
//   - waterToGrainRatioLPerKg  L/kg, 1.5–6.0 (optional, default 3.0)
//   - units         metric | imperial, default metric
//
// Output: strike-water volume (litres, plus gallons when `units=imperial`)
// and strike-water temperature (°C, plus °F when imperial). The route is a
// thin wrapper over `computeStrikeWater` in `@/lib/brewing/mash`. The pure
// calc uses the Palmer / How to Brew strike-water temperature equation:
//
//   T_strike = T_target + (c_grain / R) × (T_target − T_grain)
//            = T_target + (0.4  / R) × (T_target − T_grain)

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import {
  badRequest,
  internalError,
  notFound,
  validationError,
} from "@/lib/api/errors";
import { strikeWaterQuerySchema } from "@/lib/api/schemas";
import {
  computeStrikeWater,
  type StrikeWaterResult,
} from "@/lib/brewing/mash";
import {
  celsiusToFahrenheit,
  litersToGallons,
  roundTo,
} from "@/lib/brewing/units";

export const dynamic = "force-dynamic";

interface StrikeWaterResponseData {
  /** Result struct straight from the pure calc. */
  result: StrikeWaterResult;
  /** Optional imperial parallel when `?units=imperial`. */
  imperial?: {
    volumeGallons: number;
    strikeTempF: number;
  };
  /** Echoed source — "standalone" when no recipe was involved. */
  source: "standalone" | "recipe";
  /** Optional pre-fill context (the recipe that fed the grain mass). */
  recipe?: {
    id: string;
    title: string;
    grainKg: number;
  };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = strikeWaterQuerySchema.safeParse({
    grainKg: url.searchParams.get("grainKg") ?? undefined,
    targetMashTempC: url.searchParams.get("targetMashTempC") ?? undefined,
    grainTempC: url.searchParams.get("grainTempC") ?? undefined,
    waterToGrainRatioLPerKg:
      url.searchParams.get("waterToGrainRatioLPerKg") ?? undefined,
    recipeId: url.searchParams.get("recipeId") ?? undefined,
    units: url.searchParams.get("units") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  const q = parsed.data;
  const units = (q.units ?? "metric") as "metric" | "imperial";

  let grainKg: number | undefined;
  let recipe: { id: string; title: string; grainKg: number } | undefined;
  let source: "standalone" | "recipe" = "standalone";

  try {
    if (q.recipeId) {
      const row = await prisma.recipe.findUnique({
        where: { id: q.recipeId },
        select: {
          id: true,
          title: true,
          fermentables: { select: { amountKg: true } },
        },
      });
      if (!row) return notFound("Recipe not found");
      const totalGrainKg = row.fermentables.reduce(
        (sum, f) =>
          typeof f.amountKg === "number" && f.amountKg > 0
            ? sum + f.amountKg
            : sum,
        0,
      );
      recipe = {
        id: row.id,
        title: row.title,
        grainKg: roundTo(totalGrainKg, 3),
      };
      source = "recipe";
      // Pre-fill from the recipe's grain bill, but a caller-provided grainKg wins.
      grainKg = q.grainKg ?? totalGrainKg;
    } else {
      grainKg = q.grainKg;
    }

    if (grainKg == null || grainKg <= 0) {
      // Should be unreachable — the Zod refine requires one of {recipeId,
      // grainKg}. Defensive guard so the type narrows for the calc.
      return badRequest("either recipeId or grainKg is required");
    }

    const result = computeStrikeWater({
      grainKg,
      targetMashTempC: q.targetMashTempC,
      grainTempC: q.grainTempC,
      waterToGrainRatioLPerKg: q.waterToGrainRatioLPerKg,
    });

    const data: StrikeWaterResponseData = { result, source };
    if (units === "imperial") {
      // Re-derive imperial from the rounded metric values so the response is
      // always consistent with the rounded metric values, regardless of any
      // rounding-strategy change in the pure-calc layer.
      data.imperial = {
        volumeGallons: roundTo(litersToGallons(result.volumeLiters), 2),
        strikeTempF: roundTo(
          celsiusToFahrenheit(result.strikeTempC),
          1,
        ),
      };
    }
    if (recipe) data.recipe = recipe;

    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/strike-water failed:", err);
    return internalError();
  }
}