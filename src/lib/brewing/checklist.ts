// Brew-day checklist generation for a recipe.
//
// The print / PDF brew sheet needs a "brew day" checklist that the brewer
// works through on brew day. The data is derived from the recipe: grain bill
// implies mash + sparge; boil time + hop schedule implies a boil with timed
// hop additions; yeasts imply a pitch; process steps and additions become
// post-boil steps.
//
// This is a pure, deterministic function — no React, no IO, no side effects —
// so it can be unit-tested against reference outputs and reused anywhere
// (UI, server, future exports).

import {
  litersToGallons,
} from "@/lib/brewing/units";
import type { RecipeDetail, UnitSystem } from "@/lib/ui/types";

/** A single line on the brew-day checklist. */
export interface ChecklistItem {
  /** Stable id within a single checklist render. */
  id: string;
  /** Short imperative label printed on the sheet. */
  label: string;
  /** Optional sub-detail (time, temperature, quantity). */
  detail?: string;
  /**
   * Section grouping so the renderer can group items visually without
   * having to re-derive the partition.
   */
  section: ChecklistSection;
}

/** The high-level sections the checklist walks through. */
export type ChecklistSection =
  | "prep"
  | "mash"
  | "boil"
  | "hops"
  | "whirlpool"
  | "transfer"
  | "pitch"
  | "additions"
  | "fermentation";

/** Human-friendly section titles for the printed sheet. */
export const CHECKLIST_SECTION_TITLES: Record<ChecklistSection, string> = {
  prep: "Prep",
  mash: "Mash",
  boil: "Boil",
  hops: "Hop additions",
  whirlpool: "Whirlpool",
  transfer: "Cool & transfer",
  pitch: "Pitch yeast",
  additions: "Additions",
  fermentation: "Fermentation schedule",
};

/**
 * True when the recipe actually has grains / extracts to mash. Liquid-only
 * ferments (mead on honey, wine from juice, etc.) skip the mash section.
 */
function hasGrainBill(recipe: RecipeDetail): boolean {
  return recipe.fermentables.some((f) => {
    if (f.type === "grain" || f.type === "extract") return true;
    // A non-zero mass of fermentable implies something to mash or steep.
    return f.amountKg != null && f.amountKg > 0;
  });
}

/** Boil additions: hops with `use` boil or firstWort, sorted longest-time first
 *  (which is the actual addition order during the boil). */
function boilHopAdditions(recipe: RecipeDetail) {
  return recipe.hops
    .filter((h) => h.use === "boil" || h.use === "firstWort")
    .slice()
    .sort((a, b) => b.timeMinutes - a.timeMinutes);
}

/** Whirlpool additions. */
function whirlpoolAdditions(recipe: RecipeDetail) {
  return recipe.hops.filter((h) => h.use === "whirlpool");
}

/** Dry hop additions (post-fermentation). */
function dryHopAdditions(recipe: RecipeDetail) {
  return recipe.hops.filter((h) => h.use === "dryHop");
}

/** Format an amount + unit for a checklist detail string. */
function formatAmount(amount: number | null, unit: string | null | undefined) {
  if (amount == null || !Number.isFinite(amount)) return "";
  const u = (unit ?? "").trim();
  if (u) return `${amount} ${u}`;
  return String(amount);
}

/** Format a volume in the active unit system ("20 L" or "5.28 gal"). */
function formatBatchVolume(liters: number, units: UnitSystem): string {
  if (units === "imperial") {
    return `${trimZeros(litersToGallons(liters))} gal`;
  }
  return `${trimZeros(liters)} L`;
}

/** Format a number with up to 2 decimals, trimming trailing zeros. */
function trimZeros(value: number): string {
  const fixed = value.toFixed(2);
  if (!fixed.includes(".")) return fixed;
  return fixed.replace(/0+$/, "").replace(/\.$/, "") || fixed;
}

/**
 * Build the brew-day checklist for a recipe.
 *
 * The order follows the natural timeline of a brew day: prep → mash → boil →
 * timed hop additions → whirlpool → cool & transfer → pitch → additions →
 * fermentation schedule. Sections that don't apply to the recipe (e.g. mash
 * for a juice-only wine) are simply omitted, but the items in the rendered
 * sections stay stable and ordered.
 *
 * @param recipe  The recipe (already scaled / unit-converted by the caller).
 * @param units   Display unit system — controls whether volumes/masses in
 *                the generated detail strings are written in metric or
 *                imperial. Defaults to "metric".
 */
export function buildBrewDayChecklist(
  recipe: RecipeDetail,
  units: UnitSystem = "metric",
): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  // --- Prep ---
  items.push({ id: "prep.sanitize", section: "prep", label: "Sanitize all equipment" });
  items.push({
    id: "prep.water",
    section: "prep",
    label: "Measure strike / brew water",
    detail: `Target batch ${formatBatchVolume(recipe.batchSizeLiters, units)}`,
  });
  if (hasGrainBill(recipe) && recipe.mashSteps.length > 0) {
    const first = recipe.mashSteps[0];
    items.push({
      id: "prep.mill",
      section: "prep",
      label: "Mill grains",
      detail:
        first.stepTempC != null
          ? `Heat water to ${formatTemp(first.stepTempC, units)}`
          : undefined,
    });
  }

  // --- Mash (only if the recipe has a grain bill + mash steps) ---
  if (hasGrainBill(recipe) && recipe.mashSteps.length > 0) {
    items.push({
      id: "mash.in",
      section: "mash",
      label: "Mash in",
    });
    recipe.mashSteps.forEach((step, i) => {
      const parts: string[] = [];
      if (step.stepTempC != null)
        parts.push(`${formatTemp(step.stepTempC, units)}`);
      if (step.stepTimeMinutes != null) parts.push(`${step.stepTimeMinutes} min`);
      items.push({
        id: `mash.step.${i}`,
        section: "mash",
        label: step.name,
        detail: parts.join(" · "),
      });
    });
    const totalVolume = recipe.batchSizeLiters + (recipe.boilTimeMinutes > 0 ? Math.max(1, recipe.batchSizeLiters * 0.1) : 0);
    items.push({
      id: "mash.sparge",
      section: "mash",
      label: "Sparge / fly sparge",
      detail: `Collect wort to ${formatBatchVolume(totalVolume, units)}`,
    });
  }

  // --- Boil ---
  if (recipe.boilTimeMinutes > 0) {
    items.push({
      id: "boil.start",
      section: "boil",
      label: "Begin boil",
      detail: `${recipe.boilTimeMinutes} min`,
    });
  }

  // --- Hop additions (timed) ---
  const boilHops = boilHopAdditions(recipe);
  for (let i = 0; i < boilHops.length; i += 1) {
    const h = boilHops[i];
    const useLabel = h.use === "firstWort" ? "First wort" : "Boil";
    items.push({
      id: `hops.${i}`,
      section: "hops",
      label: `${useLabel}: ${h.name}`,
      detail: `${formatHopMass(h.amountGrams, units)} at ${h.timeMinutes} min remaining`,
    });
  }

  // --- Whirlpool ---
  const whirls = whirlpoolAdditions(recipe);
  if (whirls.length > 0) {
    for (let i = 0; i < whirls.length; i += 1) {
      const h = whirls[i];
      items.push({
        id: `whirlpool.${i}`,
        section: "whirlpool",
        label: `Whirlpool: ${h.name}`,
        detail:
          h.timeMinutes > 0
            ? `${formatHopMass(h.amountGrams, units)} · stand ${h.timeMinutes} min`
            : `${formatHopMass(h.amountGrams, units)}`,
      });
    }
  }

  // --- Cool & transfer ---
  if (recipe.boilTimeMinutes > 0) {
    items.push({
      id: "transfer.chill",
      section: "transfer",
      label: "Chill wort",
      detail: "To yeast-pitching temperature",
    });
  }
  items.push({
    id: "transfer.transfer",
    section: "transfer",
    label: "Transfer to fermenter",
    detail: `Target volume ${formatBatchVolume(recipe.batchSizeLiters, units)}`,
  });
  if (recipe.batchSizeLiters > 0) {
    items.push({
      id: "transfer.measureOg",
      section: "transfer",
      label: "Measure & record original gravity (OG)",
    });
  }

  // --- Pitch yeast ---
  for (let i = 0; i < recipe.yeasts.length; i += 1) {
    const y = recipe.yeasts[i];
    const tempParts: string[] = [];
    if (y.temperatureCMin != null && y.temperatureCMax != null) {
      tempParts.push(`Ferment at ${formatTempRange(y.temperatureCMin, y.temperatureCMax, units)}`);
    } else if (y.temperatureCMin != null) {
      tempParts.push(`Ferment at ${formatTemp(y.temperatureCMin, units)}`);
    }
    items.push({
      id: `pitch.${i}`,
      section: "pitch",
      label: `Pitch ${y.name}`,
      detail: tempParts.join(" · ") || undefined,
    });
  }

  // --- Additions (timed) ---
  for (let i = 0; i < recipe.additions.length; i += 1) {
    const a = recipe.additions[i];
    const detailBits: string[] = [];
    const amt = formatAmount(a.amount, a.unit);
    if (amt) detailBits.push(amt);
    if (a.timing) detailBits.push(a.timing);
    if (a.purpose) detailBits.push(a.purpose);
    items.push({
      id: `addition.${i}`,
      section: "additions",
      label: `Add ${a.name}`,
      detail: detailBits.length > 0 ? detailBits.join(" · ") : undefined,
    });
  }

  // --- Fermentation schedule (process steps) ---
  for (let i = 0; i < recipe.processSteps.length; i += 1) {
    const p = recipe.processSteps[i];
    const detailBits: string[] = [];
    if (p.durationDays != null)
      detailBits.push(`${p.durationDays} d`);
    if (p.tempC != null) detailBits.push(`${formatTemp(p.tempC, units)}`);
    items.push({
      id: `process.${i}`,
      section: "fermentation",
      label: p.name,
      detail: detailBits.length > 0 ? detailBits.join(" · ") : undefined,
    });
  }

  // --- Dry hops (post-fermentation) ---
  const dryHops = dryHopAdditions(recipe);
  for (let i = 0; i < dryHops.length; i += 1) {
    const h = dryHops[i];
    items.push({
      id: `process.dryhop.${i}`,
      section: "fermentation",
      label: `Dry hop: ${h.name}`,
      detail: `${formatHopMass(h.amountGrams, units)} for ${h.timeMinutes} d`,
    });
  }

  return items;
}

/** Format a temperature in the active unit system ("66 °C" / "151 °F"). */
function formatTemp(celsius: number, units: UnitSystem): string {
  if (units === "imperial") {
    return `${Math.round((celsius * 9) / 5 + 32)} °F`;
  }
  return `${Math.round(celsius)} °C`;
}

/** Format a yeast temperature range ("18–22 °C" / "64–72 °F"). */
function formatTempRange(
  cMin: number,
  cMax: number,
  units: UnitSystem,
): string {
  if (units === "imperial") {
    return `${Math.round((cMin * 9) / 5 + 32)}–${Math.round((cMax * 9) / 5 + 32)} °F`;
  }
  return `${Math.round(cMin)}–${Math.round(cMax)} °C`;
}

/** Format a hop mass (typically 5–80 g) in g or oz. */
function formatHopMass(grams: number, units: UnitSystem): string {
  if (units === "imperial") {
    const oz = grams / 28.349523125;
    return `${oz.toFixed(2)} oz`;
  }
  // Match the recipe-detail formatter: switch to kg for >= 1000 g.
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(2)} kg`;
  }
  return `${Math.round(grams)} g`;
}
