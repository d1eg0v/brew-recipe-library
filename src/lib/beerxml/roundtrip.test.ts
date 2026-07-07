import { describe, expect, it } from "vitest";

import { recipeCreateSchema } from "@/lib/api/schemas";

import { parseBeerXml } from "./parser";
import { serializeBeerXml } from "./serializer";
import type { BeerXmlSerializableRecipe } from "./serializer";

function fixtureRecipe(
  overrides: Partial<BeerXmlSerializableRecipe> = {},
): BeerXmlSerializableRecipe {
  return {
    title: "Test IPA",
    author: "Test Brewer",
    description: "A test beer.",
    notes: "Tasting note.",
    category: "beer",
    styleName: "American IPA",
    bjcpCategory: "21A",
    batchSizeLiters: 20,
    boilTimeMinutes: 60,
    efficiencyPct: 75,
    targetOg: 1.056,
    targetFg: 1.012,
    targetAbv: 5.8,
    targetIbu: 45,
    targetSrm: 6,
    fermentables: [
      {
        name: "Pale 2-Row",
        type: "grain",
        amountKg: 4.5,
        colorLovibond: 2,
        potentialPpg: 37,
      },
    ],
    hops: [
      {
        name: "Cascade",
        amountGrams: 25,
        alphaAcidPct: 5.5,
        timeMinutes: 60,
        use: "boil",
        form: "pellet",
      },
    ],
    yeasts: [
      {
        name: "US-05",
        laboratory: "Fermentis",
        productId: "US-05",
        type: "ale",
        form: "dry",
        attenuationPct: 81,
        temperatureCMin: 15,
        temperatureCMax: 24,
      },
    ],
    mashSteps: [
      {
        name: "Sacc rest",
        type: "infusion",
        stepTempC: 66,
        stepTimeMinutes: 60,
        infuseAmountLiters: 15,
      },
    ],
    ...overrides,
  };
}

describe("BeerXML round-trip", () => {
  it("export → import preserves scalar fields", () => {
    const original = fixtureRecipe();
    const xml = serializeBeerXml(original);
    const parsed = parseBeerXml(xml);

    expect(parsed.title).toBe(original.title);
    expect(parsed.author).toBe(original.author);
    expect(parsed.batchSizeLiters).toBe(original.batchSizeLiters);
    expect(parsed.boilTimeMinutes).toBe(original.boilTimeMinutes);
    expect(parsed.efficiencyPct).toBe(original.efficiencyPct);
    expect(parsed.targetOg).toBe(original.targetOg);
    expect(parsed.targetFg).toBe(original.targetFg);
    expect(parsed.targetIbu).toBe(original.targetIbu);
    expect(parsed.targetSrm).toBe(original.targetSrm);
    expect(parsed.targetAbv).toBe(original.targetAbv);
    expect(parsed.styleName).toBe(original.styleName);
    expect(parsed.bjcpCategory).toBe(original.bjcpCategory);
  });

  it("export → import preserves fermentables", () => {
    const original = fixtureRecipe();
    const parsed = parseBeerXml(serializeBeerXml(original));
    expect(parsed.fermentables).toHaveLength(1);
    const f = parsed.fermentables[0] as Record<string, unknown>;
    expect(f.name).toBe("Pale 2-Row");
    expect(f.type).toBe("grain");
    expect(f.amountKg).toBeCloseTo(4.5, 5);
    expect(f.colorLovibond).toBe(2);
    // potentialPpg survives via YIELD round-trip (within rounding).
    expect(f.potentialPpg).toBeCloseTo(37, 1);
  });

  it("export → import preserves hops", () => {
    const original = fixtureRecipe();
    const parsed = parseBeerXml(serializeBeerXml(original));
    expect(parsed.hops).toHaveLength(1);
    const h = parsed.hops[0] as Record<string, unknown>;
    expect(h.name).toBe("Cascade");
    expect(h.amountGrams).toBe(25);
    expect(h.timeMinutes).toBe(60);
    expect(h.use).toBe("boil");
    expect(h.form).toBe("pellet");
  });

  it("export → import preserves yeasts", () => {
    const original = fixtureRecipe();
    const parsed = parseBeerXml(serializeBeerXml(original));
    expect(parsed.yeasts).toHaveLength(1);
    const y = parsed.yeasts[0] as Record<string, unknown>;
    expect(y.name).toBe("US-05");
    expect(y.type).toBe("ale");
    expect(y.form).toBe("dry");
    expect(y.attenuationPct).toBe(81);
    expect(y.temperatureCMin).toBe(15);
    expect(y.temperatureCMax).toBe(24);
  });

  it("export → import preserves mash steps", () => {
    const original = fixtureRecipe();
    const parsed = parseBeerXml(serializeBeerXml(original));
    expect(parsed.mashSteps).toHaveLength(1);
    const m = parsed.mashSteps[0] as Record<string, unknown>;
    expect(m.name).toBe("Sacc rest");
    expect(m.type).toBe("infusion");
    expect(m.stepTempC).toBe(66);
    expect(m.stepTimeMinutes).toBe(60);
  });

  it("round-trips a multi-hop schedule with different uses", () => {
    const original = fixtureRecipe({
      hops: [
        {
          name: "Magnum",
          amountGrams: 14,
          alphaAcidPct: 12,
          timeMinutes: 60,
          use: "boil",
          form: "pellet",
        },
        {
          name: "Centennial",
          amountGrams: 28,
          alphaAcidPct: 9,
          timeMinutes: 15,
          use: "boil",
          form: "pellet",
        },
        {
          name: "Citra",
          amountGrams: 56,
          timeMinutes: 0,
          use: "whirlpool",
          form: "pellet",
        },
        {
          name: "Mosaic",
          amountGrams: 56,
          timeMinutes: 4320,
          use: "dryHop",
          form: "pellet",
        },
      ],
    });
    const parsed = parseBeerXml(serializeBeerXml(original));
    expect(parsed.hops).toHaveLength(4);
    expect((parsed.hops[0] as Record<string, unknown>).name).toBe("Magnum");
    expect((parsed.hops[2] as Record<string, unknown>).use).toBe("whirlpool");
    expect((parsed.hops[3] as Record<string, unknown>).use).toBe("dryHop");
  });

  it("the parser output validates against recipeCreateSchema", () => {
    const xml = serializeBeerXml(fixtureRecipe());
    const parsed = parseBeerXml(xml);
    const result = recipeCreateSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it("tolerates parsing a BeerSmith-style doc with a namespace declaration", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<RECIPES xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.beerxml.com/recipe/1.0 beerxml.xsd">
  <RECIPE>
    <NAME>Beersmith Export</NAME>
    <BATCH_SIZE>19</BATCH_SIZE>
    <BOIL_TIME>60</BOIL_TIME>
    <EFFICIENCY>72</EFFICIENCY>
    <STYLE>
      <NAME>American Pale Ale</NAME>
      <CATEGORY>18A</CATEGORY>
    </STYLE>
    <FERMENTABLES>
      <FERMENTABLE>
        <NAME>Pale Malt</NAME>
        <TYPE>Grain</TYPE>
        <AMOUNT>3.6</AMOUNT>
      </FERMENTABLE>
    </FERMENTABLES>
    <HOPS>
      <HOP>
        <NAME>Cascade</NAME>
        <AMOUNT>21</AMOUNT>
        <ALPHA>5.5</ALPHA>
        <TIME>60</TIME>
        <USE>Boil</USE>
        <FORM>Pellet</FORM>
      </HOP>
    </HOPS>
    <YEASTS>
      <YEAST>
        <NAME>US-05</NAME>
        <FORM>Dry</FORM>
      </YEAST>
    </YEASTS>
  </RECIPE>
</RECIPES>`;
    const out = parseBeerXml(xml);
    expect(out.title).toBe("Beersmith Export");
    expect(out.batchSizeLiters).toBe(19);
    expect(out.styleName).toBe("American Pale Ale");
    expect(out.bjcpCategory).toBe("18A");
    expect((out.yeasts[0] as Record<string, unknown>).form).toBe("dry");
  });
});