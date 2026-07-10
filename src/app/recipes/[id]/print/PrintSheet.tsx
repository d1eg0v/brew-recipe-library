"use client";

// Client island for the print brew sheet.
//
// Provides the on-screen "Print" button and the metric/imperial unit toggle.
// The unit toggle re-fetches the recipe from the API (same pattern as the
// recipe detail page) so the printed quantities honour the chosen system.
// Both the toolbar and the toggle are hidden via CSS at print time.

import { useCallback, useState } from "react";

import {
  buildDetailUrl,
} from "@/lib/ui/api";
import {
  fmtGravity,
  fmtKg,
  fmtLiters,
  fmtNumber,
  fmtPercent,
  fmtTemp,
  fmtTempRange,
  fermentableTypeLabel,
  hopUseLabel,
  mashStepTypeLabel,
  processStepLabel,
  titleCase,
} from "@/lib/ui/format";
import {
  buildBrewDayChecklist,
  CHECKLIST_SECTION_TITLES,
  type ChecklistItem,
  type ChecklistSection,
} from "@/lib/brewing/checklist";
import type {
  RecipeDetail,
  RecipeDetailResponse,
  UnitSystem,
} from "@/lib/ui/types";

import styles from "./print.module.css";

interface PrintSheetProps {
  recipeId: string;
  initialRecipe: RecipeDetail;
  initialUnits: UnitSystem;
  initialBatchSize?: number;
}

export default function PrintSheet({
  recipeId,
  initialRecipe,
  initialUnits,
  initialBatchSize,
}: PrintSheetProps) {
  const [recipe, setRecipe] = useState<RecipeDetail>(initialRecipe);
  const [units, setUnits] = useState<UnitSystem>(initialUnits);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(
    async (next: UnitSystem) => {
      setLoading(true);
      setError(null);
      try {
        const url = buildDetailUrl("", recipeId, {
          batchSize: initialBatchSize,
          units: next,
        });
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`request failed: ${res.status}`);
        }
        const body = (await res.json()) as RecipeDetailResponse;
        setRecipe(body.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "failed to reload");
      } finally {
        setLoading(false);
      }
    },
    [recipeId, initialBatchSize],
  );

  function applyUnits(next: UnitSystem) {
    setUnits(next);
    if (next !== initialUnits) {
      refetch(next);
    }
  }

  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  const checklist = buildBrewDayChecklist(recipe, units);
  const grouped = groupBySection(checklist);

  return (
    <>
      <div className={`${styles.toolbar} ${styles.screenOnly}`}>
        <a href={`/recipes/${recipe.id}`} className={styles.toolbarBack}>
          ← Back to recipe
        </a>
        <div className={styles.toolbarActions}>
          {error && (
            <span style={{ color: "#7f1d1d", fontSize: 12 }}>{error}</span>
          )}
          {loading && (
            <span style={{ color: "#6b5d49", fontSize: 12 }}>updating…</span>
          )}
          <div
            className={styles.unitsToggle}
            role="group"
            aria-label="Display units"
          >
            <button
              type="button"
              className={`${styles.unitsBtn} ${
                units === "metric" ? styles.unitsBtnActive : ""
              }`}
              onClick={() => applyUnits("metric")}
              aria-pressed={units === "metric"}
            >
              Metric
            </button>
            <button
              type="button"
              className={`${styles.unitsBtn} ${
                units === "imperial" ? styles.unitsBtnActive : ""
              }`}
              onClick={() => applyUnits("imperial")}
              aria-pressed={units === "imperial"}
            >
              Imperial
            </button>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            className={styles.printBtn}
            data-testid="print-button"
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      <article>
        <Header recipe={recipe} />
        <Targets recipe={recipe} />
        <div className={styles.subgrid}>
          <Fermentables recipe={recipe} units={units} />
          <Hops recipe={recipe} units={units} />
        </div>
        <div className={styles.subgrid}>
          <Yeast recipe={recipe} units={units} />
          <MashSteps recipe={recipe} units={units} />
        </div>
        <div className={styles.subgrid}>
          <ProcessSteps recipe={recipe} />
          <Additions recipe={recipe} />
        </div>
        <Checklist groups={grouped} />
        <Notes recipe={recipe} />
        <PageFooter recipe={recipe} />
      </article>
    </>
  );
}

// ---------- subcomponents ----------

function Header({ recipe }: { recipe: RecipeDetail }) {
  return (
    <header>
      <div className={styles.header}>
        <h1 className={styles.title} data-testid="print-title">
          {recipe.title}
        </h1>
        <span className={styles.badge}>{titleCase(recipe.category)}</span>
        {recipe.styleName && (
          <span className={styles.styleLine}>
            {recipe.styleName}
            {recipe.bjcpCategory ? ` · ${recipe.bjcpCategory}` : ""}
          </span>
        )}
      </div>
      {recipe.author && (
        <p className={styles.author}>by {recipe.author}</p>
      )}
      {recipe.description && (
        <p className={styles.description}>{recipe.description}</p>
      )}
    </header>
  );
}

function Targets({ recipe }: { recipe: RecipeDetail }) {
  return (
    <section
      className={styles.targets}
      aria-label="Target measurements"
      data-testid="print-targets"
    >
      <Cell label="OG" value={fmt(recipe.targetOg, fmtGravity)} />
      <Cell label="FG" value={fmt(recipe.targetFg, fmtGravity)} />
      <Cell
        label="ABV"
        value={recipe.targetAbv != null ? fmtPercent(recipe.targetAbv, 1) : "—"}
      />
      {recipe.category === "beer" && (
        <>
          <Cell
            label="IBU"
            value={
              recipe.targetIbu != null ? fmtNumber(recipe.targetIbu, 0) : "—"
            }
          />
          <Cell
            label="SRM"
            value={
              recipe.targetSrm != null ? fmtNumber(recipe.targetSrm, 1) : "—"
            }
          />
        </>
      )}
      {recipe.category !== "beer" && (
        <>
          <Cell label="Style" value={recipe.styleName ?? "—"} small />
          <Cell
            label="Category"
            value={titleCase(recipe.category)}
            small
          />
        </>
      )}
    </section>
  );
}

function Cell({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className={styles.targetCell}>
      <div className={styles.targetLabel}>{label}</div>
      <div
        className={styles.targetValue}
        style={small ? { fontSize: 14 } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function Fermentables({
  recipe,
  units,
}: {
  recipe: RecipeDetail;
  units: UnitSystem;
}) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        Fermentables ({recipe.fermentables.length})
      </h2>
      {recipe.fermentables.length === 0 ? (
        <Empty>None listed.</Empty>
      ) : (
        <table className={styles.sheetTable}>
          <thead>
            <tr>
              <th className={styles.sheetTh}>Name</th>
              <th className={styles.sheetTh}>Type</th>
              <th className={styles.sheetTh} style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {recipe.fermentables.map((f) => (
              <tr key={f.id}>
                <td className={styles.sheetTd}>{f.name}</td>
                <td className={`${styles.sheetTd} ${styles.sheetTdMuted}`}>
                  {fermentableTypeLabel(f.type)}
                </td>
                <td className={`${styles.sheetTd} ${styles.sheetTdNum}`}>
                  {formatFermentableAmount(
                    f.amountKg,
                    f.amountLiters,
                    f.amountLbs ?? null,
                    f.amountGallons ?? null,
                    units,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Hops({
  recipe,
  units,
}: {
  recipe: RecipeDetail;
  units: UnitSystem;
}) {
  if (recipe.hops.length === 0) {
    return (
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Hops</h2>
        <Empty>None — this recipe isn&apos;t hopped.</Empty>
      </section>
    );
  }
  // Order: boil hops by descending time, then whirlpool, then dry hop, then other.
  const ranked = recipe.hops.slice().sort((a, b) => {
    const order = (use: string | null) =>
      use === "firstWort" || use === "boil"
        ? 0
        : use === "whirlpool"
          ? 1
          : use === "mash"
            ? 2
            : use === "dryHop"
              ? 3
              : 4;
    const oa = order(a.use);
    const ob = order(b.use);
    if (oa !== ob) return oa - ob;
    // Within boil group: longest time first (i.e. added first).
    if (oa === 0) return b.timeMinutes - a.timeMinutes;
    return a.timeMinutes - b.timeMinutes;
  });
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Hops ({recipe.hops.length})</h2>
      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th className={styles.sheetTh}>Name</th>
            <th className={styles.sheetTh}>Use</th>
            <th className={styles.sheetTh} style={{ textAlign: "right" }}>Amount</th>
            <th className={styles.sheetTh} style={{ textAlign: "right" }}>Time</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((h) => (
            <tr key={h.id}>
              <td className={styles.sheetTd}>{h.name}</td>
              <td className={`${styles.sheetTd} ${styles.sheetTdMuted}`}>
                {hopUseLabel(h.use)}
              </td>
              <td className={`${styles.sheetTd} ${styles.sheetTdNum}`}>
                {formatGrams(h.amountGrams, h.amountOz ?? null, units)}
              </td>
              <td className={`${styles.sheetTd} ${styles.sheetTdNum}`}>
                {h.timeMinutes}
                {h.use === "dryHop" ? " d" : " min"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Yeast({
  recipe,
  units,
}: {
  recipe: RecipeDetail;
  units: UnitSystem;
}) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Yeast ({recipe.yeasts.length})</h2>
      {recipe.yeasts.length === 0 ? (
        <Empty>None listed.</Empty>
      ) : (
        <table className={styles.sheetTable}>
          <thead>
            <tr>
              <th className={styles.sheetTh}>Name</th>
              <th className={styles.sheetTh}>Form</th>
              <th className={styles.sheetTh} style={{ textAlign: "right" }}>Atten.</th>
              <th className={styles.sheetTh} style={{ textAlign: "right" }}>Temp</th>
            </tr>
          </thead>
          <tbody>
            {recipe.yeasts.map((y) => (
              <tr key={y.id}>
                <td className={styles.sheetTd}>
                  {y.name}
                  {y.laboratory || y.productId ? (
                    <span className={styles.sheetTdMuted}>
                      {" "}
                      · {[y.laboratory, y.productId].filter(Boolean).join(" ")}
                    </span>
                  ) : null}
                </td>
                <td className={`${styles.sheetTd} ${styles.sheetTdMuted}`}>
                  {titleCase(y.form)}
                </td>
                <td className={`${styles.sheetTd} ${styles.sheetTdNum}`}>
                  {y.attenuationPct != null
                    ? fmtNumber(y.attenuationPct, 0) + "%"
                    : "—"}
                </td>
                <td className={`${styles.sheetTd} ${styles.sheetTdNum}`}>
                  {fmtTempRange(
                    y.temperatureCMin,
                    y.temperatureCMax,
                    units,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function MashSteps({
  recipe,
  units,
}: {
  recipe: RecipeDetail;
  units: UnitSystem;
}) {
  if (recipe.mashSteps.length === 0) {
    return (
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Mash steps</h2>
        <Empty>None — not a grain-based recipe.</Empty>
      </section>
    );
  }
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        Mash steps ({recipe.mashSteps.length})
      </h2>
      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th className={styles.sheetTh}>Name</th>
            <th className={styles.sheetTh}>Type</th>
            <th className={styles.sheetTh} style={{ textAlign: "right" }}>Temp</th>
            <th className={styles.sheetTh} style={{ textAlign: "right" }}>Time</th>
          </tr>
        </thead>
        <tbody>
          {recipe.mashSteps.map((m) => (
            <tr key={m.id}>
              <td className={styles.sheetTd}>{m.name}</td>
              <td className={`${styles.sheetTd} ${styles.sheetTdMuted}`}>
                {mashStepTypeLabel(m.type)}
              </td>
              <td className={`${styles.sheetTd} ${styles.sheetTdNum}`}>
                {fmtTemp(m.stepTempC, m.stepTempF ?? null, units)}
              </td>
              <td className={`${styles.sheetTd} ${styles.sheetTdNum}`}>
                {m.stepTimeMinutes != null ? `${m.stepTimeMinutes} min` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ProcessSteps({ recipe }: { recipe: RecipeDetail }) {
  if (recipe.processSteps.length === 0) {
    return (
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Fermentation</h2>
        <Empty>No process steps defined.</Empty>
      </section>
    );
  }
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        Fermentation ({recipe.processSteps.length})
      </h2>
      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th className={styles.sheetTh}>Step</th>
            <th className={styles.sheetTh}>Type</th>
            <th className={styles.sheetTh} style={{ textAlign: "right" }}>Days</th>
          </tr>
        </thead>
        <tbody>
          {recipe.processSteps.map((p) => (
            <tr key={p.id}>
              <td className={styles.sheetTd}>{p.name}</td>
              <td className={`${styles.sheetTd} ${styles.sheetTdMuted}`}>
                {processStepLabel(p.type)}
              </td>
              <td className={`${styles.sheetTd} ${styles.sheetTdNum}`}>
                {p.durationDays != null
                  ? fmtNumber(p.durationDays, 1) + " d"
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Additions({ recipe }: { recipe: RecipeDetail }) {
  if (recipe.additions.length === 0) {
    return (
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Additions</h2>
        <Empty>None listed.</Empty>
      </section>
    );
  }
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        Additions ({recipe.additions.length})
      </h2>
      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th className={styles.sheetTh}>Name</th>
            <th className={styles.sheetTh} style={{ textAlign: "right" }}>Amount</th>
            <th className={styles.sheetTh}>Timing</th>
          </tr>
        </thead>
        <tbody>
          {recipe.additions.map((a) => (
            <tr key={a.id}>
              <td className={styles.sheetTd}>{a.name}</td>
              <td className={`${styles.sheetTd} ${styles.sheetTdNum}`}>
                {a.amount != null
                  ? `${fmtNumber(a.amount, 2)} ${a.unit ?? ""}`.trim()
                  : "—"}
              </td>
              <td className={`${styles.sheetTd} ${styles.sheetTdMuted}`}>
                {a.timing ?? a.purpose ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Checklist({
  groups,
}: {
  groups: Map<ChecklistSection, ChecklistItem[]>;
}) {
  return (
    <section className={styles.section} data-testid="print-checklist">
      <h2 className={styles.sectionTitle}>Brew-day checklist</h2>
      <ul className={styles.checklist}>
        {Array.from(groups.entries()).map(([section, items]) => (
          <li key={section}>
            <div className={styles.checklistSubsection}>
              {CHECKLIST_SECTION_TITLES[section]}
            </div>
            <ul className={styles.checklist}>
              {items.map((it) => (
                <li key={it.id} className={styles.checklistItem}>
                  <span className={styles.checklistBox} aria-hidden />
                  <span>
                    <span className={styles.checklistLabel}>{it.label}</span>
                  </span>
                  <span className={styles.checklistDetail}>
                    {it.detail ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Notes({ recipe }: { recipe: RecipeDetail }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Brewer&apos;s notes</h2>
      {recipe.notes ? (
        <div className={styles.notesBox}>{recipe.notes}</div>
      ) : (
        <div
          className={`${styles.notesBox} ${styles.notesBoxEmpty}`}
          aria-hidden
        />
      )}
    </section>
  );
}

function PageFooter({ recipe }: { recipe: RecipeDetail }) {
  return (
    <footer className={styles.footer}>
      <span>
        Brew Recipe Library · brew sheet · {recipe.title}
      </span>
      <span>Printed {formatToday()}</span>
    </footer>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p
      className={styles.sheetTdMuted}
      style={{ fontSize: 12, margin: "4px 0 0 0" }}
    >
      {children}
    </p>
  );
}

function fmt(
  v: number | null | undefined,
  fn: (v: number) => string,
): string {
  return v != null && Number.isFinite(v) ? fn(v) : "—";
}

function formatToday(): string {
  if (typeof window === "undefined") return "";
  try {
    return new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function formatFermentableAmount(
  kg: number | null,
  liters: number | null,
  lbs: number | null,
  gallons: number | null,
  units: UnitSystem,
): string {
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

function formatGrams(
  grams: number,
  oz: number | null,
  units: UnitSystem,
): string {
  if (units === "imperial" && oz != null) {
    return `${fmtNumber(oz, 2)} oz`;
  }
  if (grams >= 1000) {
    return `${fmtNumber(grams / 1000, 2)} kg`;
  }
  return `${fmtNumber(grams, 0)} g`;
}

function groupBySection(
  items: ChecklistItem[],
): Map<ChecklistSection, ChecklistItem[]> {
  const order: ChecklistSection[] = [
    "prep",
    "mash",
    "boil",
    "hops",
    "whirlpool",
    "transfer",
    "pitch",
    "additions",
    "fermentation",
  ];
  const map = new Map<ChecklistSection, ChecklistItem[]>();
  for (const s of order) map.set(s, []);
  for (const it of items) {
    map.get(it.section)?.push(it);
  }
  // Drop empty sections so the printed list is compact.
  for (const [s, list] of map) {
    if (list.length === 0) map.delete(s);
  }
  return map;
}
