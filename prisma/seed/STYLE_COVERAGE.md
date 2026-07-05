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
mead and cider for **19 L (5 gal)**, and wine recipes cover both the **4 L (1 gal)**
single‑jug "pantry kit" style and the standard **19 L** fresh‑fruit batch.

## Coverage checklist (28 recipes)

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

### Cider (6 — all `category: "cider"`, store-bought juice base, `processSteps` + `additions`)

| # | Recipe | Style | BJCP | OG | FG | ABV % | Batch | Notable technique |
|---|--------|-------|------|----|----|-------|-------|-------------------|
| 23 | Northgate Dry Apple Cider | Standard Cider and Perry (Dry) | C1 | 1.050 | 1.002 | 6.3 | 19 L | Reference base; citric + malic acid blend |
| 24 | Sunhill Semi-Sweet Apple Cider | Cider, Other Origin (Semi-Sweet) | C2B | 1.052 | 1.003 | 6.4 | 19 L | Back-sweetened with concentrate + K-sorbate |
| 25 | Riverbend Naturally Carbonated Cider | Standard Cider and Perry (Petillant) | C1 | 1.048 | 1.002 | 6.0 | 19 L | Concentrate priming at bottling (~2.5 vol CO2) |
| 26 | Blackberry Hollow Apple Cider | Cider, Specialty — Fruit (Blackberry) | C2C | 1.058 | 1.003 | 7.2 | 19 L | Whole frozen blackberries in primary |
| 27 | Cranberry Bog Apple Cider | Cider, Specialty — Fruit (Cranberry) | C2C | 1.054 | 1.003 | 6.7 | 19 L | 100 % cranberry juice; low-acid / slight back-sweeten |
| 28 | Fireside Spiced Apple Cider | Cider, Specialty — Spice (Cinnamon / Clove / Allspice) | C2C | 1.050 | 1.002 | 6.3 | 19 L | Whole-spice steep in secondary |

All cider recipes share the same base approach the user requested:

- **Base:** store-bought pasteurized apple juice with no added sorbate / benzoate / ascorbic (otherwise the yeast stalls).
- **Acid adjustment:** explicit **citric acid** + **malic acid** grams (`g` units in `additions[]`), not a generic "acid blend" hand-wave.
- **Apple juice concentrate:** appears in **two** distinct roles per the BRE-19 contract:
  - **At pitch** — `fermentables[]` as `type: "concentrate"`, contributes to OG and lifts apple character through fermentation.
  - **At bottling** for **priming/carbonation** — `additions[]` with `purpose: "priming/carbonation + apple flavor boost"`, `timing: "at bottling"`, `unit: "L"`. **Never** a fermentable (would falsely inflate OG).
  - For **back-sweetening** in semi-sweet and cranberry ciders — also `additions[]` with `purpose: "back-sweetening"`, `timing: "after stabilization, before bottling"`, paired with K-meta + K-sorbate stabilization so residual sugar doesn't re-ferment in the bottle.
- **Yeast:** Lalvin EC-1118 (`type: "champagne"`, 95 % attenuation) across all six; ferments fully dry and leaves the concentrate additions as the only sugar left for the bottle step.

## Breadth summary

**By category:**
- **Beer (14)** — IPAs (West Coast, NEIPA, Hazy DIPA), pale ales, ambers, browns, stouts/porters, wheats, lagers, Belgian Dubbel/Witbier/Saison
- **Mead (5)** — dry traditional, semi-sweet traditional, fruit melomel (blackberry), spiced metheglin (warm-spice and hibiscus Viking's Blood variants)
- **Wine (3)** — store-bought juice kit (Concord, 4 L), fresh-fruit country wine (apple, 19 L), pyment (honey + grape concentrate blend)
- **Cider (6)** — dry base, semi-sweet (back-sweetened), naturally carbonated (concentrate priming), two fruit ciders (blackberry + cranberry), one spiced (cinnamon / clove / allspice)

**Range:**
- SRM 3 (light pilsner / witbier) → SRM 38 (Irish stout); ciders sit around SRM 4–7 (left as `null` since colour is rarely a focus for store-bought-juice cider)
- ABV 4.3 % (Irish stout) → ABV 14.5 % (dry mead) / 14.0 % (pyment); ciders cluster 6.0–7.2 %
- IBU 13 (hefeweizen) → IBU 65 (West Coast IPA); ciders report `targetIbu: null` (no hops)
- Batch sizes: 4 L (kit wine) → 20 L (beer); cider is consistently 19 L (5 gal)
- Yeast types in use: ale, lager, wheat, wine, champagne
- Fermentable `type` values: grain, sugar, honey, juice, concentrate, fruit, adjunct
- Yeast attenuation ranges 73 % → 95 %

**Process / technique variety:**
- Beer: single-infusion, step, and protein-rest mashes; boil/whirlpool/dry-hop schedules; two-stage and three-stage dry-hop schedules with biotransformation timing notes (NEIPA / Hazy DIPA)
- Mead: staggered nutrient additions (SNA), bulk aging, cold-crash stabilization, backsweetening after sorbate, fruit in primary, spice steep in secondary (warm-spice metheglin, hibiscus + elderberry + orange-peel Viking's Blood in secondary)
- Wine: campden rest, pectic enzyme, backsweetening, oak aging (pyment), single-jug 4 L kit (Concord) vs. 19 L fresh-pressed batch (apple)
- Cider: campden rest, pectic enzyme at pitch, staggered SNA nutrients, primary on fruit cap (blackberry), fruit-juice blend (cranberry), whole-spice steep in secondary (Fireside), cold bulk age, stabilization (K-meta + K-sorbate) before back-sweetening, concentrate priming at bottling for natural carbonation, force-carb or still bottle options noted per recipe

## Categorical field values in use (match schema allowed values)

- **`Recipe.category`:** `beer`, `mead`, `wine`, `cider`
- **`fermentable.type`:** `grain`, `adjunct`, `sugar`, `honey`, `juice`, `concentrate`, `fruit`
- **`fermentable.amount`:** `amountKg` for solids (grain / honey / sugar / fruit / flaked adjuncts), `amountLiters` for liquids (juice / concentrate / must); both fields nullable, at least one set per row
- **`hop.use`:** `boil`, `whirlpool`, `dryHop`  ·  **`hop.form`:** `pellet` (beer-only — non-beer recipes use `hops: []`)
- **`yeast.type`:** `ale`, `lager`, `wheat`, `wine`, `champagne`  ·  **`yeast.form`:** `dry`, `liquid`
- **`mashStep.type`:** `infusion`, `temperature` (beer-only — non-beer recipes use `mashSteps: []`)
- **`processStep.type`:** `primary`, `secondary`, `racking`, `backsweetening`, `stabilizing`, `aging`, `bottling`, `other` (used for mead + wine + cider)
- **`addition.unit`:** `g`, `tsp`, `tablet`, `stick`, `L` (free-text per schema; `L` is used for cider concentrate additions, both priming and back-sweetening); **`addition.purpose`:** `yeast rehydration nutrient`, `yeast nutrient (organic/inorganic)`, `antimicrobial/antioxidant`, `yeast inhibitor`, `breaks down pectin for clarity`, `TA adjustment`, `structure / mouthfeel`, `spice`, `colour + tart fruit character (lead botanical)`, `priming/carbonation + apple flavor boost`, `back-sweetening for residual apple sweetness (still cider, no priming)`, `back-sweetening to balance cranberry sharpness (still cider, no priming)`

> **Note on dry-hop timing:** for `use: "dryHop"` entries, `timeMinutes` carries the
> dry-hop duration in **days** (per the schema's inline note that the field is
> "boil minutes or dry-hop days"); a `notes: "dry hop #N at …, days, …"` marker is
> set on those rows so the loader/UI can disambiguate.

> **Note on cider concentrate roles (BRE-19 contract):**
> - **At-pitch concentrate** (apple flavor boost, contributes to OG) → `fermentables[]` as `type: "concentrate"`.
> - **At-bottling concentrate for priming / carbonation** → `additions[]` with `purpose: "priming/carbonation + apple flavor boost"`, `timing: "at bottling"`, `unit: "L"`.
> - **At-bottling concentrate for back-sweetening** (semi-sweet, cranberry) → `additions[]` with `purpose: "back-sweetening …"`, `timing: "after stabilization, before bottling"`. Always paired with K-meta + K-sorbate stabilization so residual sugar doesn't re-ferment.
> See `test/api/schemas.test.ts` → "seed cider recipes (BRE-20)" for the regression that locks these patterns in.

## Gaps / possible future additions

Not yet covered (candidates for a later expansion):

- **Beer:** English bitters (11A/11B), Märzen/Oktoberfest (6A), Belgian Tripel (26C), Doppelbock (9A), Kölsch (5B), sour/wild styles (23-series), NEIPA-adjacent variants (e.g. fruited hazy IPA, milkshake IPA)
- **Mead:** braggot (M5A), cyser (apple-honey), pyment variants beyond red-grape, bochet (caramelized-honey mead)
- **Wine:** strawberry / elderberry / dandelion country wines, fruit-kit wines, ice wine / late-harvest
- **Cider:**
  - hopped dry cider (citra / mosaic dry hop in secondary)
  - English / French style farmhouse cider (C1 subtypes with distinct acid + tannin targets)
  - perry (pear cider) — same shape but `juice` fermentable + no acid blend
  - ice cider / apple dessert wine (high-OG apple concentrate + cold-ferment)
  - ginger cider (single-flavor spice variation)
  - small-batch (4 L / 1 gal) cider variant for the pantry-kit audience
