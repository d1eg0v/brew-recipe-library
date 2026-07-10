"use client";

import Link from "next/link";

import CategoryBadge from "@/components/CategoryBadge";
import SrmSwatch from "@/components/SrmSwatch";
import {
  FlaskGlyph,
  GrainGlyph,
  HopGlyph,
  MashGlyph,
  YeastGlyph,
} from "@/components/icons";
import {
  categoryAccent,
  fermentableTypeLabel,
  fmtBatchSize,
  fmtGravity,
  fmtGrams,
  fmtKg,
  fmtLiters,
  fmtNumber,
  fmtPercent,
  fmtTemp,
  hopUseLabel,
  mashStepTypeLabel,
  srmToHex,
  titleCase,
} from "@/lib/ui/format";
import type {
  RecipeDetail,
  UnitSystem,
} from "@/lib/ui/types";

import ComparePicker from "./ComparePicker";

interface CompareClientProps {
  a: RecipeDetail;
  b: RecipeDetail;
  units: UnitSystem;
}

interface ColumnData {
  recipe: RecipeDetail;
  /** A short role label shown above the title. */
  slot: "A" | "B";
}

export default function CompareClient({ a, b, units }: CompareClientProps) {
  const cols: [ColumnData, ColumnData] = [
    { slot: "A", recipe: a },
    { slot: "B", recipe: b },
  ];

  return (
    <div className="space-y-8" data-testid="compare-view">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {cols.map((c) => (
          <RecipeHeader
            key={c.recipe.id}
            recipe={c.recipe}
            slot={c.slot}
            units={units}
          />
        ))}
      </div>

      <ComparePicker initialA={a.id} initialB={b.id} className="!gap-3" />

      <VitalsComparison cols={cols} />
      <FermentablesComparison cols={cols} units={units} />
      <HopsComparison cols={cols} units={units} />
      <YeastsComparison cols={cols} />
      <MashStepsComparison cols={cols} units={units} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Header (per-column)
// -----------------------------------------------------------------------------

function RecipeHeader({
  recipe,
  slot,
  units,
}: {
  recipe: RecipeDetail;
  slot: "A" | "B";
  units: UnitSystem;
}) {
  const accent = categoryAccent(recipe.category, recipe.targetSrm);
  const showSrm = recipe.category === "beer" && recipe.targetSrm != null;
  return (
    <article
      className="section relative overflow-hidden"
      data-testid={`compare-column-${slot.toLowerCase()}`}
      data-recipe-id={recipe.id}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ background: accent }}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
        <span>Column {slot}</span>
        <span aria-hidden>·</span>
        <CategoryBadge category={recipe.category} />
        {recipe.bjcpCategory && (
          <span className="font-mono">{recipe.bjcpCategory}</span>
        )}
      </div>
      <h2 className="font-display mt-2 text-2xl font-semibold leading-tight">
        <Link
          href={`/recipes/${recipe.id}`}
          className="text-[var(--foreground)] no-underline hover:underline"
        >
          {recipe.title}
        </Link>
      </h2>
      {recipe.styleName && (
        <p className="text-sm text-[var(--muted-foreground)]">
          {recipe.styleName}
        </p>
      )}
      {recipe.description && (
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)] line-clamp-3">
          {recipe.description}
        </p>
      )}
      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--border)] pt-3 text-sm">
        <HeaderStat
          label="Batch"
          value={fmtBatchSize(
            recipe.batchSizeLiters,
            recipe.batchSizeGallons ?? null,
            units,
          )}
        />
        <HeaderStat
          label="Boil"
          value={`${recipe.boilTimeMinutes} min`}
        />
        <HeaderStat
          label="Efficiency"
          value={fmtPercent(recipe.efficiencyPct, 0)}
        />
      </dl>
      {showSrm && recipe.targetSrm != null && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <SrmSwatch srm={recipe.targetSrm} size="sm" showLabel />
          <span>SRM {fmtNumber(recipe.targetSrm, 1)} · {srmToHex(recipe.targetSrm)}</span>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Link
          href={`/recipes/${recipe.id}`}
          className="btn btn-outline btn-sm no-underline"
        >
          Open recipe
        </Link>
        <Link
          href={`/recipes/${recipe.id}/edit`}
          className="btn btn-ghost btn-sm no-underline"
        >
          Edit
        </Link>
      </div>
    </article>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label-eyebrow">{label}</dt>
      <dd className="font-mono text-sm font-medium text-[var(--foreground)]">
        {value}
      </dd>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Vital measurements (two columns side-by-side)
// -----------------------------------------------------------------------------

function VitalsComparison({
  cols,
}: {
  cols: [ColumnData, ColumnData];
}) {
  // Choose which metrics to show based on the union of categories — beer
  // gets IBU/SRM, but if a mead is in one column we still show ABV/OG/FG.
  const includeIbu = cols.some(
    (c) => c.recipe.category === "beer" && c.recipe.targetIbu != null,
  );
  const includeSrm = cols.some(
    (c) => c.recipe.category === "beer" && c.recipe.targetSrm != null,
  );
  const rows: Array<{ label: string; render: (r: RecipeDetail) => string }> = [
    {
      label: "OG",
      render: (r) => (r.targetOg != null ? fmtGravity(r.targetOg) : "—"),
    },
    {
      label: "FG",
      render: (r) => (r.targetFg != null ? fmtGravity(r.targetFg) : "—"),
    },
    {
      label: "ABV",
      render: (r) => (r.targetAbv != null ? fmtPercent(r.targetAbv, 1) : "—"),
    },
    {
      label: "pH",
      render: (r) => (r.targetPh != null ? fmtNumber(r.targetPh, 2) : "—"),
    },
  ];
  if (includeIbu) {
    rows.push({
      label: "IBU",
      render: (r) => (r.targetIbu != null ? fmtNumber(r.targetIbu, 0) : "—"),
    });
  }
  if (includeSrm) {
    rows.push({
      label: "SRM",
      render: (r) => (r.targetSrm != null ? fmtNumber(r.targetSrm, 1) : "—"),
    });
  }

  return (
    <Section
      title="Vital measurements"
      icon={<FlaskGlyph className="h-5 w-5 text-[var(--accent)]" />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cols.map((c) => (
          <div
            key={c.recipe.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/40 p-4"
          >
            <ul className="space-y-1.5 text-sm">
              {rows.map((row) => (
                <li
                  key={row.label}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="label-eyebrow text-[var(--muted-foreground)]">
                    {row.label}
                  </span>
                  <span className="font-mono text-base font-medium text-[var(--foreground)]">
                    {row.render(c.recipe)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

// -----------------------------------------------------------------------------
// Ingredient tables — aligned row-by-row by normalised name, with
// placeholder rows in the shorter column so the eye can scan both columns
// in the same vertical order.
// -----------------------------------------------------------------------------

function FermentablesComparison({
  cols,
  units,
}: {
  cols: [ColumnData, ColumnData];
  units: UnitSystem;
}) {
  const aligned = alignRows(
    cols[0].recipe.fermentables,
    cols[1].recipe.fermentables,
    (f) => f.name,
  );
  return (
    <Section title="Fermentables" icon={<GrainGlyph className="h-5 w-5 text-[var(--accent)]" />}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {cols.map((c, idx) => (
          <div
            key={c.recipe.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden"
          >
            <div className="border-b border-[var(--border)] bg-[var(--surface-2)]/50 px-3 py-2 text-xs text-[var(--muted-foreground)]">
              {c.recipe.fermentables.length} item
              {c.recipe.fermentables.length === 1 ? "" : "s"}
            </div>
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Name</th>
                  <th className="text-left">Type</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {aligned.map(({ left, right }, i) => {
                  const f = idx === 0 ? left : right;
                  return (
                    <tr key={i} className={f ? "" : "opacity-50"}>
                      <td className="font-medium">{f?.name ?? "—"}</td>
                      <td>
                        {f?.type ? (
                          <Pill>{fermentableTypeLabel(f.type)}</Pill>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="num font-mono text-right">
                        {f
                          ? formatFermentableAmount(
                              f.amountKg,
                              f.amountLiters,
                              f.amountLbs ?? null,
                              f.amountGallons ?? null,
                              units,
                            )
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Section>
  );
}

function HopsComparison({
  cols,
  units,
}: {
  cols: [ColumnData, ColumnData];
  units: UnitSystem;
}) {
  const aligned = alignRows(
    cols[0].recipe.hops,
    cols[1].recipe.hops,
    (h) => `${h.name}|${h.use ?? ""}`,
  );
  return (
    <Section title="Hops" icon={<HopGlyph className="h-5 w-5 text-[var(--accent)]" />}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {cols.map((c, idx) => (
          <div
            key={c.recipe.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden"
          >
            <div className="border-b border-[var(--border)] bg-[var(--surface-2)]/50 px-3 py-2 text-xs text-[var(--muted-foreground)]">
              {c.recipe.hops.length} addition
              {c.recipe.hops.length === 1 ? "" : "s"}
            </div>
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Name</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Time</th>
                  <th className="text-left">Use</th>
                </tr>
              </thead>
              <tbody>
                {aligned.map(({ left, right }, i) => {
                  const h = idx === 0 ? left : right;
                  return (
                    <tr key={i} className={h ? "" : "opacity-50"}>
                      <td className="font-medium">{h?.name ?? "—"}</td>
                      <td className="num font-mono text-right">
                        {h ? fmtGrams(h.amountGrams, units) : "—"}
                      </td>
                      <td className="num font-mono text-right">
                        {h
                          ? `${h.timeMinutes} ${h.use === "dryHop" ? "d" : "min"}`
                          : "—"}
                      </td>
                      <td>{h ? <Pill>{hopUseLabel(h.use)}</Pill> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Section>
  );
}

function YeastsComparison({
  cols,
}: {
  cols: [ColumnData, ColumnData];
}) {
  const aligned = alignRows(
    cols[0].recipe.yeasts,
    cols[1].recipe.yeasts,
    (y) => y.name,
  );
  return (
    <Section title="Yeast" icon={<YeastGlyph className="h-5 w-5 text-[var(--accent)]" />}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {cols.map((c, idx) => (
          <div
            key={c.recipe.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden"
          >
            <div className="border-b border-[var(--border)] bg-[var(--surface-2)]/50 px-3 py-2 text-xs text-[var(--muted-foreground)]">
              {c.recipe.yeasts.length} pack
              {c.recipe.yeasts.length === 1 ? "" : "s"}
            </div>
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Name</th>
                  <th className="text-left">Type</th>
                  <th className="text-left">Form</th>
                  <th className="text-right">Attenuation</th>
                </tr>
              </thead>
              <tbody>
                {aligned.map(({ left, right }, i) => {
                  const y = idx === 0 ? left : right;
                  return (
                    <tr key={i} className={y ? "" : "opacity-50"}>
                      <td className="font-medium">{y?.name ?? "—"}</td>
                      <td>{y ? titleCase(y.type) : "—"}</td>
                      <td>{y ? titleCase(y.form) : "—"}</td>
                      <td className="num font-mono text-right">
                        {y?.attenuationPct != null
                          ? fmtPercent(y.attenuationPct, 0)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Section>
  );
}

function MashStepsComparison({
  cols,
  units,
}: {
  cols: [ColumnData, ColumnData];
  units: UnitSystem;
}) {
  const aligned = alignRows(
    cols[0].recipe.mashSteps,
    cols[1].recipe.mashSteps,
    (m) => `${m.name}|${m.type ?? ""}`,
  );
  if (
    cols[0].recipe.mashSteps.length === 0 &&
    cols[1].recipe.mashSteps.length === 0
  ) {
    return null;
  }
  return (
    <Section title="Mash steps" icon={<MashGlyph className="h-5 w-5 text-[var(--accent)]" />}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {cols.map((c, idx) => (
          <div
            key={c.recipe.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden"
          >
            <div className="border-b border-[var(--border)] bg-[var(--surface-2)]/50 px-3 py-2 text-xs text-[var(--muted-foreground)]">
              {c.recipe.mashSteps.length} step
              {c.recipe.mashSteps.length === 1 ? "" : "s"}
            </div>
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">#</th>
                  <th className="text-left">Name</th>
                  <th className="text-left">Type</th>
                  <th className="text-right">Temp</th>
                  <th className="text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {aligned.map(({ left, right }, i) => {
                  const m = idx === 0 ? left : right;
                  return (
                    <tr key={i} className={m ? "" : "opacity-50"}>
                      <td className="num text-[var(--muted-foreground)]">
                        {i + 1}
                      </td>
                      <td className="font-medium">{m?.name ?? "—"}</td>
                      <td>
                        {m?.type ? (
                          <Pill>{mashStepTypeLabel(m.type)}</Pill>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="num font-mono text-right">
                        {m
                          ? fmtTemp(
                              m.stepTempC,
                              m.stepTempF ?? null,
                              units,
                            )
                          : "—"}
                      </td>
                      <td className="num font-mono text-right">
                        {m?.stepTimeMinutes != null
                          ? `${m.stepTimeMinutes} min`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Section>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

interface AlignedRows<L, R> {
  left: L | null;
  right: R | null;
}

function alignRows<L, R>(
  left: L[],
  right: R[],
  keyOf: (row: L | R) => string,
): AlignedRows<L, R>[] {
  const norm = (s: string) => s.trim().toLowerCase();
  const leftByKey = new Map<string, { row: L; key: string }>();
  for (const row of left) {
    const key = norm(keyOf(row));
    if (!leftByKey.has(key)) leftByKey.set(key, { row, key });
  }
  const rightByKey = new Map<string, { row: R; key: string }>();
  for (const row of right) {
    const key = norm(keyOf(row));
    if (!rightByKey.has(key)) rightByKey.set(key, { row, key });
  }

  // Walk the longer list, preferring matched keys first.
  const matchedKeys: string[] = [];
  for (const key of leftByKey.keys()) {
    if (rightByKey.has(key)) matchedKeys.push(key);
  }
  for (const key of leftByKey.keys()) {
    if (!matchedKeys.includes(key)) matchedKeys.push(key);
  }
  for (const key of rightByKey.keys()) {
    if (!matchedKeys.includes(key)) matchedKeys.push(key);
  }

  const out: AlignedRows<L, R>[] = [];
  for (const key of matchedKeys) {
    out.push({
      left: leftByKey.get(key)?.row ?? null,
      right: rightByKey.get(key)?.row ?? null,
    });
  }
  return out;
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-title">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
      {children}
    </span>
  );
}

function formatFermentableAmount(
  kg: number | null,
  liters: number | null,
  lbs: number | null,
  gallons: number | null,
  units: UnitSystem,
): React.ReactNode {
  if (kg != null) {
    if (units === "imperial" && lbs != null) {
      return `${fmtNumber(lbs, 2)} lb`;
    }
    return fmtKg(kg, units);
  }
  if (liters != null) {
    if (units === "imperial" && gallons != null) {
      return `${fmtNumber(gallons, 2)} gal`;
    }
    return fmtLiters(liters, units);
  }
  return "—";
}
