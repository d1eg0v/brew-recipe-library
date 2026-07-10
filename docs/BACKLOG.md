# Brew Recipe Library — Feature Backlog

Proposed tickets in the project's `BRE-XX` convention, numbered from **BRE-23**
(highest shipped is BRE-22). Grouped by theme; each ticket lists a description,
acceptance criteria, and technical notes pointing at existing code where the
groundwork already exists.

Priorities: **P0** = highest leverage / unblocks others, **P1** = high value,
**P2** = nice to have.

---

## Theme 1 — Close the CRUD gap (backend exists, no UI)

The API already exposes `POST /api/recipes`, `PUT`, `PATCH`, and `DELETE` on
`/api/recipes/[id]`, but the frontend is read-only. These tickets surface what's
already there.

### BRE-23 — Recipe create / edit UI  · **P0**
**Description:** Add a form-based UI to create a new recipe and edit an existing
one, including its nested lists (fermentables, hops, yeasts, mash steps, process
steps, additions). This is the single highest-leverage item — it unlocks the
whole library for real use instead of seed-only data.

**Acceptance criteria:**
- "New recipe" entry point on the browse page; "Edit" on each detail page.
- Form covers all `Recipe` fields plus add/remove/reorder rows for each nested list.
- Client + server validation via the existing Zod schemas; inline field errors.
- Save calls `POST` (create) or `PUT`/`PATCH` (edit) and redirects to the detail page.
- Live-computed targets (OG/FG/ABV/IBU/SRM) preview as ingredients change.

**Technical notes:** Routes exist in `src/app/api/recipes/`. Reuse the calc
functions in `src/lib/brewing/` for the live preview. `position` fields already
exist on every nested model for ordering.

### BRE-24 — Delete & duplicate actions on detail page · **P1**
**Description:** Surface the existing `DELETE` route and clone route
(`/api/recipes/[id]/clone`) as buttons on the recipe detail page.

**Acceptance criteria:**
- "Duplicate" creates a copy ("… (copy)") and navigates to it.
- "Delete" prompts for confirmation, then removes and returns to browse.
- Destructive action guarded so it can't fire from a stray click.

**Technical notes:** Clone endpoint already exists; only the UI is missing.

---

## Theme 2 — Search & discovery

Today the browse page filters by `category` and "style contains" only
(`src/app/page.tsx`).

### BRE-25 — Full-text search · **P1**
**Description:** Search box over title, author, description, and notes.

**Acceptance criteria:**
- Single query input filters the list server-side.
- Matches across all four text fields, case-insensitive.
- Combines with existing category/style filters.

### BRE-26 — Filter by target ranges (ABV / IBU / SRM / OG) · **P1**
**Description:** Numeric range filters for the target measurements.

**Acceptance criteria:**
- Min/max controls for ABV, IBU, SRM, and OG.
- Recipes with null targets are excluded from a range filter when that range is active.
- Filters stack with search and category.

### BRE-27 — Sort options · **P2**
**Description:** Sort the browse list by name, ABV, IBU, gravity, or date added
(asc/desc).

**Acceptance criteria:** Sort control persists in the URL query string alongside filters.

### BRE-28 — Filter by ingredient · **P2**
**Description:** "Show all recipes using X" for a hop, fermentable, or yeast.

**Acceptance criteria:**
- Ingredient names on a detail page link to a filtered browse view.
- Free-text ingredient filter on the browse page (e.g. "Citra", "US-05").

**Technical notes:** Query across the `Hop` / `Fermentable` / `Yeast` relations by name.

### BRE-29 — Tags / labels · **P2**
**Description:** Freeform tags on recipes (e.g. "session", "competition",
"summer") independent of the fixed `category`.

**Acceptance criteria:**
- Add/remove tags on a recipe; tags render as chips on cards and detail.
- Click a tag to filter the library by it.

**Technical notes:** New `Tag` model + join table, or a JSON/string column. Prefer
a real relation for filtering.

---

## Theme 3 — Brewing tools (leverages `src/lib/brewing/`)

### BRE-30 — Global metric ⇄ imperial unit toggle · **P1**
**Description:** A header toggle switching all displayed quantities between metric
and imperial (kg↔lb, L↔gal, °C↔°F, g↔oz).

**Acceptance criteria:**
- Toggle in the header; choice persisted like the theme (`localStorage`).
- All recipe and detail views respect it; DB stays metric (per schema convention).

**Technical notes:** Conversion helpers already exist in
`src/lib/brewing/units.ts`. Persist alongside the existing `brew-theme` pattern.

### BRE-31 — Water chemistry calculator · **P2**
**Description:** Source-water profile + salt additions (gypsum, calcium chloride,
etc.) → resulting mineral profile and estimated mash pH.

**Acceptance criteria:** Standalone tool; optionally attach a water profile to a recipe.

### BRE-32 — Priming sugar / carbonation calculator · **P1**
**Description:** Target CO₂ volumes + batch size + temperature → priming sugar weight.

**Acceptance criteria:**
- Inputs for style-typical CO₂ range, temp, and volume.
- Supports common sugars (corn sugar, table sugar, DME).
- Available standalone and pre-filled from a recipe's batch size.

### BRE-33 — Yeast pitch-rate / starter calculator · **P2**
**Description:** Recommended cell count and starter size from OG, volume, and
yeast viability.

**Acceptance criteria:** Ale vs lager pitch rates; outputs packs or starter volume.

### BRE-34 — Strike-water & mash calculator · **P2**
**Description:** Strike-water volume and temperature from grain weight, target
mash temp, and grain temp.

**Technical notes:** Complements the `MashStep` model; pre-fill from a recipe's grain bill.

### BRE-35 — Quick ABV-from-OG/FG tool · **P2**
**Description:** Standalone "measured OG + FG → ABV" calculator, separate from
stored recipe targets.

**Technical notes:** ABV math already exists in `src/lib/brewing/gravity.ts`.

### BRE-36 — Recipe comparison view · **P2**
**Description:** Two recipes side by side — stats and ingredient lists.

**Acceptance criteria:** Pick two recipes; columns align grain bills, hops, and targets.

---

## Theme 4 — Brew-day & tracking (new models)

Turns the "library" into an app people return to after brew day.

### BRE-37 — Brew logs / batch history · **P0**
**Description:** Log an actual brew of a recipe — dates, measured OG/FG/volumes,
efficiency achieved, and what deviated from the recipe.

**Acceptance criteria:**
- Create a batch from a recipe; a recipe shows its brew history.
- Store measured vs target and compute actual ABV/efficiency.

**Technical notes:** New `Batch` model FK'd to `Recipe`. Reuse
`src/lib/brewing/` for actual-vs-target math.

### BRE-38 — Fermentation tracking + chart · **P2**
**Description:** Time-series gravity/temperature readings per batch, plotted.

**Acceptance criteria:** Add dated readings to a batch; render a gravity-over-time chart.

**Technical notes:** Depends on BRE-37. See the `dataviz` skill for chart conventions.

### BRE-39 — Tasting notes & ratings · **P1**
**Description:** Rate and note finished batches; surface ratings across the library.

**Acceptance criteria:**
- Star rating + free-text notes per batch (or recipe).
- Average rating shown on cards; sortable by rating (ties into BRE-27).

### BRE-40 — Ingredient inventory · **P2** · shipped
**Description:** Track on-hand grain/hop/yeast stock; cross-reference the existing
shopping-list output to show what you still need to buy.

**Technical notes:** Builds on `src/lib/brewing/shoppingList.ts` and the
`/api/recipes/[id]/shopping-list` route. Ships an `InventoryItem` Prisma
model + a new `/api/inventory` CRUD resource + a `?includeInventory=true`
flag on the shopping-list route that layers the pantry onto every row. Pure
cross-reference lives in `src/lib/brewing/inventory.ts`; the `/inventory`
page gives the brewer a CRUD UI grouped by category.

---

## Theme 5 — Export / import / sharing

### BRE-41 — BeerXML import / export · **P0**
**Description:** Import and export recipes in BeerXML — the universal homebrew
interchange format. Instant interoperability with BeerSmith, Brewfather, etc.

**Acceptance criteria:**
- Export any recipe to a valid BeerXML file.
- Import a BeerXML file into a new recipe, mapping to the schema.
- Round-trip (export → import) preserves core fields.

**Technical notes:** Metric-internal storage plays well with BeerXML's SI-ish
fields; map categorical strings (hop `use`, fermentable `type`, etc.) both ways.

### BRE-42 — Print / PDF brew sheet · **P1**
**Description:** Clean, printable one-page brew sheet: recipe, mash/boil schedule,
and a brew-day checklist.

**Acceptance criteria:** Print-optimized layout (print CSS or PDF); hides nav/chrome.

### BRE-43 — Shareable read-only recipe links · **P2**
**Description:** Public, read-only URLs for individual recipes.

**Acceptance criteria:** A recipe can be marked shareable; the link renders detail without edit controls.

---

## Theme 6 — Polish

### BRE-44 — BJCP style-guideline comparison · **P1**
**Description:** Flag when a recipe's OG/FG/IBU/SRM/ABV falls outside its declared
BJCP style range.

**Acceptance criteria:**
- Store style ranges (seed a BJCP dataset).
- On detail, show in/out-of-range indicators per metric using the recipe's `bjcpCategory`.

**Technical notes:** `Recipe.bjcpCategory` and `styleName` already exist.

### BRE-45 — SRM color swatch · **P1**
**Description:** Render the actual beer color from the `targetSrm` value as a swatch
on cards and detail pages.

**Technical notes:** SRM→RGB conversion; color logic already lives in
`src/lib/brewing/color.ts`.

### BRE-46 — Favorites / bookmarking · **P2**
**Description:** Mark recipes as favorites and filter to them.

**Acceptance criteria:** Toggle a favorite on cards/detail; "Favorites" filter on browse.

---

## Suggested first sprint

1. **BRE-23** — Recipe create/edit UI (unlocks everything; backend already there)
2. **BRE-41** — BeerXML import/export (interop with the tools brewers already use)
3. **BRE-37** — Brew logs (turns the library into a return-to app)

P0 items across the backlog: BRE-23, BRE-37, BRE-41.
