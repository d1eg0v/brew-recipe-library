import { describe, expect, it } from "vitest";

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

describe("serializeBeerXml", () => {
  it("includes the XML declaration and <RECIPES> root", () => {
    const xml = serializeBeerXml(fixtureRecipe());
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"');
    expect(xml).toContain("<RECIPES>");
    expect(xml).toContain("</RECIPES>");
  });

  it("emits a single <RECIPE> with the recipe name", () => {
    const xml = serializeBeerXml(fixtureRecipe({ title: "My Pale Ale" }));
    expect(xml).toMatch(/<NAME>My Pale Ale<\/NAME>/);
  });

  it("translates categorical strings to BeerXML values", () => {
    const xml = serializeBeerXml(fixtureRecipe());
    expect(xml).toMatch(/<TYPE>Grain<\/TYPE>/);
    expect(xml).toMatch(/<USE>Boil<\/USE>/);
    expect(xml).toMatch(/<FORM>Pellet<\/FORM>/);
    expect(xml).toMatch(/<FORM>Dry<\/FORM>/);
    expect(xml).toMatch(/<MASH_STEP>/);
  });

  it("emits numeric values without unnecessary padding", () => {
    const xml = serializeBeerXml(fixtureRecipe());
    expect(xml).toMatch(/<BATCH_SIZE>20<\/BATCH_SIZE>/);
    expect(xml).toMatch(/<OG>1\.056<\/OG>/);
    expect(xml).toMatch(/<FG>1\.012<\/FG>/);
  });

  it("splits BJCP category into CATEGORY_NUMBER + STYLE_LETTER", () => {
    const xml = serializeBeerXml(fixtureRecipe({ bjcpCategory: "21A" }));
    expect(xml).toMatch(/<CATEGORY_NUMBER>21<\/CATEGORY_NUMBER>/);
    expect(xml).toMatch(/<STYLE_LETTER>A<\/STYLE_LETTER>/);
    expect(xml).toMatch(/<CATEGORY>21A<\/CATEGORY>/);
  });

  it("renders self-closing tags for empty fermentable/hop/yeast lists", () => {
    const xml = serializeBeerXml(
      fixtureRecipe({
        fermentables: [],
        hops: [],
        yeasts: [],
        mashSteps: [],
      }),
    );
    expect(xml).toContain("<FERMENTABLES/>");
    expect(xml).toContain("<HOPS/>");
    expect(xml).toContain("<YEASTS/>");
    expect(xml).toContain("<MASH/>");
  });

  it("escapes XML-unsafe characters in text fields", () => {
    const xml = serializeBeerXml(
      fixtureRecipe({
        title: "Hop & Barley <Ale>",
        description: 'Quotes "left" & \'right\'',
      }),
    );
    expect(xml).toContain("Hop &amp; Barley &lt;Ale&gt;");
    expect(xml).toContain("Quotes &quot;left&quot; &amp; &apos;right&apos;");
  });

  it("emits fermentable YIELD from potentialPpg", () => {
    const xml = serializeBeerXml(
      fixtureRecipe({
        fermentables: [
          {
            name: "Pale 2-Row",
            type: "grain",
            amountKg: 4.5,
            colorLovibond: 2,
            potentialPpg: 46,
          },
        ],
      }),
    );
    // 46 PPG * 100 / 46 = 100%
    expect(xml).toMatch(/<YIELD>100<\/YIELD>/);
  });

  it("maps category to TYPE", () => {
    const xml = serializeBeerXml(fixtureRecipe({ category: "mead" }));
    expect(xml).toMatch(/<TYPE>mead<\/TYPE>/);
  });

  it("produces a parseable document", async () => {
    const { XMLParser } = await import("fast-xml-parser");
    const parser = new XMLParser({
      ignoreAttributes: true,
      isArray: (name: string, jpath: unknown) => {
        const path = typeof jpath === "string" ? jpath : "";
        if (path.endsWith("RECIPE")) return true;
        if (path.endsWith("FERMENTABLE")) return true;
        if (path.endsWith("HOP")) return true;
        if (path.endsWith("YEAST")) return true;
        if (path.endsWith("MASH_STEP")) return true;
        return false;
      },
    });
    const xml = serializeBeerXml(fixtureRecipe());
    const obj = parser.parse(xml);
    const recipes = obj.RECIPES;
    expect(recipes).toBeTruthy();
    const recipesArray = Array.isArray(recipes.RECIPE) ? recipes.RECIPE : [recipes.RECIPE];
    expect(recipesArray.length).toBe(1);
    const r = recipesArray[0];
    expect(r.NAME).toBe("Test IPA");
    const fList = r.FERMENTABLES.FERMENTABLE;
    const fArr = Array.isArray(fList) ? fList : [fList];
    expect(fArr[0].NAME).toBe("Pale 2-Row");
    const hList = r.HOPS.HOP;
    const hArr = Array.isArray(hList) ? hList : [hList];
    expect(hArr[0].USE).toBe("Boil");
  });
});