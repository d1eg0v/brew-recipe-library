import { describe, expect, it } from "vitest";

import { BeerXmlParseError, parseBeerXml } from "./parser";

describe("parseBeerXml", () => {
  it("parses a minimal valid document", () => {
    const xml = `<?xml version="1.0"?>
<RECIPES>
  <RECIPE>
    <NAME>My Pale Ale</NAME>
    <BATCH_SIZE>20</BATCH_SIZE>
    <FERMENTABLES/>
    <HOPS/>
    <YEASTS/>
  </RECIPE>
</RECIPES>`;
    const out = parseBeerXml(xml);
    expect(out.title).toBe("My Pale Ale");
    expect(out.batchSizeLiters).toBe(20);
    expect(out.category).toBe("beer");
    expect(out.fermentables).toEqual([]);
  });

  it("extracts fermentables with mapping", () => {
    const xml = `<?xml version="1.0"?>
<RECIPES>
  <RECIPE>
    <NAME>IPA</NAME>
    <BATCH_SIZE>20</BATCH_SIZE>
    <FERMENTABLES>
      <FERMENTABLE>
        <NAME>Pale 2-Row</NAME>
        <TYPE>Grain</TYPE>
        <AMOUNT>4.5</AMOUNT>
        <YIELD>80</YIELD>
        <COLOR>2</COLOR>
      </FERMENTABLE>
    </FERMENTABLES>
    <HOPS/>
    <YEASTS/>
  </RECIPE>
</RECIPES>`;
    const out = parseBeerXml(xml);
    expect(out.fermentables).toHaveLength(1);
    const f = out.fermentables[0] as Record<string, unknown>;
    expect(f.name).toBe("Pale 2-Row");
    expect(f.type).toBe("grain");
    expect(f.amountKg).toBe(4.5);
    // 80% yield -> 80/100 * 46 = 36.8 PPG
    expect(f.potentialPpg).toBeCloseTo(36.8, 5);
    expect(f.colorLovibond).toBe(2);
  });

  it("extracts hops with mapping", () => {
    const xml = `<?xml version="1.0"?>
<RECIPES>
  <RECIPE>
    <NAME>IPA</NAME>
    <BATCH_SIZE>20</BATCH_SIZE>
    <FERMENTABLES/>
    <HOPS>
      <HOP>
        <NAME>Cascade</NAME>
        <AMOUNT>25</AMOUNT>
        <ALPHA>5.5</ALPHA>
        <TIME>60</TIME>
        <USE>Boil</USE>
        <FORM>Pellet</FORM>
      </HOP>
      <HOP>
        <NAME>Citra</NAME>
        <AMOUNT>50</AMOUNT>
        <TIME>4320</TIME>
        <USE>Dry Hop</USE>
      </HOP>
    </HOPS>
    <YEASTS/>
  </RECIPE>
</RECIPES>`;
    const out = parseBeerXml(xml);
    expect(out.hops).toHaveLength(2);
    const first = out.hops[0] as Record<string, unknown>;
    expect(first.use).toBe("boil");
    expect(first.form).toBe("pellet");
    const second = out.hops[1] as Record<string, unknown>;
    expect(second.use).toBe("dryHop");
  });

  it("extracts yeasts with mapping", () => {
    const xml = `<?xml version="1.0"?>
<RECIPES>
  <RECIPE>
    <NAME>IPA</NAME>
    <BATCH_SIZE>20</BATCH_SIZE>
    <FERMENTABLES/>
    <HOPS/>
    <YEASTS>
      <YEAST>
        <NAME>US-05</NAME>
        <TYPE>Ale</TYPE>
        <FORM>Dry</FORM>
        <ATTENUATION>81</ATTENUATION>
        <MIN_TEMPERATURE>15</MIN_TEMPERATURE>
        <MAX_TEMPERATURE>24</MAX_TEMPERATURE>
        <LABORATORY>Fermentis</LABORATORY>
        <PRODUCT_ID>US-05</PRODUCT_ID>
      </YEAST>
    </YEASTS>
  </RECIPE>
</RECIPES>`;
    const out = parseBeerXml(xml);
    const y = out.yeasts[0] as Record<string, unknown>;
    expect(y.type).toBe("ale");
    expect(y.form).toBe("dry");
    expect(y.attenuationPct).toBe(81);
    expect(y.temperatureCMin).toBe(15);
    expect(y.laboratory).toBe("Fermentis");
  });

  it("extracts mash steps with mapping", () => {
    const xml = `<?xml version="1.0"?>
<RECIPES>
  <RECIPE>
    <NAME>IPA</NAME>
    <BATCH_SIZE>20</BATCH_SIZE>
    <FERMENTABLES/>
    <HOPS/>
    <YEASTS/>
    <MASH>
      <MASH_STEPS>
        <MASH_STEP>
          <NAME>Sacc rest</NAME>
          <TYPE>Infusion</TYPE>
          <STEP_TEMP>66</STEP_TEMP>
          <STEP_TIME>60</STEP_TIME>
          <INFUSE_AMOUNT>15</INFUSE_AMOUNT>
        </MASH_STEP>
      </MASH_STEPS>
    </MASH>
  </RECIPE>
</RECIPES>`;
    const out = parseBeerXml(xml);
    expect(out.mashSteps).toHaveLength(1);
    const m = out.mashSteps[0] as Record<string, unknown>;
    expect(m.type).toBe("infusion");
    expect(m.stepTempC).toBe(66);
    expect(m.stepTimeMinutes).toBe(60);
    expect(m.infuseAmountLiters).toBe(15);
  });

  it("captures style, targets, and notes", () => {
    const xml = `<?xml version="1.0"?>
<RECIPES>
  <RECIPE>
    <NAME>IPA</NAME>
    <BREWER>Jane</BREWER>
    <BATCH_SIZE>20</BATCH_SIZE>
    <BOIL_TIME>60</BOIL_TIME>
    <EFFICIENCY>75</EFFICIENCY>
    <OG>1.056</OG>
    <FG>1.012</FG>
    <IBU>45</IBU>
    <COLOR>6</COLOR>
    <ABV>5.8</ABV>
    <STYLE>
      <NAME>American IPA</NAME>
      <CATEGORY>21A</CATEGORY>
    </STYLE>
    <NOTES>Hop forward.</NOTES>
    <TASTE_NOTES>Citrusy finish.</TASTE_NOTES>
    <FERMENTABLES/>
    <HOPS/>
    <YEASTS/>
  </RECIPE>
</RECIPES>`;
    const out = parseBeerXml(xml);
    expect(out.author).toBe("Jane");
    expect(out.boilTimeMinutes).toBe(60);
    expect(out.efficiencyPct).toBe(75);
    expect(out.targetOg).toBe(1.056);
    expect(out.targetFg).toBe(1.012);
    expect(out.targetIbu).toBe(45);
    expect(out.targetSrm).toBe(6);
    expect(out.targetAbv).toBe(5.8);
    expect(out.styleName).toBe("American IPA");
    expect(out.bjcpCategory).toBe("21A");
    expect(out.notes).toContain("Hop forward.");
    expect(out.notes).toContain("Citrusy finish.");
  });

  it("handles a recipe without a <RECIPES> root (single recipe doc)", () => {
    const xml = `<?xml version="1.0"?>
<RECIPE>
  <NAME>Loose Recipe</NAME>
  <BATCH_SIZE>10</BATCH_SIZE>
  <FERMENTABLES/>
  <HOPS/>
  <YEASTS/>
</RECIPE>`;
    // fast-xml-parser handles this fine; we wrap it through the parser which
    // expects RECIPES. Verify we surface a useful error.
    expect(() => parseBeerXml(xml)).toThrow(BeerXmlParseError);
  });

  it("rejects an empty document", () => {
    expect(() => parseBeerXml("")).toThrow(BeerXmlParseError);
  });

  it("rejects malformed XML", () => {
    expect(() => parseBeerXml("<RECIPES><RECIPE>")).toThrow(BeerXmlParseError);
  });

  it("rejects DOCTYPE declarations before entity processing", () => {
    const xml = `<?xml version="1.0"?>
<!DOCTYPE RECIPES [<!ENTITY recipeName "Expanded name">]>
<RECIPES>
  <RECIPE>
    <NAME>&recipeName;</NAME>
    <BATCH_SIZE>20</BATCH_SIZE>
    <FERMENTABLES/>
    <HOPS/>
    <YEASTS/>
  </RECIPE>
</RECIPES>`;
    expect(() => parseBeerXml(xml)).toThrow(/DOCTYPE/);
  });

  it("rejects an entity-expansion payload (billion laughs)", () => {
    const xml = `<?xml version="1.0"?>
<!DOCTYPE RECIPES [
  <!ENTITY lol "lol">
  <!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  <!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;">
  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
]>
<RECIPES>
  <RECIPE>
    <NAME>&lol3;</NAME>
    <BATCH_SIZE>20</BATCH_SIZE>
    <FERMENTABLES/>
    <HOPS/>
    <YEASTS/>
  </RECIPE>
</RECIPES>`;
    expect(() => parseBeerXml(xml)).toThrow(/DOCTYPE/);
  });

  it("rejects a DOCTYPE placed inside the root element", () => {
    // fast-xml-parser honours a DOCTYPE wherever it appears, not just in the
    // prolog: without the guard this document resolves <NAME> to "Injected".
    // The guard must therefore scan past the root element start tag.
    const xml = `<?xml version="1.0"?>
<RECIPES><!DOCTYPE RECIPES [<!ENTITY injected "Injected">]>
  <RECIPE>
    <NAME>&injected;</NAME>
    <BATCH_SIZE>20</BATCH_SIZE>
    <FERMENTABLES/>
    <HOPS/>
    <YEASTS/>
  </RECIPE>
</RECIPES>`;
    expect(() => parseBeerXml(xml)).toThrow(/DOCTYPE/);
  });

  it("accepts a document quoting a DOCTYPE inside CDATA", () => {
    // Legitimate content, not an attack: CDATA is inert to the parser, so the
    // text is never read as a declaration.
    const xml = `<?xml version="1.0"?>
<RECIPES>
  <RECIPE>
    <NAME>Import Notes Ale</NAME>
    <BATCH_SIZE>20</BATCH_SIZE>
    <NOTES><![CDATA[Our exporter emits <!DOCTYPE RECIPES> in the prolog.]]></NOTES>
    <FERMENTABLES/>
    <HOPS/>
    <YEASTS/>
  </RECIPE>
</RECIPES>`;
    const out = parseBeerXml(xml);
    expect(out.title).toBe("Import Notes Ale");
    expect(out.notes).toBe(
      "Our exporter emits <!DOCTYPE RECIPES> in the prolog.",
    );
  });

  it("accepts a document quoting a DOCTYPE inside a comment", () => {
    const xml = `<?xml version="1.0"?>
<RECIPES>
  <!-- upstream files sometimes start with <!DOCTYPE RECIPES> -->
  <RECIPE>
    <NAME>Commented Ale</NAME>
    <BATCH_SIZE>20</BATCH_SIZE>
    <FERMENTABLES/>
    <HOPS/>
    <YEASTS/>
  </RECIPE>
</RECIPES>`;
    expect(parseBeerXml(xml).title).toBe("Commented Ale");
  });

  it("still rejects a DOCTYPE that follows an inert region", () => {
    // Skipping CDATA must not become a way to smuggle a real declaration in
    // after it. Both orderings are rejected.
    const afterCdata = `<?xml version="1.0"?>
<RECIPES>
  <NOTES><![CDATA[ <!-- ]]></NOTES>
  <!DOCTYPE RECIPES [<!ENTITY injected "Injected">]>
  <RECIPE><NAME>&injected;</NAME><BATCH_SIZE>20</BATCH_SIZE></RECIPE>
</RECIPES>`;
    expect(() => parseBeerXml(afterCdata)).toThrow(/DOCTYPE/);

    const afterComment = `<?xml version="1.0"?>
<RECIPES>
  <!-- <![CDATA[ -->
  <!DOCTYPE RECIPES [<!ENTITY injected "Injected">]>
  <RECIPE><NAME>&injected;</NAME><BATCH_SIZE>20</BATCH_SIZE></RECIPE>
</RECIPES>`;
    expect(() => parseBeerXml(afterComment)).toThrow(/DOCTYPE/);
  });

  it("fails closed on a DOCTYPE after an unterminated comment", () => {
    const xml = `<?xml version="1.0"?>
<RECIPES>
  <!-- never closed
  <!DOCTYPE RECIPES [<!ENTITY injected "Injected">]>
  <RECIPE><NAME>&injected;</NAME><BATCH_SIZE>20</BATCH_SIZE></RECIPE>
</RECIPES>`;
    expect(() => parseBeerXml(xml)).toThrow(/DOCTYPE/);
  });

  it("decodes predefined XML entities in text content", () => {
    const xml = `<?xml version="1.0"?>
<RECIPES>
  <RECIPE>
    <NAME>Bob &amp; Dave&apos;s &quot;Best&quot; Ale</NAME>
    <BATCH_SIZE>20</BATCH_SIZE>
    <BREWER>Renée &amp; Co.</BREWER>
    <NOTES>Malty &amp; rich &lt;not bitter&gt;</NOTES>
    <FERMENTABLES>
      <FERMENTABLE>
        <NAME>Weyermann&apos;s Pilsner</NAME>
        <TYPE>Grain</TYPE>
        <AMOUNT>4.5</AMOUNT>
      </FERMENTABLE>
    </FERMENTABLES>
    <HOPS/>
    <YEASTS/>
  </RECIPE>
</RECIPES>`;
    const out = parseBeerXml(xml);
    expect(out.title).toBe(`Bob & Dave's "Best" Ale`);
    expect(out.notes).toBe("Malty & rich <not bitter>");
    expect(out.author).toBe("Renée & Co.");
    const f = out.fermentables[0] as Record<string, unknown>;
    expect(f.name).toBe("Weyermann's Pilsner");
  });

  it("decodes entities exactly once (no recursive re-expansion)", () => {
    // `&amp;amp;` is the correct escaping of the literal text "&amp;". A single
    // decode pass must yield "&amp;", not "&".
    const xml = `<?xml version="1.0"?>
<RECIPES>
  <RECIPE>
    <NAME>Literal &amp;amp; Escape</NAME>
    <BATCH_SIZE>20</BATCH_SIZE>
    <FERMENTABLES/>
    <HOPS/>
    <YEASTS/>
  </RECIPE>
</RECIPES>`;
    expect(parseBeerXml(xml).title).toBe("Literal &amp; Escape");
  });

  it("keeps names that the value parser coerces to non-strings", () => {
    // `parseTagValue` turns "2024" into a number and "true" into a boolean.
    // Before this was handled the recipe was rejected outright and numeric
    // ingredient names were silently dropped from the import.
    const xml = `<?xml version="1.0"?>
<RECIPES>
  <RECIPE>
    <NAME>2024</NAME>
    <BATCH_SIZE>20</BATCH_SIZE>
    <FERMENTABLES>
      <FERMENTABLE><NAME>2024</NAME><TYPE>Grain</TYPE><AMOUNT>4.5</AMOUNT></FERMENTABLE>
    </FERMENTABLES>
    <HOPS>
      <HOP><NAME>90</NAME><AMOUNT>0.05</AMOUNT><TIME>60</TIME></HOP>
    </HOPS>
    <YEASTS>
      <YEAST><NAME>true</NAME></YEAST>
    </YEASTS>
    <MASH>
      <MASH_STEPS>
        <MASH_STEP><NAME>66</NAME><STEP_TEMP>66</STEP_TEMP><STEP_TIME>60</STEP_TIME></MASH_STEP>
      </MASH_STEPS>
    </MASH>
  </RECIPE>
</RECIPES>`;
    const out = parseBeerXml(xml);
    expect(out.title).toBe("2024");
    expect(out.fermentables).toHaveLength(1);
    expect((out.fermentables[0] as Record<string, unknown>).name).toBe("2024");
    expect(out.hops).toHaveLength(1);
    expect((out.hops[0] as Record<string, unknown>).name).toBe("90");
    expect(out.yeasts).toHaveLength(1);
    expect((out.yeasts[0] as Record<string, unknown>).name).toBe("true");
    expect(out.mashSteps).toHaveLength(1);
    expect((out.mashSteps[0] as Record<string, unknown>).name).toBe("66");
  });

  it("rejects a missing <NAME>", () => {
    const xml = `<?xml version="1.0"?>
<RECIPES>
  <RECIPE>
    <BATCH_SIZE>20</BATCH_SIZE>
    <FERMENTABLES/>
    <HOPS/>
    <YEASTS/>
  </RECIPE>
</RECIPES>`;
    expect(() => parseBeerXml(xml)).toThrow(/NAME/);
  });

  it("rejects a missing or non-positive <BATCH_SIZE>", () => {
    const xml = `<?xml version="1.0"?>
<RECIPES>
  <RECIPE>
    <NAME>X</NAME>
    <FERMENTABLES/>
    <HOPS/>
    <YEASTS/>
  </RECIPE>
</RECIPES>`;
    expect(() => parseBeerXml(xml)).toThrow(/BATCH_SIZE/);
  });

  it("ignores optional unknown fields rather than failing", () => {
    const xml = `<?xml version="1.0"?>
<RECIPES>
  <RECIPE>
    <NAME>X</NAME>
    <BATCH_SIZE>20</BATCH_SIZE>
    <EXPERIMENTAL_FIELD>ignored</EXPERIMENTAL_FIELD>
    <FERMENTABLES/>
    <HOPS/>
    <YEASTS/>
  </RECIPE>
</RECIPES>`;
    const out = parseBeerXml(xml);
    expect(out.title).toBe("X");
  });
});
