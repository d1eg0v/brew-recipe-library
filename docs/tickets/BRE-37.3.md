# BRE-37.3 — Batch CRUD API routes

**Parent:** BRE-37 (Brew logs / batch history)
**Depends on:** BRE-37.1 (Batch model — merged), BRE-37.2 (`src/lib/brewing/batch.ts` — merged)
**Blocks:** BRE-37.4 (batch history UI), BRE-37.5 (log-a-brew form)
**Type:** API / backend · **Size:** small–medium

---

## Context

A `Batch` records an actual brew of a recipe (measured OG/FG, volume, brew date,
notes). The model and a pure calc layer already exist and are merged:

- `prisma/schema.prisma` → `model Batch` (relation `Recipe.batches`, cascade delete).
- `src/lib/brewing/batch.ts` → `actualAbv`, `apparentAttenuation`,
  `brewhouseEfficiency` (import from `@/lib/brewing`).

What's missing is the HTTP layer. This ticket adds CRUD routes so the UI tickets
(37.4/37.5) have something to call.

> ⚠️ **Read `AGENTS.md` first.** This project pins a Next.js version whose App
> Router conventions differ from older releases (async `params`, etc.). Match the
> **existing** route in `src/app/api/recipes/[id]/route.ts` exactly — do not
> import patterns from memory. When unsure, read
> `node_modules/next/dist/docs/` as `AGENTS.md` instructs.

## Goal

Full CRUD for batches, following the repo's established API conventions.

### Endpoints

| Method & path | Behaviour |
| --- | --- |
| `POST /api/recipes/[id]/batches` | Create a batch for recipe `[id]`. 404 if the recipe doesn't exist. |
| `GET /api/recipes/[id]/batches` | List that recipe's batches, newest `brewDate` first. |
| `GET /api/batches/[id]` | Fetch one batch (with derived metrics). |
| `PATCH /api/batches/[id]` | Partial update; at least one field required. |
| `DELETE /api/batches/[id]` | Delete; `204 No Content`. |

New route files:
- `src/app/api/recipes/[id]/batches/route.ts` (POST, GET)
- `src/app/api/batches/[id]/route.ts` (GET, PATCH, DELETE)

## Conventions to follow (copy these, don't invent)

Study `src/app/api/recipes/[id]/route.ts` and `src/app/api/recipes/route.ts`,
then mirror them:

- **Async params:** `context: { params: Promise<{ id: string }> }`, then
  `const { id } = await context.params;`.
- **`export const dynamic = "force-dynamic";`** at the top of each route file.
- **Prisma client:** `import { prisma } from "@/lib/db";`.
- **Request parsing:** `readJson(request)` from `@/lib/api/errors` (returns a
  discriminated `{ ok, value } | { ok: false, response }`).
- **Validation:** Zod `safeParse`; on failure return `validationError(error)`.
  Put new schemas in `src/lib/api/schemas.ts` next to the recipe ones.
- **Error helpers** from `@/lib/api/errors`: `badRequest`, `notFound`,
  `internalError`, `validationError` (and `conflict` if needed).
- **Success envelope:** always `NextResponse.json({ data: ... })`. DELETE returns
  `new NextResponse(null, { status: 204 })`.
- **Errors:** wrap DB work in try/catch, `console.error("<METHOD> <path> failed:", err)`
  then `return internalError();` — exactly like the recipe route.

## Request / response contracts

### Create / update body (Zod)

Add `batchCreateSchema` and `batchPatchSchema` to `src/lib/api/schemas.ts`.

Fields (all metric; mirror the Prisma model):
- `brewDate` — ISO date string, **required** on create. Coerce to `Date`.
- `measuredOg` — number, optional, roughly `1.0`–`1.2` when present.
- `measuredFg` — number, optional, same range.
- `volumeLiters` — number, optional, `> 0` when present.
- `notes` — string, optional.

`batchPatchSchema` = all fields optional (including `brewDate`); reject an empty
body with `badRequest("PATCH body must specify at least one field")`, matching the
recipe PATCH behaviour.

### Batch view (GET single + list items)

Return the stored row **plus derived metrics** computed from
`@/lib/brewing/batch.ts`. `brewhouseEfficiency` needs the recipe's grain bill and
the batch volume, so the single-batch GET must load the parent recipe's
`fermentables`.

```jsonc
{
  "data": {
    "id": "…",
    "recipeId": "…",
    "brewDate": "2026-05-01T00:00:00.000Z",
    "measuredOg": 1.054,
    "measuredFg": 1.011,
    "volumeLiters": 19,
    "notes": "…",
    "derived": {
      "actualAbv": 5.64,          // null if OG or FG missing
      "apparentAttenuation": 79.6, // null if OG or FG missing
      "brewhouseEfficiency": 72.0  // null if OG or volume missing, or no grain bill
    }
  }
}
```

Rules for `derived` (guard nulls — don't call the calc fns with missing inputs):
- `actualAbv` / `apparentAttenuation`: require both `measuredOg` and `measuredFg`.
- `brewhouseEfficiency`: require `measuredOg` and `volumeLiters`; pass the parent
  recipe's `fermentables` (map each to `{ type, amountKg, potentialPpg }`,
  skipping liquid-only fermentables with no `amountKg`). `null` if unavailable.

Consider a small `presentBatch(batch, fermentables)` helper (new file
`src/lib/api/presentBatch.ts` or a function in `present.ts`) so the list and
single routes share the derivation. Keep it pure and unit-testable.

## Acceptance criteria

- [ ] All five endpoints implemented in the two new route files.
- [ ] `POST` returns `201` with the created batch (including `derived`); `404`
      when the recipe id doesn't exist.
- [ ] `GET .../batches` returns `{ data: Batch[] }` ordered by `brewDate` desc.
- [ ] `GET /api/batches/[id]` returns the batch with correct `derived` metrics;
      `404` when missing.
- [ ] `PATCH` updates only supplied fields; empty body → `400`; missing → `404`.
- [ ] `DELETE` returns `204`; missing → `404`.
- [ ] Invalid bodies return `validationError` (Zod) with the standard shape.
- [ ] `derived` values are `null` (not `0`, not thrown) when inputs are missing.

## Tests (required — match existing style)

Add `test/api/batch.test.ts` following `test/api/present.test.ts` and
`test/api/shoppingList.test.ts`. Cover:

- create → returns 201 + derived; unknown recipe → 404.
- list ordering (newest brewDate first).
- single GET derived math for a known fixture (e.g. OG 1.054 / FG 1.011 →
  `actualAbv ≈ 5.64`, `apparentAttenuation ≈ 79.6`).
- derived nulls when OG/FG/volume absent.
- PATCH partial update; empty-body 400; DELETE 204; not-found paths.
- If you add `presentBatch`, unit-test it directly too.

## Definition of done

- `npm test` green (new tests included).
- `npm run lint` clean.
- `npm run build` type-checks.
- No change to existing recipe routes or the `Batch` model/migration.
