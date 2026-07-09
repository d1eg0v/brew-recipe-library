// Unit tests for the brew-day checklist generator.
//
// The generator is a pure function: given a recipe it returns an ordered
// list of checklist items. The tests below pin the section assignment
// (a recipe with no grains shouldn't emit mash items, a mead shouldn't
// emit boil items, etc.) and the ordering of the hop schedule.

import { describe, it, expect } from "vitest";

import {
  CHECKLIST_SECTION_TITLES,
  buildBrewDayChecklist,
} from "@/lib/brewing/checklist";
import type { RecipeDetail } from "@/lib/ui/types";

function makeRecipe(overrides: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    id: "r1",
    title: "Test IPA",
    author: null,
    description: null,
    notes: null,
    category: "beer",
    styleName: "American IPA",
    bjcpCategory: "21A",
    batchSizeLiters: 20,
    batchSizeGallons: null,
    boilTimeMinutes: 60,
    efficiencyPct: 75,
    targetOg: 1.06,
    targetFg: 1.012,
    targetAbv: 6.3,
    targetIbu: 60,
    targetSrm: 6,
    fermentables: [
      { id: "f1", name: "Pale 2-Row", type: "grain", amountKg: 4.5, amountLiters: null, colorLovibond: 2, potentialPpg: 37, notes: null, position: 0 },
    ],
    hops: [
      { id: "h1", name: "Cascade", amountGrams: 25, alphaAcidPct: 6, timeMinutes: 60, use: "boil", form: "pellet", notes: null, position: 0 },
      { id: "h2", name: "Citra", amountGrams: 25, alphaAcidPct: 12, timeMinutes: 5, use: "boil", form: "pellet", notes: null, position: 1 },
    ],
    yeasts: [
      { id: "y1", name: "US-05", laboratory: "Fermentis", productId: "US-05", type: "ale", form: "dry", attenuationPct: 81, temperatureCMin: 18, temperatureCMax: 22, notes: null, position: 0 },
    ],
    mashSteps: [
      { id: "m1", name: "Sacc rest", type: "infusion", stepTempC: 66, stepTimeMinutes: 60, infuseAmountLiters: null, notes: null, position: 0 },
    ],
    processSteps: [
      { id: "p1", name: "Primary fermentation", type: "primary", tempC: 19, durationDays: 7, notes: null, position: 0 },
      { id: "p2", name: "Bottling", type: "bottling", tempC: null, durationDays: null, notes: null, position: 1 },
    ],
    additions: [
      { id: "a1", name: "Irish moss", amount: 1, unit: "tsp", purpose: "clarifier", timing: "at 15 min", notes: null, position: 0 },
    ],
    shareable: false,
    shareUrl: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildBrewDayChecklist", () => {
  it("includes prep, mash, boil, hop, transfer, pitch, additions, and fermentation sections for a beer", () => {
    const recipe = makeRecipe();
    const items = buildBrewDayChecklist(recipe);
    const sections = new Set(items.map((i) => i.section));
    expect(sections).toContain("prep");
    expect(sections).toContain("mash");
    expect(sections).toContain("boil");
    expect(sections).toContain("hops");
    expect(sections).toContain("transfer");
    expect(sections).toContain("pitch");
    expect(sections).toContain("additions");
    expect(sections).toContain("fermentation");
  });

  it("orders sections: prep → mash → boil → hops → transfer → pitch → additions → fermentation", () => {
    const recipe = makeRecipe();
    const items = buildBrewDayChecklist(recipe);
    const order: string[] = [];
    let lastIdx = -1;
    for (const it of items) {
      const idx = order.indexOf(it.section);
      if (idx === -1) {
        order.push(it.section);
      } else {
        // If we've seen this section before, its order index must be the
        // last-seen index (not earlier) — i.e. sections don't go backwards.
        expect(idx).toBeGreaterThanOrEqual(lastIdx);
      }
      lastIdx = Math.max(lastIdx, order.indexOf(it.section));
    }
    // First three sections should be prep → mash → boil in that order.
    expect(order[0]).toBe("prep");
    expect(order.indexOf("mash")).toBeGreaterThan(order.indexOf("prep"));
    expect(order.indexOf("boil")).toBeGreaterThan(order.indexOf("mash"));
    expect(order.indexOf("hops")).toBeGreaterThan(order.indexOf("boil"));
    expect(order.indexOf("transfer")).toBeGreaterThan(order.indexOf("hops"));
    expect(order.indexOf("pitch")).toBeGreaterThan(order.indexOf("transfer"));
    expect(order.indexOf("additions")).toBeGreaterThan(order.indexOf("pitch"));
    expect(order.indexOf("fermentation")).toBeGreaterThan(
      order.indexOf("additions"),
    );
  });

  it("emits hop additions in actual addition order (longest boil time first)", () => {
    const recipe = makeRecipe();
    const items = buildBrewDayChecklist(recipe);
    const hopItems = items.filter((i) => i.section === "hops");
    expect(hopItems).toHaveLength(2);
    expect(hopItems[0].label).toContain("Cascade");
    expect(hopItems[0].detail).toContain("60 min");
    expect(hopItems[1].label).toContain("Citra");
    expect(hopItems[1].detail).toContain("5 min");
  });

  it("skips the mash section for a liquid-only ferment (mead / wine)", () => {
    const recipe = makeRecipe({
      category: "mead",
      fermentables: [
        { id: "f1", name: "Wildflower honey", type: "honey", amountKg: 2.5, amountLiters: null, colorLovibond: null, potentialPpg: 35, notes: null, position: 0 },
      ],
      mashSteps: [],
      processSteps: [
        { id: "p1", name: "Primary fermentation", type: "primary", tempC: 20, durationDays: 30, notes: null, position: 0 },
      ],
    });
    const items = buildBrewDayChecklist(recipe);
    const sections = new Set(items.map((i) => i.section));
    expect(sections.has("mash")).toBe(false);
    // No grains → no sparge either.
    expect(items.some((i) => i.id === "mash.sparge")).toBe(false);
  });

  it("skips the boil section when boilTimeMinutes is 0 (no-boil mead / kit wine)", () => {
    const recipe = makeRecipe({
      category: "wine",
      boilTimeMinutes: 0,
      fermentables: [
        { id: "f1", name: "Grape juice", type: "juice", amountKg: null, amountLiters: 10, colorLovibond: null, potentialPpg: 17, notes: null, position: 0 },
      ],
      hops: [],
      mashSteps: [],
      processSteps: [
        { id: "p1", name: "Primary fermentation", type: "primary", tempC: 22, durationDays: 14, notes: null, position: 0 },
      ],
    });
    const items = buildBrewDayChecklist(recipe);
    const sections = new Set(items.map((i) => i.section));
    expect(sections.has("boil")).toBe(false);
    expect(sections.has("hops")).toBe(false);
    // No chill step (no boil) — but transfer + measure OG still happen.
    expect(items.some((i) => i.id === "transfer.chill")).toBe(false);
    expect(items.some((i) => i.id === "transfer.transfer")).toBe(true);
    // But prep + pitch + fermentation should still be present.
    expect(sections.has("prep")).toBe(true);
    expect(sections.has("pitch")).toBe(true);
    expect(sections.has("fermentation")).toBe(true);
  });

  it("includes a whirlpool entry when the recipe has whirlpool hops", () => {
    const recipe = makeRecipe({
      hops: [
        { id: "h1", name: "Saaz", amountGrams: 30, alphaAcidPct: 3.5, timeMinutes: 15, use: "whirlpool", form: "pellet", notes: null, position: 0 },
      ],
    });
    const items = buildBrewDayChecklist(recipe);
    const wp = items.find((i) => i.section === "whirlpool");
    expect(wp).toBeDefined();
    expect(wp?.label).toContain("Saaz");
  });

  it("includes dry-hop entries under the fermentation section", () => {
    const recipe = makeRecipe({
      hops: [
        { id: "h1", name: "Citra", amountGrams: 50, alphaAcidPct: 12, timeMinutes: 4, use: "dryHop", form: "pellet", notes: null, position: 0 },
      ],
    });
    const items = buildBrewDayChecklist(recipe);
    const dry = items.find((i) => i.id === "process.dryhop.0");
    expect(dry).toBeDefined();
    expect(dry?.section).toBe("fermentation");
    expect(dry?.label).toContain("Citra");
  });

  it("renders the pitch entry with the yeast fermentation-temperature range", () => {
    const recipe = makeRecipe();
    const items = buildBrewDayChecklist(recipe);
    const pitch = items.find((i) => i.section === "pitch");
    expect(pitch).toBeDefined();
    expect(pitch?.label).toContain("US-05");
    expect(pitch?.detail).toContain("18");
    expect(pitch?.detail).toContain("22");
  });

  it("emits one pitch item per yeast", () => {
    const recipe = makeRecipe({
      yeasts: [
        { id: "y1", name: "US-05", laboratory: "Fermentis", productId: "US-05", type: "ale", form: "dry", attenuationPct: 81, temperatureCMin: 18, temperatureCMax: 22, notes: null, position: 0 },
        { id: "y2", name: "Belle Saison", laboratory: "Lallemand", productId: "Belle Saison", type: "ale", form: "dry", attenuationPct: 85, temperatureCMin: 20, temperatureCMax: 35, notes: null, position: 1 },
      ],
    });
    const items = buildBrewDayChecklist(recipe);
    const pitches = items.filter((i) => i.section === "pitch");
    expect(pitches).toHaveLength(2);
    expect(pitches[0].label).toContain("US-05");
    expect(pitches[1].label).toContain("Belle Saison");
  });

  it("CHECKLIST_SECTION_TITLES has a human label for every section", () => {
    const expected: Array<keyof typeof CHECKLIST_SECTION_TITLES> = [
      "prep",
      "mash",
      "boil",
      "hops",
      "whirlpool",
      "transfer",
      "pitch",
      "additions",
      "fermentation",
    ];
    for (const s of expected) {
      expect(CHECKLIST_SECTION_TITLES[s]).toBeTruthy();
      expect(CHECKLIST_SECTION_TITLES[s].length).toBeGreaterThan(0);
    }
  });

  it("honours the units argument: metric renders L/°C/g, imperial renders gal/°F/oz", () => {
    const recipe = makeRecipe();
    const metric = buildBrewDayChecklist(recipe, "metric");
    const imperial = buildBrewDayChecklist(recipe, "imperial");

    function findById(
      list: ReturnType<typeof buildBrewDayChecklist>,
      id: string,
    ) {
      return list.find((i) => i.id === id);
    }

    // Volume: "20 L" vs "5.28 gal"
    expect(findById(metric, "prep.water")?.detail).toContain("20 L");
    expect(findById(imperial, "prep.water")?.detail).toContain("gal");
    expect(findById(imperial, "prep.water")?.detail).not.toContain(" L");

    // Mash temp: "66 °C" vs "151 °F"
    expect(findById(metric, "mash.step.0")?.detail).toContain("66 °C");
    expect(findById(imperial, "mash.step.0")?.detail).toContain("151 °F");

    // Hop addition mass: "25 g" vs "0.88 oz"
    expect(findById(metric, "hops.0")?.detail).toContain("25 g");
    expect(findById(imperial, "hops.0")?.detail).toContain("0.88 oz");

    // Pitch yeast temperature range.
    expect(findById(metric, "pitch.0")?.detail).toContain("18–22 °C");
    expect(findById(imperial, "pitch.0")?.detail).toContain("°F");
  });
});
