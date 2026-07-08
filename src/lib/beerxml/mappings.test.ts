import { describe, expect, it } from "vitest";

import {
  fermentableTypeToBeerXml,
  hopFormToBeerXml,
  hopUseToBeerXml,
  mapFermentableType,
  mapHopForm,
  mapHopUse,
  mapMashStepType,
  mapYeastForm,
  mapYeastType,
  mashStepTypeToBeerXml,
  recipeTypeToCategory,
  yeastFormToBeerXml,
  yeastTypeToBeerXml,
} from "./mappings";

describe("BeerXML mappings: hop USE", () => {
  it("translates the canonical BeerXML values", () => {
    expect(mapHopUse("Boil")).toBe("boil");
    expect(mapHopUse("First Wort")).toBe("firstWort");
    expect(mapHopUse("Whirlpool")).toBe("whirlpool");
    expect(mapHopUse("Dry Hop")).toBe("dryHop");
    expect(mapHopUse("Mash")).toBe("mash");
  });

  it("tolerates case/whitespace variations", () => {
    expect(mapHopUse("dry hop")).toBe("dryHop");
    expect(mapHopUse("first_wort")).toBe("firstWort");
    expect(mapHopUse("WHIRLPOOL")).toBe("whirlpool");
    expect(mapHopUse("Aroma")).toBe("boil");
  });

  it("returns '' for unknown values", () => {
    expect(mapHopUse(undefined)).toBe("");
    expect(mapHopUse("Surprise")).toBe("");
  });

  it("inverts cleanly for the internal set", () => {
    expect(hopUseToBeerXml("boil")).toBe("Boil");
    expect(hopUseToBeerXml("firstWort")).toBe("First Wort");
    expect(hopUseToBeerXml("whirlpool")).toBe("Whirlpool");
    expect(hopUseToBeerXml("dryHop")).toBe("Dry Hop");
    expect(hopUseToBeerXml("mash")).toBe("Mash");
    expect(hopUseToBeerXml("garbage")).toBe("");
  });

  it("round-trips all internal values", () => {
    for (const v of ["boil", "firstWort", "whirlpool", "dryHop", "mash"]) {
      expect(mapHopUse(hopUseToBeerXml(v))).toBe(v);
    }
  });
});

describe("BeerXML mappings: hop FORM", () => {
  it("translates common values", () => {
    expect(mapHopForm("Pellet")).toBe("pellet");
    expect(mapHopForm("Leaf")).toBe("leaf");
    expect(mapHopForm("Plug")).toBe("plug");
    expect(mapHopForm("Whole")).toBe("leaf");
  });

  it("round-trips", () => {
    for (const v of ["pellet", "leaf", "plug", "extract"]) {
      expect(mapHopForm(hopFormToBeerXml(v))).toBe(v);
    }
  });
});

describe("BeerXML mappings: fermentable TYPE", () => {
  it("translates the canonical values", () => {
    expect(mapFermentableType("Grain")).toBe("grain");
    expect(mapFermentableType("Extract")).toBe("extract");
    expect(mapFermentableType("Sugar")).toBe("sugar");
    expect(mapFermentableType("Adjunct")).toBe("adjunct");
    expect(mapFermentableType("Honey")).toBe("honey");
    expect(mapFermentableType("Fruit")).toBe("fruit");
    expect(mapFermentableType("Juice")).toBe("juice");
    expect(mapFermentableType("Must")).toBe("must");
  });

  it("maps unknown values to grain as a sensible default", () => {
    expect(mapFermentableType(undefined)).toBe("grain");
    expect(mapFermentableType("Other")).toBe("grain");
  });

  it("round-trips", () => {
    for (const v of [
      "grain",
      "extract",
      "sugar",
      "adjunct",
      "honey",
      "juice",
      "concentrate",
      "fruit",
      "must",
    ]) {
      expect(mapFermentableType(fermentableTypeToBeerXml(v))).toBe(v);
    }
  });
});

describe("BeerXML mappings: yeast FORM/TYPE", () => {
  it("translates yeast FORM", () => {
    expect(mapYeastForm("Dry")).toBe("dry");
    expect(mapYeastForm("Liquid")).toBe("liquid");
    expect(mapYeastForm("Slant")).toBe("slant");
    expect(mapYeastForm("Culture")).toBe("culture");
  });

  it("translates yeast TYPE", () => {
    expect(mapYeastType("Ale")).toBe("ale");
    expect(mapYeastType("Lager")).toBe("lager");
    expect(mapYeastType("Wheat")).toBe("wheat");
    expect(mapYeastType("Wine")).toBe("wine");
    expect(mapYeastType("Champagne")).toBe("champagne");
  });

  it("inverts yeast FORM and TYPE", () => {
    for (const v of ["dry", "liquid", "slant", "culture"]) {
      expect(mapYeastForm(yeastFormToBeerXml(v))).toBe(v);
    }
    for (const v of ["ale", "lager", "wheat", "wine", "champagne", "other"]) {
      expect(mapYeastType(yeastTypeToBeerXml(v))).toBe(v);
    }
  });
});

describe("BeerXML mappings: mash step TYPE", () => {
  it("translates the canonical values", () => {
    expect(mapMashStepType("Infusion")).toBe("infusion");
    expect(mapMashStepType("Temperature")).toBe("temperature");
    expect(mapMashStepType("Decoction")).toBe("decoction");
    expect(mapMashStepType("Rest")).toBe("temperature");
  });

  it("round-trips", () => {
    for (const v of ["infusion", "temperature", "decoction"]) {
      expect(mapMashStepType(mashStepTypeToBeerXml(v))).toBe(v);
    }
  });
});

describe("BeerXML mappings: recipe TYPE → category", () => {
  it("classifies brewing types as beer", () => {
    expect(recipeTypeToCategory("All Grain")).toBe("beer");
    expect(recipeTypeToCategory("Extract")).toBe("beer");
    expect(recipeTypeToCategory("Partial Mash")).toBe("beer");
  });

  it("recognises mead/wine/cider", () => {
    expect(recipeTypeToCategory("Mead")).toBe("mead");
    expect(recipeTypeToCategory("Wine")).toBe("wine");
    expect(recipeTypeToCategory("Cider")).toBe("cider");
  });

  it("defaults to beer for missing input", () => {
    expect(recipeTypeToCategory(undefined)).toBe("beer");
    expect(recipeTypeToCategory("")).toBe("beer");
  });
});