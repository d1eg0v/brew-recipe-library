# BRE-41 — BeerXML import / export

**Parent:** BRE-49 (v2 backlog)
**Type:** P0 · **Size:** medium

---

## Context

BeerXML 1.0 is the universal homebrew interchange format. BeerSmith,
Brewfather, BeerXML.org, and most other homebrew tools export recipes in this
format. We already store recipes in metric SI units internally (kg / L / °C),
which maps cleanly onto BeerXML's SI-ish fields — the work is mapping
categorical strings both directions and keeping round-trip lossless for the
core fields.

This ticket adds a pure parse/serialize module plus two thin HTTP routes and
the minimal UI surface to invoke them. Existing tests, schemas, and the
`recipeToCreateInput` mapper are reused — we don't fork a new ingestion path.

> ⚠️ **Read `AGENTS.md` first.** Next.js 16's App Router conventions differ
> from older releases (async `params`, etc.). Match the existing routes in
> `src/app/api/recipes/[id]/route.ts` and
> `src/app/api/recipes/[id]/shopping-list/route.ts` exactly. When unsure,
> read `node_modules/next/dist/docs/`.

## Goal

Round-trip a recipe through BeerXML without losing core fields.

## API surface

| Method & path | Behaviour |
| --- | --- |
| `GET /api/recipes/[id]/export` | Return the recipe as a BeerXML document. `Content-Type: application/xml; charset=utf-8`, `Content-Disposition: attachment; filename="<safe-title>.beerxml"`. `?format=json` returns `{ data: { xml } }` for in-browser download shims. 404 on unknown id. |
| `POST /api/recipes/import` | Body is BeerXML (text). Accepts `application/xml`, `text/xml`, `application/beerxml`, or `multipart/form-data` with a `file` field. Parses, validates with `recipeCreateSchema`, creates a recipe, returns the same `{ data }` envelope as `POST /api/recipes`. |

New route files:
- `src/app/api/recipes/[id]/export/route.ts`
- `src/app/api/recipes/import/route.ts`

## Library design (`src/lib/beerxml/`)

Pure functions, no I/O. Importable as `@/lib/beerxml`.

| File | Purpose |
| --- | --- |
| `index.ts` | Public re-exports. |
| `types.ts` | Loose TS shapes for the BeerXML object tree (`BeerXmlRecipe`, `BeerXmlFermentable`, …). |
| `mappings.ts` | Bidirectional maps for hop `USE`, hop `FORM`, fermentable `TYPE`, yeast `FORM`/`TYPE`, mash step `TYPE`, and outer recipe `TYPE` → category. Tolerates case/whitespace variations (`first_wort`, `Dry Hop`, etc.). |
| `serializer.ts` | `serializeBeerXml(recipe, { singleLine? })` — emits a `<?xml?>` declaration plus `<RECIPES><RECIPE>…</RECIPE></RECIPES>`. Numeric values use the metric stored value; categorical strings are mapped to BeerXML form. Empty child lists become self-closing (`<FERMENTABLES/>`). XML-unsafe characters are escaped. BJCP code is split into `CATEGORY_NUMBER` + `STYLE_LETTER` when it matches the numeric + letter pattern. YIELD is emitted from `potentialPpg` via the convention `yield% = ppg / 46 × 100`. |
| `parser.ts` | `parseBeerXml(xml) → RecipeCreateBody` (or throws `BeerXmlParseError`). Uses `fast-xml-parser` with `ignoreAttributes`, `removeNSPrefix`, `parseTagValue`, and an `isArray` hook so single- and list-form child elements are handled uniformly. Validates that `<NAME>` and `<BATCH_SIZE>` are present; other fields are best-effort and clamped into the schema's ranges. |

### Categorical mapping rules

The mappings are the canonical spot to evolve when BeerSmith / Brewfather
introduce a new value. They round-trip: every value in our internal enum
maps back to itself after going out to BeerXML and back.

- `hop USE`: Boil / First Wort / Whirlpool / Dry Hop / Mash
- `hop FORM`: Pellet / Leaf / Plug / Extract
- `fermentable TYPE`: Grain / Extract / Sugar / Adjunct / Honey / Juice / Concentrate / Fruit / Must
- `yeast FORM`: Dry / Liquid / Slant / Culture
- `yeast TYPE`: Ale / Lager / Wheat / Wine / Champagne / Other
- `mash step TYPE`: Infusion / Temperature / Decoction
- recipe `TYPE`: All Grain / Extract / Partial Mash → `beer`; Mead → `mead`; Wine → `wine`; Cider → `cider`; anything else → `beer`

## UI surface

Minimal — one button on each side:

- **Detail page:** an "Export BeerXML" `<a>` next to the existing "Edit" button.
  The link points to `/api/recipes/[id]/export` with `download`, so the browser
  downloads the file directly. New file: `src/app/recipes/import/ImportClient.tsx`
  and `src/app/recipes/import/page.tsx` for the import form.
- **Browse page:** an "Import BeerXML" button next to "+ New recipe" leading to
  `/recipes/import`, which accepts a file upload and posts the contents as
  `application/xml` to the import route.

## Acceptance criteria

- [ ] Export endpoint returns valid BeerXML for any existing recipe; round-trips.
- [ ] Import endpoint accepts both `application/xml` body and `multipart/form-data` upload.
- [ ] Imported recipe is created via the existing `recipeToCreateInput` + `recipeCreateSchema` path — no parallel ingestion logic.
- [ ] Categorical mappings round-trip every internal enum value (`boil` → `"Boil"` → `boil`, etc.).
- [ ] BJCP code `21A` exports as `<CATEGORY_NUMBER>21</CATEGORY_NUMBER>` + `<STYLE_LETTER>A</STYLE_LETTER>` + `<CATEGORY>21A</CATEGORY>`.
- [ ] Numeric targets (OG/FG/IBU/SRM/ABV) round-trip within rounding.
- [ ] Empty fermentable / hop / yeast / mash lists emit self-closing tags.
- [ ] XML-unsafe characters in text fields (`&`, `<`, `>`, quotes) are escaped.
- [ ] Malformed XML or missing `<NAME>`/`<BATCH_SIZE>` returns `400` with a descriptive message.
- [ ] Unsupported `Content-Type` returns `400`.

## Dependencies

- Adds `fast-xml-parser@^5.9.3` (zero deps, MIT).

## Tests (required)

- `src/lib/beerxml/mappings.test.ts` — each direction of every categorical map, plus round-trips for the full internal enum.
- `src/lib/beerxml/serializer.test.ts` — emission of every section, BJCP split, escaping, self-closing empty lists, single-line option, and "document parses back with `XMLParser`".
- `src/lib/beerxml/parser.test.ts` — minimal doc, fermentables/hops/yeasts/mash steps with mapping, style + targets + notes capture, namespace-tolerant (BeerSmith export), and error cases (empty input, malformed XML, missing `<NAME>`, missing `<BATCH_SIZE>`).
- `src/lib/beerxml/roundtrip.test.ts` — export → import preserves scalar fields, child lists, categorical strings, and the parser output re-validates against `recipeCreateSchema`. Includes a multi-hop schedule with `boil`, `whirlpool`, and `dryHop` uses.
- `test/api/beerxml.test.ts` — `GET /api/recipes/[id]/export` (default + `?format=json` + 404), `POST /api/recipes/import` (XML body success / 400 paths / unsupported content-type / multipart upload / round-trip integration test).

## Definition of done

- [ ] `npm test` green (277+ tests including the new ones).
- [ ] `npm run lint` clean.
- [ ] `npm run build` succeeds and the two new routes show up in the route map.
- [ ] No change to existing recipe / batch routes or the Prisma schema.
- [ ] Work committed incrementally with conventional-commit messages, pushed to a feature branch, PR opened against `main`.