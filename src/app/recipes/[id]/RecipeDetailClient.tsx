"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import CategoryBadge from "@/components/CategoryBadge";
import { buildDetailUrl, buildShoppingListUrl } from "@/lib/ui/api";
import {
  fermentableTypeLabel,
  fmtBatchSize,
  fmtGravity,
  fmtGrams,
  fmtKg,
  fmtLiters,
  fmtNumber,
  fmtPercent,
  fmtTemp,
  fmtTempRange,
  hopUseLabel,
  mashStepTypeLabel,
  processStepLabel,
  titleCase,
} from "@/lib/ui/format";
import type {
  RecipeDetail,
  RecipeDetailResponse,
  ShoppingList,
  ShoppingListResponse,
  UnitSystem,
} from "@/lib/ui/types";

import ShoppingListSection from "./ShoppingListSection";

interface RecipeDetailClientProps {
  initialRecipe: RecipeDetail;
  initialUnits?: UnitSystem;
  initialBatchSize?: number;
  initialShoppingList?: ShoppingList;
}

export default function RecipeDetailClient({
  initialRecipe,
  initialUnits,
  initialBatchSize,
  initialShoppingList,
}: RecipeDetailClientProps) {
  const [recipe, setRecipe] = useState<RecipeDetail>(initialRecipe);
  const [units, setUnits] = useState<UnitSystem>(initialUnits ?? "metric");
  const [batchSize, setBatchSize] = useState<string>(
    String(initialBatchSize ?? initialRecipe.batchSizeLiters),
  );
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(
    initialShoppingList ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shoppingListError, setShoppingListError] = useState<string | null>(null);

  const fetchShoppingList = useCallback(
    async (newBatchSize: number, newUnits: UnitSystem): Promise<void> => {
      try {
        const url = buildShoppingListUrl("", recipe.id, {
          batchSize: newBatchSize,
          units: newUnits,
        });
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`shopping-list request failed: ${res.status}`);
        }
        const body = (await res.json()) as ShoppingListResponse;
        setShoppingList(body.data);
        setShoppingListError(null);
      } catch (err) {
        console.error("shopping-list refetch error", err);
        setShoppingListError(
          err instanceof Error ? err.message : "failed to reload shopping list",
        );
      }
    },
    [recipe.id],
  );

  const refetch = useCallback(
    async (newBatchSize: number, newUnits: UnitSystem) => {
      setLoading(true);
      setError(null);
      try {
        const url = buildDetailUrl("", recipe.id, {
          batchSize: newBatchSize,
          units: newUnits,
        });
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`request failed: ${res.status}`);
        }
        const body = (await res.json()) as RecipeDetailResponse;
        setRecipe(body.data);
        await fetchShoppingList(newBatchSize, newUnits);
      } catch (err) {
        console.error("refetch error", err);
        setError(err instanceof Error ? err.message : "failed to reload recipe");
      } finally {
        setLoading(false);
      }
    },
    [recipe.id, fetchShoppingList],
  );

  function applyUnits(next: UnitSystem) {
    setUnits(next);
    const parsed = Number.parseFloat(batchSize);
    if (Number.isFinite(parsed) && parsed > 0) {
      refetch(parsed, next);
    } else {
      setShoppingListError(null);
    }
  }

  function applyBatchSize(next: string) {
    setBatchSize(next);
    const parsed = Number.parseFloat(next);
    if (Number.isFinite(parsed) && parsed > 0) {
      refetch(parsed, units);
    } else {
      setShoppingListError(null);
    }
  }

  function resetBatchSize() {
    setBatchSize(String(initialRecipe.batchSizeLiters));
    refetch(initialRecipe.batchSizeLiters, units);
  }

  const originalBatchLiters = initialRecipe.batchSizeLiters;
  const currentBatch = Number.parseFloat(batchSize);
  const isScaled =
    Number.isFinite(currentBatch) &&
    Math.abs(currentBatch - originalBatchLiters) > 0.01;

  return (
    <div className="space-y-8">
      <Header recipe={recipe} />

      {error && (
        <div className="p-3 rounded-md border border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-fg)] text-sm">
          Couldn&apos;t reload recipe: {error}
        </div>
      )}

      <Controls
        batchSize={batchSize}
        onBatchSizeChange={applyBatchSize}
        onResetBatchSize={resetBatchSize}
        units={units}
        onUnitsChange={applyUnits}
        loading={loading}
        isScaled={isScaled}
        originalBatchLiters={originalBatchLiters}
        currentBatchLiters={Number.isFinite(currentBatch) ? currentBatch : null}
        recipe={recipe}
      />

      <Targets recipe={recipe} />

      <Fermentables recipe={recipe} units={units} />
      <Hops recipe={recipe} units={units} />
      <Yeasts recipe={recipe} units={units} />
      {recipe.mashSteps.length > 0 && (
        <MashSteps recipe={recipe} units={units} />
      )}
      {recipe.processSteps.length > 0 && (
        <ProcessSteps recipe={recipe} units={units} />
      )}
      {recipe.additions.length > 0 && <Additions recipe={recipe} />}

      <ShoppingListSection
        shoppingList={shoppingList}
        units={units}
        error={shoppingListError}
        recipeTitle={recipe.title}
      />

      {recipe.notes && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="text-lg font-semibold mb-2">Brewer&apos;s notes</h2>
          <p className="text-sm whitespace-pre-line text-[var(--foreground)]">
            {recipe.notes}
          </p>
        </section>
      )}
    </div>
  );
}

function Header({ recipe }: { recipe: RecipeDetail }) {
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{recipe.title}</h1>
        <CategoryBadge category={recipe.category} />
        {recipe.styleName && (
          <span className="text-[var(--muted-foreground)]">
            {recipe.styleName}
            {recipe.bjcpCategory ? ` · ${recipe.bjcpCategory}` : ""}
          </span>
        )}
        <Link
          href={`/recipes/${recipe.id}/edit`}
          className="ml-auto px-3 py-1.5 rounded-md border border-[var(--border)] text-sm hover:bg-[var(--muted)] no-underline"
        >
          Edit
        </Link>
      </div>
      {recipe.author && (
        <p className="text-sm text-[var(--muted-foreground)]">
          by {recipe.author}
        </p>
      )}
      {recipe.description && (
        <p className="text-base leading-relaxed">{recipe.description}</p>
      )}
    </header>
  );
}

function Controls({
  batchSize,
  onBatchSizeChange,
  onResetBatchSize,
  units,
  onUnitsChange,
  loading,
  isScaled,
  originalBatchLiters,
  currentBatchLiters,
  recipe,
}: {
  batchSize: string;
  onBatchSizeChange: (s: string) => void;
  onResetBatchSize: () => void;
  units: UnitSystem;
  onUnitsChange: (u: UnitSystem) => void;
  loading: boolean;
  isScaled: boolean;
  originalBatchLiters: number;
  currentBatchLiters: number | null;
  recipe: RecipeDetail;
}) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
      <h2 className="text-base font-semibold">Scale &amp; units</h2>
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4 items-end">
        <div className="space-y-2">
          <label
            htmlFor="batch-size"
            className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] block"
          >
            Target batch size (litres)
          </label>
          <div className="flex gap-2 items-center">
            <input
              id="batch-size"
              type="number"
              min="0.1"
              step="0.1"
              value={batchSize}
              onChange={(e) => onBatchSizeChange(e.target.value)}
              className="flex-1 border border-[var(--border)] rounded-md px-3 py-2 bg-[var(--background)] text-[var(--foreground)] font-mono"
            />
            {isScaled && (
              <button
                type="button"
                onClick={onResetBatchSize}
                className="px-3 py-2 rounded-md border border-[var(--border)] text-sm hover:bg-[var(--muted)]"
              >
                Reset to original ({fmtNumber(originalBatchLiters, 1)} L)
              </button>
            )}
          </div>
          {isScaled && currentBatchLiters != null && (
            <p className="text-xs text-[var(--muted-foreground)]">
              Showing scaled values for{" "}
              <span className="font-mono">{fmtNumber(currentBatchLiters, 2)} L</span>{" "}
              (original{" "}
              <span className="font-mono">{fmtNumber(originalBatchLiters, 2)} L</span>).
              Targets unchanged.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] block">
            Units
          </span>
          <div className="inline-flex rounded-md border border-[var(--border)] overflow-hidden">
            <button
              type="button"
              onClick={() => onUnitsChange("metric")}
              className={`px-3 py-2 text-sm ${
                units === "metric"
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--muted)]"
              }`}
              aria-pressed={units === "metric"}
            >
              Metric
            </button>
            <button
              type="button"
              onClick={() => onUnitsChange("imperial")}
              className={`px-3 py-2 text-sm border-l border-[var(--border)] ${
                units === "imperial"
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--muted)]"
              }`}
              aria-pressed={units === "imperial"}
            >
              Imperial
            </button>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            Batch:{" "}
            <span className="font-mono">
              {fmtBatchSize(
                recipe.batchSizeLiters,
                recipe.batchSizeGallons ?? null,
                units,
              )}
            </span>{" "}
            · Boil:{" "}
            <span className="font-mono">{recipe.boilTimeMinutes} min</span>
            {loading && <span className="ml-2 italic">updating…</span>}
          </p>
        </div>
      </div>
    </section>
  );
}

function Targets({ recipe }: { recipe: RecipeDetail }) {
  const cells: Array<{ label: string; value: string }> = [];
  cells.push({
    label: "OG",
    value: recipe.targetOg != null ? fmtGravity(recipe.targetOg) : "—",
  });
  cells.push({
    label: "FG",
    value: recipe.targetFg != null ? fmtGravity(recipe.targetFg) : "—",
  });
  cells.push({
    label: "ABV",
    value: recipe.targetAbv != null ? fmtPercent(recipe.targetAbv, 1) : "—",
  });
  if (recipe.category === "beer") {
    cells.push({
      label: "IBU",
      value: recipe.targetIbu != null ? fmtNumber(recipe.targetIbu, 0) : "—",
    });
    cells.push({
      label: "SRM",
      value: recipe.targetSrm != null ? fmtNumber(recipe.targetSrm, 1) : "—",
    });
  }
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
      <h2 className="text-base font-semibold mb-3">Target measurements</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {cells.map((c) => (
          <div key={c.label} className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
              {c.label}
            </div>
            <div className="text-2xl font-mono">{c.value}</div>
          </div>
        ))}
      </div>
    </section>
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
    <Section title="Fermentables" count={recipe.fermentables.length}>
      {recipe.fermentables.length === 0 ? (
        <Empty>None listed.</Empty>
      ) : (
        <Table headers={["Name", "Type", "Amount", "Notes"]}>
          {recipe.fermentables.map((f) => (
            <tr key={f.id} className="border-t border-[var(--border)] align-top">
              <td className="py-2 pr-4">{f.name}</td>
              <td className="py-2 pr-4">
                <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  {fermentableTypeLabel(f.type)}
                </span>
              </td>
              <td className="py-2 pr-4">
                {formatFermentableAmount(
                  f.amountKg,
                  f.amountLiters,
                  f.amountLbs ?? null,
                  f.amountGallons ?? null,
                  units,
                )}
              </td>
              <td className="py-2 pr-4">
                <NotesText text={f.notes} />
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  );
}

function Hops({
  recipe,
  units,
}: {
  recipe: RecipeDetail;
  units: UnitSystem;
}) {
  return (
    <Section title="Hops" count={recipe.hops.length}>
      {recipe.hops.length === 0 ? (
        <Empty>None — this recipe isn&apos;t hopped.</Empty>
      ) : (
        <Table headers={["Name", "Amount", "Time", "Use", "Form", "α-acid", "Notes"]}>
          {recipe.hops.map((h) => (
            <tr key={h.id} className="border-t border-[var(--border)] align-top">
              <td className="py-2 pr-4">{h.name}</td>
              <td className="py-2 pr-4 font-mono">{fmtGrams(h.amountGrams, units)}</td>
              <td className="py-2 pr-4 font-mono">
                {h.timeMinutes} {h.use === "dryHop" ? "d" : "min"}
              </td>
              <td className="py-2 pr-4">{hopUseLabel(h.use)}</td>
              <td className="py-2 pr-4">{titleCase(h.form)}</td>
              <td className="py-2 pr-4 font-mono">
                {h.alphaAcidPct != null ? `${fmtNumber(h.alphaAcidPct, 1)}%` : "—"}
              </td>
              <td className="py-2 pr-4">
                <NotesText text={h.notes} />
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  );
}

function Yeasts({
  recipe,
  units,
}: {
  recipe: RecipeDetail;
  units: UnitSystem;
}) {
  return (
    <Section title="Yeast" count={recipe.yeasts.length}>
      {recipe.yeasts.length === 0 ? (
        <Empty>None listed.</Empty>
      ) : (
        <Table headers={["Name", "Lab / code", "Type", "Form", "Attenuation", "Temperature", "Notes"]}>
          {recipe.yeasts.map((y) => (
            <tr key={y.id} className="border-t border-[var(--border)] align-top">
              <td className="py-2 pr-4">{y.name}</td>
              <td className="py-2 pr-4">
                {[y.laboratory, y.productId].filter(Boolean).join(" · ") || "—"}
              </td>
              <td className="py-2 pr-4">{titleCase(y.type)}</td>
              <td className="py-2 pr-4">{titleCase(y.form)}</td>
              <td className="py-2 pr-4 font-mono">
                {y.attenuationPct != null ? fmtPercent(y.attenuationPct, 0) : "—"}
              </td>
              <td className="py-2 pr-4 font-mono">
                {fmtTempRange(y.temperatureCMin, y.temperatureCMax, units)}
              </td>
              <td className="py-2 pr-4">
                <NotesText text={y.notes} />
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  );
}

function MashSteps({
  recipe,
  units,
}: {
  recipe: RecipeDetail;
  units: UnitSystem;
}) {
  return (
    <Section title="Mash steps" count={recipe.mashSteps.length}>
      <Table headers={["Name", "Type", "Temperature", "Time", "Infuse", "Notes"]}>
        {recipe.mashSteps.map((m) => (
          <tr key={m.id} className="border-t border-[var(--border)] align-top">
            <td className="py-2 pr-4">{m.name}</td>
            <td className="py-2 pr-4">
              <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                {mashStepTypeLabel(m.type)}
              </span>
            </td>
            <td className="py-2 pr-4 font-mono">
              {fmtTemp(m.stepTempC, m.stepTempF ?? null, units)}
            </td>
            <td className="py-2 pr-4 font-mono">
              {m.stepTimeMinutes != null ? `${m.stepTimeMinutes} min` : "—"}
            </td>
            <td className="py-2 pr-4 font-mono">
              {m.infuseAmountLiters != null
                ? fmtLiters(m.infuseAmountLiters, units)
                : "—"}
            </td>
            <td className="py-2 pr-4">
              <NotesText text={m.notes} />
            </td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}

function ProcessSteps({
  recipe,
  units,
}: {
  recipe: RecipeDetail;
  units: UnitSystem;
}) {
  return (
    <Section title="Process steps" count={recipe.processSteps.length}>
      <Table headers={["Name", "Type", "Temperature", "Duration", "Notes"]}>
        {recipe.processSteps.map((p) => (
          <tr key={p.id} className="border-t border-[var(--border)] align-top">
            <td className="py-2 pr-4">{p.name}</td>
            <td className="py-2 pr-4">
              <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                {processStepLabel(p.type)}
              </span>
            </td>
            <td className="py-2 pr-4 font-mono">
              {fmtTemp(p.tempC, p.tempF ?? null, units)}
            </td>
            <td className="py-2 pr-4 font-mono">
              {p.durationDays != null ? `${fmtNumber(p.durationDays, 1)} d` : "—"}
            </td>
            <td className="py-2 pr-4">
              <NotesText text={p.notes} />
            </td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}

function Additions({ recipe }: { recipe: RecipeDetail }) {
  return (
    <Section title="Additions" count={recipe.additions.length}>
      <Table headers={["Name", "Amount", "Purpose", "Timing", "Notes"]}>
        {recipe.additions.map((a) => (
          <tr key={a.id} className="border-t border-[var(--border)] align-top">
            <td className="py-2 pr-4">{a.name}</td>
            <td className="py-2 pr-4 font-mono">
              {a.amount != null ? `${fmtNumber(a.amount, 2)} ${a.unit ?? ""}` : "—"}
            </td>
            <td className="py-2 pr-4">{a.purpose ?? "—"}</td>
            <td className="py-2 pr-4">{a.timing ?? "—"}</td>
            <td className="py-2 pr-4">
              <NotesText text={a.notes} />
            </td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}

// ---------- helpers ----------

function formatFermentableAmount(
  kg: number | null,
  liters: number | null,
  lbs: number | null,
  gallons: number | null,
  units: UnitSystem,
): React.ReactNode {
  if (kg != null) {
    if (units === "imperial" && lbs != null) {
      return <span className="font-mono">{fmtNumber(lbs, 2)} lb</span>;
    }
    return <span className="font-mono">{fmtKg(kg, units)}</span>;
  }
  if (liters != null) {
    if (units === "imperial" && gallons != null) {
      return <span className="font-mono">{fmtNumber(gallons, 2)} gal</span>;
    }
    return <span className="font-mono">{fmtLiters(liters, units)}</span>;
  }
  return "—";
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
      <h2 className="text-base font-semibold mb-3">
        {title}{" "}
        <span className="text-sm font-normal text-[var(--muted-foreground)]">
          ({count})
        </span>
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--muted-foreground)]">{children}</p>;
}

function Table({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="pb-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium text-left"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function NotesText({ text }: { text: string | null }) {
  if (!text) {
    return <span className="text-[var(--muted-foreground)]">—</span>;
  }
  return (
    <span className="text-[var(--muted-foreground)] text-sm">{text}</span>
  );
}