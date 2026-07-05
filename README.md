# Brew Recipe Library

A Next.js (App Router, TypeScript) web app for home brewers to browse, search,
and manage brewing recipes — grain bills, hop schedules, yeast, mash steps,
and target OG/FG/IBU/SRM/ABV, plus mead, wine, and cider for the same author.

## Stack

- **Next.js** (App Router) + **TypeScript** — API routes and frontend in one app
- **Prisma 7** ORM with a **SQLite** database (via the `better-sqlite3` driver adapter)
- **Tailwind CSS** for styling
- **Zod** for input validation, **Vitest** for unit/integration tests

## Prerequisites

- Node.js **20.9+** (Next.js 16 requires it)
- npm 10+

## Getting started

```bash
npm install          # also runs `prisma generate` via postinstall
npm run db:migrate   # apply migrations to the local SQLite db (./dev.db)
npm run db:seed      # load prisma/seed/recipes.json into the local db
npm run dev          # http://localhost:3000
```

`DATABASE_URL` lives in `.env` and defaults to `file:./dev.db` (local SQLite, no
secrets — committed so the app and Prisma CLI work out of the box).

### Useful scripts

| Script               | What it does                                       |
| -------------------- | -------------------------------------------------- |
| `npm run dev`        | Start the dev server                               |
| `npm run build`      | Production build (type-checks the whole app)       |
| `npm start`          | Start the production server                        |
| `npm run lint`       | ESLint over the whole project                      |
| `npm test`           | `vitest run` — full suite                          |
| `npm run db:migrate` | `prisma migrate dev`                               |
| `npm run db:push`    | `prisma db push` (sync schema without a migration) |
| `npm run db:seed`    | Wipe and reload from `prisma/seed/recipes.json`    |
| `npm run db:studio`  | Open Prisma Studio                                 |

### Clean-checkout reset

If you want to wipe and rebuild the local DB from scratch:

```bash
npx prisma migrate reset --force   # drops dev.db, re-runs migrations
npm run db:seed                    # reload prisma/seed/recipes.json (19 recipes)
npm run dev
```

### Seed dataset

The seed JSON ([`prisma/seed/recipes.json`](prisma/seed/recipes.json)) covers
**19 recipes** across beer, mead, and wine (12 beer, 4 mead, 3 wine). See
[`prisma/seed/STYLE_COVERAGE.md`](prisma/seed/STYLE_COVERAGE.md) for the full
list with OG/FG/ABV and BJCP / mead-style codes.

## Data model

The Prisma schema lives in [`prisma/schema.prisma`](prisma/schema.prisma). All
physical quantities are stored in **metric SI units** (kg, litres, grams,
Celsius); imperial conversion happens in app code, never in the DB. SQLite has no
enums, so categorical fields are `String` with allowed values documented inline.

- **Recipe** — title, author, description/notes, `category`
  (`beer | mead | wine | cider | other`), `styleName`, `bjcpCategory`,
  `batchSizeLiters`, `boilTimeMinutes`, `efficiencyPct`, and targets
  `targetOg`/`targetFg`/`targetAbv`/`targetIbu`/`targetSrm`.
- **Fermentable** — grain/extract/sugar/adjunct/honey/juice/concentrate/fruit/must.
  Either `amountKg` (solids) or `amountLiters` (liquids); `colorLovibond`,
  `potentialPpg`.
- **Hop** — `name`, `amountGrams`, `alphaAcidPct`, `timeMinutes`, `use`
  (boil/firstWort/whirlpool/dryHop/mash), `form`.
- **Yeast** — `name`, `laboratory`, `productId`, `type`, `form`,
  `attenuationPct`, temperature range.
- **MashStep** — `name`, `type` (infusion/temperature/decoction), `stepTempC`,
  `stepTimeMinutes`, `infuseAmountLiters`, ordered by `position`.
- **ProcessStep** — generic fermentation/racking/backsweetening/stabilizing/
  aging/bottling step that applies across all categories.
- **Addition** — non-fermentable, non-hop, non-yeast input (yeast nutrient, acid
  blend, pectic enzyme, campden/potassium metabisulfite, tannin).

Fermentables, Hops, Yeasts, MashSteps, ProcessSteps, and Additions each belong
to a Recipe (`onDelete: Cascade`) and carry a `position` field for stable
ordering.

Access the DB through the shared client in
[`src/lib/db.ts`](src/lib/db.ts): `import { prisma } from "@/lib/db"`.

## Calculation layer

Pure, dependency-free brewing math under [`src/lib/brewing/`](src/lib/brewing/).
The layer exposes:

| Function                                | What it computes                         |
| --------------------------------------- | ---------------------------------------- |
| `estimateOg(ferm, batchL, effPct)`      | Original gravity from grain bill         |
| `estimateFg(og, attPct)`                | Final gravity from OG + attenuation      |
| `estimateAbv(og, fg)`                   | ABV %                                     |
| `estimateIbu(hops, batchL, og)`         | IBU (Tinseth)                              |
| `estimateSrm(ferm, batchL)`             | SRM (Morey)                                |
| `computeTargets(input)`                 | OG / FG / ABV / IBU / SRM in one pass    |
| `scaleRecipe(recipe, toLiters)`         | Linear scale of all ingredient amounts   |
| `kgToPounds` / `poundsToKg` / etc.      | Imperial <-> metric unit helpers         |

Import everything from `@/lib/brewing`.

## HTTP API

All endpoints are App Router `route.ts` handlers under
[`src/app/api/`](src/app/api). The DB stores metric; imperial values are
added to the response when callers ask for them.

| Method  | Path                                 | Purpose                                                             |
| ------- | ------------------------------------ | ------------------------------------------------------------------- |
| `GET`   | `/api/recipes`                       | Paginated list (filters: `q`, `category`, `style`, `bjcpCategory`, `ingredient`, `abvMin`, `abvMax`, `limit`, `offset`) |
| `POST`  | `/api/recipes`                       | Create a recipe                                                     |
| `GET`   | `/api/recipes/[id]`                  | Fetch (`?batchSize=` for scaling, `?units=imperial` for conversion) |
| `PUT`   | `/api/recipes/[id]`                  | Replace the recipe and all children                                 |
| `PATCH` | `/api/recipes/[id]`                  | Partial update (any scalar or child list)                           |
| `DELETE`| `/api/recipes/[id]`                  | Delete the recipe                                                   |
| `POST`  | `/api/recipes/[id]/clone`            | Deep-copy a recipe with `(copy)` appended to the title              |

### Examples

```bash
# Filter by category
curl 'http://localhost:3000/api/recipes?category=wine&limit=10'

# Search by free text + ingredient
curl 'http://localhost:3000/api/recipes?q=hoppy&ingredient=Cascade'

# Scale a batch to a new size in imperial units
curl 'http://localhost:3000/api/recipes/<id>?batchSize=8&units=imperial'

# Create a recipe
curl -X POST http://localhost:3000/api/recipes \
  -H 'content-type: application/json' \
  -d '{
    "title": "My Test IPA",
    "category": "beer",
    "batchSizeLiters": 20,
    "fermentables": [{"name": "Pale 2-Row", "type": "grain", "amountKg": 4.5}],
    "hops": [{"name": "Cascade", "amountGrams": 25, "timeMinutes": 60, "use": "boil"}],
    "yeasts": [{"name": "US-05", "form": "dry", "attenuationPct": 81}]
  }'
```

### Response shape

Successful responses are `{ data: ... }` or `{ data: [...], total, limit, offset }`.
Errors are `{ error: { message, issues? } }` with `issues` populated on validation
failures (`HTTP 400`).

### Validation

All write paths (`POST`, `PUT`, `PATCH`) are validated with Zod schemas in
[`src/lib/api/schemas.ts`](src/lib/api/schemas.ts). Constants for categorical
fields (fermentable type, hop use, hop form, etc.) are exported from the same
file so the UI in stage 4 can reuse the same source of truth.

## Web UI

Two pages, both SSR-rendered against the local SQLite DB:

| Route             | What it does                                                              |
| ----------------- | ------------------------------------------------------------------------- |
| `/`               | Browse page: lists every recipe with title, category badge, style/BJCP, batch size, target ABV and OG. Filter form for `category` and `style` substring. |
| `/recipes/[id]`   | Detail page: full recipe (fermentables, hops, yeast, mash steps, process steps, additions, brewer notes), with a batch-size scaling control and metric/imperial unit toggle. |

Both pages fetch via the same `/api/...` endpoints the API uses; no separate
backend process.

### Sharing a scaled view

The detail page honours `?batchSize=<litres>` and `?units=imperial` on the URL
so you can share a scaled or imperial link:

```text
/recipes/<id>?batchSize=40&units=imperial
```

## Tests

```bash
npm test
```

- `src/lib/brewing/*` — pure-function tests for OG/FG/IBU/SRM/ABV/scaling/units
- `test/api/schemas.test.ts` — request-shape validation
- `test/api/recipeMapper.test.ts` — body-to-Prisma input translation
- `test/api/search.test.ts` — filter-clause builder
- `test/api/present.test.ts` — scaling + unit conversion for responses
- `test/api/routes.test.ts` — full route handler integration against an
  isolated SQLite DB (per-test schema migration + reset), covers create/read/
  update/delete/search/scale/units happy paths
- `test/seed/load.test.ts` + `test/seed/seedFile.test.ts` — seed JSON ingestion
- `test/ui/browse.test.tsx` — server-renders the browse page against the
  seeded DB and checks the recipes, filter form, and category narrowing
