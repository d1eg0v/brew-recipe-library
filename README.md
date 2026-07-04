# Brew Recipe Library

A Next.js (App Router, TypeScript) web app for home brewers to browse, search,
and manage brewing recipes — grain bills, hop schedules, yeast, mash steps,
water chemistry notes, and target OG/FG/IBU/SRM/ABV.

## Stack

- **Next.js** (App Router) + **TypeScript** — API routes and frontend in one app
- **Prisma 7** ORM with a **SQLite** database (via the `better-sqlite3` driver adapter)
- **Tailwind CSS** for styling

## Getting started

```bash
npm install          # also runs `prisma generate` via postinstall
npm run db:migrate   # apply migrations to the local SQLite db (./dev.db)
npm run dev          # http://localhost:3000
```

`DATABASE_URL` lives in `.env` and defaults to `file:./dev.db` (local SQLite, no
secrets — committed so the app and Prisma CLI work out of the box).

### Useful scripts

| Script               | What it does                                       |
| -------------------- | -------------------------------------------------- |
| `npm run dev`        | Start the dev server                               |
| `npm run build`      | Production build (type-checks the whole app)       |
| `npm run db:migrate` | `prisma migrate dev`                               |
| `npm run db:push`    | `prisma db push` (sync schema without a migration) |
| `npm run db:studio`  | Open Prisma Studio                                 |

## Data model

The Prisma schema lives in [`prisma/schema.prisma`](prisma/schema.prisma). All
physical quantities are stored in **metric SI units** (kg, litres, grams,
Celsius); imperial conversion happens in app code, never in the DB. SQLite has no
enums, so categorical fields are `String` with allowed values documented inline.

- **Recipe** — title, author, description/notes, `styleName`, `bjcpCategory`,
  `batchSizeLiters`, `boilTimeMinutes`, `efficiencyPct`, and targets
  `targetOg`/`targetFg`/`targetAbv`/`targetIbu`/`targetSrm`.
- **Fermentable** — grain/extract/sugar/adjunct: `name`, `type`, `amountKg`,
  `colorLovibond`, `potentialPpg`.
- **Hop** — `name`, `amountGrams`, `alphaAcidPct`, `timeMinutes`, `use`
  (boil/firstWort/whirlpool/dryHop/mash), `form`.
- **Yeast** — `name`, `laboratory`, `productId`, `type`, `form`,
  `attenuationPct`, temperature range.
- **MashStep** — `name`, `type` (infusion/temperature/decoction), `stepTempC`,
  `stepTimeMinutes`, `infuseAmountLiters`, ordered by `position`.

Fermentables, Hops, Yeasts, and MashSteps each belong to a Recipe
(`onDelete: Cascade`) and carry a `position` field for stable ordering.

Access the DB through the shared client in
[`src/lib/db.ts`](src/lib/db.ts): `import { prisma } from "@/lib/db"`.
