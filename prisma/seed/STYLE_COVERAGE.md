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
- **Cider:** not yet represented (schema supports `category: "cider"` but the seed set doesn't include any)
