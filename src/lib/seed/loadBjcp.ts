// Pure loader for the BJCP style-range seed file. Mirrors the recipe seed
// loader in shape so future schema additions stay localised.
//
// The seed file is a JSON array of records with the same shape as `BjcpStyle`
// minus server-managed fields (`id`, `createdAt`, `updatedAt`). Each record
// is normalised: trailing whitespace is trimmed from string fields, and any
// bound that fails `Number.isFinite` is coerced to `null` so the comparison
// layer can treat "no guideline" uniformly.

import { z } from "zod";

/** Loose schema for one row of `prisma/seed/bjcp.json`. The Prisma model
 *  is the source of truth; this schema is just a runtime safety net that
 *  catches malformed seed files before they hit the database. */
export const bjcpStyleSeedSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  ogMin: z.number().nullable().optional(),
  ogMax: z.number().nullable().optional(),
  fgMin: z.number().nullable().optional(),
  fgMax: z.number().nullable().optional(),
  ibuMin: z.number().nullable().optional(),
  ibuMax: z.number().nullable().optional(),
  srmMin: z.number().nullable().optional(),
  srmMax: z.number().nullable().optional(),
  abvMin: z.number().nullable().optional(),
  abvMax: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type BjcpStyleSeed = z.infer<typeof bjcpStyleSeedSchema>;

/** Normalised row ready for `prisma.bjcpStyle.upsert` or comparison use. */
export interface BjcpStyleRow {
  code: string;
  name: string;
  category: string;
  ogMin: number | null;
  ogMax: number | null;
  fgMin: number | null;
  fgMax: number | null;
  ibuMin: number | null;
  ibuMax: number | null;
  srmMin: number | null;
  srmMax: number | null;
  abvMin: number | null;
  abvMax: number | null;
  notes: string | null;
}

/** Sentinel returned by {@link loadBjcpStyles} on parse failure. */
export interface BjcpStyleLoadReport {
  loaded: number;
  inserted: number;
  deleted: number;
  source: string;
  errors: string[];
}

/** Coerce a loosely-typed JSON value into a finite number or null. */
function asNumberOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalise(raw: BjcpStyleSeed): BjcpStyleRow {
  return {
    code: raw.code.trim(),
    name: raw.name.trim(),
    category: raw.category.trim().toLowerCase(),
    ogMin: asNumberOrNull(raw.ogMin),
    ogMax: asNumberOrNull(raw.ogMax),
    fgMin: asNumberOrNull(raw.fgMin),
    fgMax: asNumberOrNull(raw.fgMax),
    ibuMin: asNumberOrNull(raw.ibuMin),
    ibuMax: asNumberOrNull(raw.ibuMax),
    srmMin: asNumberOrNull(raw.srmMin),
    srmMax: asNumberOrNull(raw.srmMax),
    abvMin: asNumberOrNull(raw.abvMin),
    abvMax: asNumberOrNull(raw.abvMax),
    notes: raw.notes ?? null,
  };
}

/** Parse + validate a parsed JSON array. Throws on schema errors so the
 *  caller can surface them up the chain. */
export function loadBjcpStyles(input: unknown): BjcpStyleRow[] {
  if (!Array.isArray(input)) {
    throw new Error("BJCP seed file must be a JSON array of style rows");
  }
  const rows: BjcpStyleRow[] = [];
  for (const [index, raw] of input.entries()) {
    const parsed = bjcpStyleSeedSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues
        .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
        .join("; ");
      throw new Error(`bjcp.json[${index}]: ${msg}`);
    }
    rows.push(normalise(parsed.data));
  }
  return rows;
}
