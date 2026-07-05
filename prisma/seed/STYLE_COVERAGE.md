# Seed Recipe Dataset — Style Coverage

Seed data lives in [`recipes.json`](./recipes.json): a JSON array of recipe objects
matching the Prisma `Recipe` model (see `../../schema.prisma`). A stage‑3 loader can
`JSON.parse` the file and create one `Recipe` per object, with `fermentables`, `hops`,
`yeasts`, `mashSteps`, `processSteps`, and `additions` as nested creates.

All quantities are **metric SI**, matching the schema convention:
mass in **kg** (`amountKg`) / **grams** (`amountGrams`), volume in **litres**
(`amountLiters` for liquid fermentables, e.g. juice / must / concentrate),
temperature in **°C**, gravities as decimals (e.g. `1.056`), colour in **SRM**,
bitterness in **IBU**. Imperial is a display concern handled in app code.

All recipes are original clone‑style formulations — none reproduce a specific
copyrighted recipe verbatim. Beer recipes are sized for a standard **20 L** batch,
mead for **19 L**, and wine recipes cover both the **4 L (1 gal)** single‑jug
"pantry kit" style and the standard **19 L** fresh‑fruit batch.

## Coverage checklist (22 recipes)

### Beer (14 — all `category: "beer"`)

| # | Recipe | Style | BJCP | OG | FG | ABV % | IBU | SRM |
|---|--------|-------|------|----|----|-------|-----|-----|
| 1 | West Coast Compass IPA | American IPA | 21A | 1.063 | 1.012 | 6.7 | 65 | 7 |
| 2 | Cascade Trail Pale Ale | American Pale Ale | 18B | 1.052 | 1.011 | 5.4 | 38 | 6 |
| 3 | Ironwood Amber Ale | American Amber Ale | 19A | 1.054 | 1.013 | 5.4 | 30 | 13 |
| 4 | Blackstack Dry Stout | Irish Stout | 15B | 1.044 | 1.011 | 4.3 | 38 | 38 |
| 5 | Locktender American Porter | American Porter | 20A | 1.058 | 1.015 | 5.6 | 35 | 30 |
| 6 | Sunfeld Hefeweizen | Weissbier | 10A | 1.050 | 1.010 | 5.3 | 13 | 4 |
| 7 | Abbey Cellar Dubbel | Belgian Dubbel | 26B | 1.068 | 1.014 | 7.1 | 20 | 18 |
| 8 | Meadowlace Witbier | Belgian Witbier | 24A | 1.048 | 1.010 | 5.0 | 15 | 3 |
| 9 | Silberquell Pilsner | German Pilsner | 5D | 1.046 | 1.009 | 4.8 | 38 | 3 |
| 10 | Hollowfield Brown Ale | American Brown Ale | 19C | 1.055 | 1.014 | 5.4 | 30 | 19 |
| 11 | Fieldhand Saison | Saison | 25B | 1.052 | 1.006 | 6.0 | 28 | 5 |
| 12 | Nightmill Oatmeal Stout | Oatmeal Stout | 16B | 1.052 | 1.014 | 5.0 | 32 | 33 |
| 13 | Soft Cloud New England IPA | New England IPA (hazy) | 21B | 1.062 | 1.014 | 6.3 | 35 | 4 |
| 14 | Double Soft Cloud Hazy DIPA | Double Hazy IPA | 22A | 1.082 | 1.018 | 8.4 | 60 | 5 |

### Mead (5 — all `category: "mead"`, no hops / mash, `processSteps` + `additions`)

| # | Recipe | Style | BJCP | OG | FG | ABV % | Batch |
|---|--------|-------|------|----|----|-------|-------|
| 15 | Wildflower Sky traditional dry mead | Traditional Mead (dry) | M1A | 1.110 | 0.998 | 14.5 | 19 L |
| 16 | Orchard Stand semi-sweet mead | Traditional Mead (semi-sweet) | M1A | 1.090 | 1.020 | 9.2 | 19 L |
| 17 | Hedgerow blackberry melomel | Berry Melomel | M2A | 1.095 | 1.015 | 10.5 | 19 L |
| 18 | Fireside metheglin | Metheglin (spiced) | M3A | 1.085 | 1.012 | 9.6 | 19 L |
| 19 | Viking's Blood Hibiscus Metheglin | Metheglin — Hibiscus (Viking's Blood) | M3A | 1.095 | 1.020 | 9.8 | 19 L |

### Wine (3 — all `category: "wine"`, no hops / mash, `processSteps` + `additions`)

| # | Recipe | Style | BJCP | OG | FG | ABV % | Batch |
|---|--------|-------|------|----|----|-------|-------|
| 20 | Concord Pantry kit wine | Country Wine (Concord grape) | — | 1.090 | 0.996 | 12.2 | 4 L |
| 21 | Applefield fresh-fruit country wine | Country Wine (fresh apple) | — | 1.055 | 0.998 | 7.4 | 19 L |
| 22 | Hollowgate pyment | Pyment (honey + grape) | M4A | 1.105 | 0.998 | 14.0 | 19 L |

## Breadth summary

**By category:**
- **Beer (14)** — IPAs (West Coast, NEIPA, Hazy DIPA), pale ales, ambers, browns, stouts/porters, wheats, lagers, Belgian Dubbel/Witbier/Saison
- **Mead (5)** — dry traditional, semi-sweet traditional, fruit melomel (blackberry), spiced metheglin (warm-spice and hibiscus Viking's Blood variants)
- **Wine (3)** — store-bought juice kit (Concord, 4 L), fresh-fruit country wine (apple, 19 L), pyment (honey + grape concentrate blend)

**Range:**
- SRM 3 (light pilsner / witbier) → SRM 38 (Irish stout)
- ABV 4.3 % (Irish stout) → ABV 14.5 % (dry mead) / 14.0 % (pyment)
- IBU 13 (hefeweizen) → IBU 65 (West Coast IPA)
- Batch sizes: 4 L (kit wine) → 20 L (beer)
- Yeast types in use: ale, lager, wheat, wine, champagne
- Fermentable `type` values: grain, sugar, honey, juice, concentrate, fruit, adjunct
- Yeast attenuation ranges 73 % → 95 %

**Process / technique variety:**
- Beer: single-infusion, step, and protein-rest mashes; boil/whirlpool/dry-hop schedules; two-stage and three-stage dry-hop schedules with biotransformation timing notes (NEIPA / Hazy DIPA)
- Mead: staggered nutrient additions (SNA), bulk aging, cold-crash stabilization, backsweetening after sorbate, fruit in primary, spice steep in secondary (warm-spice metheglin, hibiscus + elderberry + orange-peel Viking's Blood in secondary)
- Wine: campden rest, pectic enzyme, backsweetening, oak aging (pyment), single-jug 4 L kit (Concord) vs. 19 L fresh-pressed batch (apple)

## Categorical field values in use (match schema allowed values)

- **`Recipe.category`:** `beer`, `mead`, `wine`
- **`fermentable.type`:** `grain`, `adjunct`, `sugar`, `honey`, `juice`, `concentrate`, `fruit`
- **`fermentable.amount`:** `amountKg` for solids (grain / honey / sugar / fruit / flaked adjuncts), `amountLiters` for liquids (juice / concentrate / must); both fields nullable, at least one set per row
- **`hop.use`:** `boil`, `whirlpool`, `dryHop`  ·  **`hop.form`:** `pellet` (beer-only — non-beer recipes use `hops: []`)
- **`yeast.type`:** `ale`, `lager`, `wheat`, `wine`, `champagne`  ·  **`yeast.form`:** `dry`, `liquid`
- **`mashStep.type`:** `infusion`, `temperature` (beer-only — non-beer recipes use `mashSteps: []`)
- **`processStep.type`:** `primary`, `secondary`, `racking`, `backsweetening`, `stabilizing`, `aging`, `bottling`, `other` (used for mead + wine)
- **`addition.unit`:** `g`, `tsp`, `tablet`, `stick` (free-text per schema); **`addition.purpose`:** `yeast rehydration nutrient`, `yeast nutrient (organic/inorganic)`, `antimicrobial/antioxidant`, `yeast inhibitor`, `breaks down pectin for clarity`, `TA adjustment`, `structure / mouthfeel`, `spice`, `colour + tart fruit character (lead botanical)`

> **Note on dry-hop timing:** for `use: "dryHop"` entries, `timeMinutes` carries the
> dry-hop duration in **days** (per the schema's inline note that the field is
> "boil minutes or dry-hop days"); a `notes: "dry hop #N at …, days, …"` marker is
> set on those rows so the loader/UI can disambiguate.

## Gaps / possible future additions

Not yet covered (candidates for a later expansion):

- **Beer:** English bitters (11A/11B), Märzen/Oktoberfest (6A), Belgian Tripel (26C), Doppelbock (9A), Kölsch (5B), sour/wild styles (23-series), NEIPA-adjacent variants (e.g. fruited hazy IPA, milkshake IPA)
- **Mead:** braggot (M5A), cyser (apple-honey), pyment variants beyond red-grape, bochet (caramelized-honey mead)
- **Wine:** strawberry / elderberry / dandelion country wines, fruit-kit wines, ice wine / late-harvest
- **Cider:** recipe set planned but not yet authored — see the **Cider recipe shape** section below for the agreed field conventions. The seed JSON validator (`recipeCreateSchema` in `src/lib/api/schemas.ts`) and Prisma migration already accept `category: "cider"`.

---

## Cider recipe shape (BRE-19)

The schema already covers hard cider end-to-end. **No new migration, no new field.** This section is the contract the **Recipe Content Curator** should follow when authoring cider recipes (BRE-20). Every cider need maps cleanly onto existing fields:

### Field-by-field mapping

| Cider need | Where it goes | Field shape | Notes |
| --- | --- | --- | --- |
| Base apple juice (store-bought) | `fermentables[]` | `{ name, type: "juice", amountLiters }` | Required for liquid-only fermentables. |
| Apple juice concentrate (flavor boost) | `fermentables[]` | `{ name, type: "concentrate", amountLiters OR amountKg }` | Contributes to OG — add it here only when it's pitched with the must. |
| Fresh fruit (apples, berries, cherries…) | `fermentables[]` | `{ name, type: "fruit", amountKg }` | Same as mead fruit additions. |
| Acid blend / citric / malic acid | `additions[]` | `{ name: "Acid blend" \| "Citric acid" \| "Malic acid", amount, unit: "g", purpose: "TA adjustment", timing: "at pitch" }` | Use grams; the `Addition` unit is free-text but the seed validator accepts it. |
| Campden / potassium metabisulfite | `additions[]` | `{ name: "Campden tablet" \| "Potassium metabisulfite", amount, unit: "tablet" \| "g", purpose: "antimicrobial/antioxidant", timing: "24 h before pitch" }` | Mirrors existing mead/wine pattern. |
| Pectic enzyme | `additions[]` | `{ name: "Pectic enzyme", amount, unit: "tsp", purpose: "breaks down pectin for clarity", timing: "at pitch" }` | Mirrors existing mead/wine pattern. |
| Yeast nutrient (Fermaid-O, DAP, Go-Ferm) | `additions[]` | `{ name, amount, unit: "g", purpose: "yeast nutrient (organic/inorganic)", timing: "staggered SNA over first N days" }` | Same as mead. |
| Tannin | `additions[]` | `{ name: "Wine tannin", amount, unit: "tsp", purpose: "structure", timing: "at pitch" }` | Same as wine. |
| Stabilizer (potassium sorbate) | `additions[]` | `{ name: "Potassium sorbate", amount, unit: "g", purpose: "yeast inhibitor (locks residual sweetness)", timing: "24 h after sulfite" }` | Same as mead semi-sweet / pyment. |
| **Juice concentrate for priming/carbonation at bottling** | `additions[]` | `{ name: "Apple juice concentrate (priming)", amount, unit: "L" \| "g", purpose: "priming/carbonation + apple flavor", timing: "at bottling" }` | **Not a `fermentable`** — see decision below. |
| Spice / flavor in secondary | `additions[]` | `{ name, amount, unit: "g" \| "stick", purpose: "spice", timing: "in secondary" }` | Same as metheglin pattern. |
| Process steps (primary, racking, aging, stabilizing, backsweetening, bottling) | `processSteps[]` | `{ name, type, tempC?, durationDays?, notes? }` | Use `type: "bottling"` for the priming step; reference the priming `Addition` in its `notes`. |

### Yeast + category basics

- `category`: must be the literal string `"cider"`.
- `styleName`: free text (e.g. "English-style Dry Cider", "New England Style Cider", "Hopped Cider", "Fruit Cider (Blackberry)").
- `bjcpCategory`: optional. Use the cider-side codes where they exist (e.g. **C1** for "Standard Cider and Perry"); otherwise leave `null`.
- `yeasts[]`: pick `type: "wine"` or `type: "champagne"` for cider strains (e.g. EC-1118, D47, DV10). Attenuation in the 75–95 % range is normal.
- `targetIbu`: only set for hopped ciders; otherwise `null` (mirrors mead/wine).
- `targetSrm`: only set if colour matters; otherwise `null`. Cider typically reads as pale gold (≈ SRM 4–7).
- `batchSizeLiters`: 19 L (5 gal) for a standard batch; 3.8 L (1 gal) is fine for the small-kit variants.

### Priming / carbonation — the decision (BRE-19 deliverable)

The user primes with **apple juice concentrate at bottling** for both carbonation and residual apple flavor. The two natural representations were considered:

1. **A distinct top-level `priming` field** — rejected. Heavy schema change for a one-off, and isolates a value that semantically is a fermentable at a non-standard time.
2. **A `Fermentable` at a later process step** — rejected. If we put it in `fermentables[]` with no timing, `estimateOg` would falsely count it toward pre-fermentation gravity. Adding a `timing` column to `Fermentable` just to support post-primary additions is heavy.
3. **An `Addition` row** — **chosen**. The `Addition` model already has `amount`, `unit`, `purpose`, and `timing` fields, designed for non-fermentable additions (campden, sorbate, nutrients). A bottling-time concentrate fits this pattern exactly: it's not part of the pre-fermentation gravity bill, but it has a real structured identity in the recipe.

Concrete shape:

```json
{
  "name": "Apple juice concentrate (priming)",
  "amount": 0.30,
  "unit": "L",
  "purpose": "priming/carbonation + apple flavor boost at bottling",
  "timing": "at bottling",
  "position": 6
}
```

And reference it from a `processSteps[]` entry:

```json
{
  "name": "Bottle with priming",
  "type": "bottling",
  "tempC": 18,
  "durationDays": 14,
  "notes": "Stir in 0.30 L apple juice concentrate per 19 L batch for natural carbonation. Condition 2 weeks at 18 °C.",
  "position": 5
}
```

If the same recipe also uses concentrate **at pitch** for flavor boost (a separate fermentable), put that in `fermentables[]` as a normal `type: "concentrate"` entry — only the bottling-time dose goes in `additions[]`.

### Worked example — semi-sweet apple cider (skeleton)

```json
{
  "title": "Orchard Dry-Hopped Cider",
  "category": "cider",
  "styleName": "Modern Dry-Hopped Cider",
  "bjcpCategory": "C2A",
  "batchSizeLiters": 19,
  "boilTimeMinutes": 0,
  "efficiencyPct": 75,
  "targetOg": 1.052,
  "targetFg": 1.004,
  "targetAbv": 6.3,
  "fermentables": [
    { "name": "Store-bought apple juice (no preservative)", "type": "juice", "amountLiters": 18.0, "position": 0 },
    { "name": "Apple juice concentrate (flavor boost)", "type": "concentrate", "amountLiters": 0.4, "position": 1 }
  ],
  "hops": [
    { "name": "Citra", "amountGrams": 30, "alphaAcidPct": 12, "timeMinutes": 0, "use": "dryHop", "form": "pellet", "position": 0 }
  ],
  "yeasts": [
    { "name": "EC-1118", "type": "champagne", "form": "dry", "attenuationPct": 95, "position": 0 }
  ],
  "additions": [
    { "name": "Acid blend", "amount": 4.0, "unit": "g", "purpose": "TA adjustment — adds tartness to balance sweetness", "timing": "at pitch", "position": 0 },
    { "name": "Pectic enzyme", "amount": 1.0, "unit": "tsp", "purpose": "breaks down apple pectin for clarity", "timing": "at pitch", "position": 1 },
    { "name": "Campden tablet", "amount": 2, "unit": "tablet", "purpose": "sanitation / antioxidant", "timing": "24 h before pitch", "position": 2 },
    { "name": "Fermaid-O", "amount": 4.0, "unit": "g", "purpose": "yeast nutrient", "timing": "staggered over first 3 days", "position": 3 },
    { "name": "Apple juice concentrate (priming)", "amount": 0.30, "unit": "L", "purpose": "priming/carbonation + apple flavor boost", "timing": "at bottling", "position": 4 }
  ],
  "processSteps": [
    { "name": "Campden rest", "type": "other", "durationDays": 1, "position": 0 },
    { "name": "Pitch yeast + nutrients", "type": "primary", "tempC": 17, "durationDays": 14, "position": 1 },
    { "name": "Dry hop", "type": "secondary", "durationDays": 3, "position": 2 },
    { "name": "Rack off lees + hops", "type": "racking", "position": 3 },
    { "name": "Bulk age", "type": "aging", "tempC": 4, "durationDays": 14, "position": 4 },
    { "name": "Bottle with priming", "type": "bottling", "tempC": 18, "durationDays": 14, "notes": "Stir in 0.30 L apple juice concentrate per 19 L batch.", "position": 5 }
  ]
}
```

This passes `recipeCreateSchema.strict()` as-is. The Curator can paste it into `prisma/seed/recipes.json` after adjusting the values for the actual recipe.
