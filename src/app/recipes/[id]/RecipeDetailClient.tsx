"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import CategoryBadge from "@/components/CategoryBadge";
import TagEditor from "@/components/recipe/TagEditor";
import {
  ArrowGlyph,
  CategoryGlyph,
  FlaskGlyph,
  GrainGlyph,
  HopGlyph,
  MashGlyph,
  NoteGlyph,
  PencilGlyph,
  ScaleGlyph,
  YeastGlyph,
} from "@/components/icons";
import { litersToGallons } from "@/lib/brewing/units";
import {
  buildDetailUrl,
  buildRecipeBatchesUrl,
  buildShoppingListUrl,
} from "@/lib/ui/api";
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
  fmtTempRange,
  hopUseLabel,
  inkOn,
  mashStepTypeLabel,
  processStepLabel,
  srmToHex,
  titleCase,
} from "@/lib/ui/format";
import type {
  BatchListResponse,
  BatchSummary,
  RecipeDetail,
  RecipeDetailResponse,
  ShoppingList,
  ShoppingListCrossReference,
  ShoppingListResponseWithInventory,
  UnitSystem,
} from "@/lib/ui/types";
import {
  STORAGE_KEY,
  UNITS_CHANGE_EVENT,
  isUnitSystem,
} from "@/lib/units/units";

import BatchHistorySection from "./BatchHistorySection";
import RecipeActions from "./RecipeActions";
import ShoppingListSection from "./ShoppingListSection";

interface RecipeDetailClientProps {
  initialRecipe: RecipeDetail;
  initialUnits?: UnitSystem;
  initialBatchSize?: number;
  initialShoppingList?: ShoppingList;
  initialCrossReference?: ShoppingListCrossReference | null;
  initialBatches?: BatchSummary[];
  initialBatchesError?: string | null;
}

export default function RecipeDetailClient({
  initialRecipe,
  initialUnits,
  initialBatchSize,
  initialShoppingList,
  initialCrossReference,
  initialBatches,
  initialBatchesError,
}: RecipeDetailClientProps) {
  const [recipe, setRecipe] = useState<RecipeDetail>(initialRecipe);
  const [units, setUnits] = useState<UnitSystem>(initialUnits ?? "metric");
  const [batchSize, setBatchSize] = useState<string>(
    String(initialBatchSize ?? initialRecipe.batchSizeLiters),
  );
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(
    initialShoppingList ?? null,
  );
  const [crossReference, setCrossReference] = useState<ShoppingListCrossReference | null>(
    initialCrossReference ?? null,
  );
  const [batches, setBatches] = useState<BatchSummary[]>(
    initialBatches ?? [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shoppingListError, setShoppingListError] = useState<string | null>(null);
  const [batchesError, setBatchesError] = useState<string | null>(
    initialBatchesError ?? null,
  );
  // Mirror the latest `units` so the UNITS_CHANGE_EVENT listener — which is
  // bound once at mount with an empty dep array — can compare against the
  // current value without re-binding on every state change.
  const unitsRef = useRef<UnitSystem>(units);

  const fetchShoppingList = useCallback(
    async (newBatchSize: number, newUnits: UnitSystem): Promise<void> => {
      try {
        // BRE-40: ask the route for the cross-reference so the UI can show
        // what the brewer still needs to buy.
        const baseUrl = buildShoppingListUrl("", recipe.id, {
          batchSize: newBatchSize,
          units: newUnits,
        });
        const url = new URL(baseUrl, "http://localhost");
        url.searchParams.set("includeInventory", "true");
        const res = await fetch(url.pathname + (url.search || ""), {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`shopping-list request failed: ${res.status}`);
        }
        const body = (await res.json()) as ShoppingListResponseWithInventory;
        setShoppingList(body.data);
        setCrossReference(body.data?.crossReference ?? null);
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

  const fetchBatches = useCallback(async (): Promise<void> => {
    try {
      const url = buildRecipeBatchesUrl("", recipe.id);
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`batches request failed: ${res.status}`);
      }
      const body = (await res.json()) as BatchListResponse;
      setBatches(body.data ?? []);
      setBatchesError(null);
    } catch (err) {
      console.error("batches refetch error", err);
      setBatchesError(
        err instanceof Error ? err.message : "failed to reload batches",
      );
    }
  }, [recipe.id]);

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
        await fetchBatches();
      } catch (err) {
        console.error("refetch error", err);
        setError(err instanceof Error ? err.message : "failed to reload recipe");
      } finally {
        setLoading(false);
      }
    },
    [recipe.id, fetchShoppingList, fetchBatches],
  );

  const applyUnits = useCallback(
    (next: UnitSystem) => {
      if (next === unitsRef.current) return;
      unitsRef.current = next;
      setUnits(next);
      // Keep the global state in lockstep with the in-page toggle: update
      // `data-units` on <html>, persist to localStorage, and notify other
      // consumers (e.g. <UnitToggle /> on the header) so the segmented
      // control re-renders to match. We skip this when next already matches
      // the applied attribute to avoid a redundant write loop when
      // `syncFromDocument` fires.
      if (
        typeof document !== "undefined" &&
        document.documentElement.getAttribute("data-units") !== next
      ) {
        document.documentElement.setAttribute("data-units", next);
        try {
          window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // Ignore storage failures (private mode / quota).
        }
        window.dispatchEvent(
          new CustomEvent(UNITS_CHANGE_EVENT, { detail: next }),
        );
      }
      const parsed = Number.parseFloat(batchSize);
      if (Number.isFinite(parsed) && parsed > 0) {
        void refetch(parsed, next);
      } else {
        setShoppingListError(null);
      }
    },
    [batchSize, refetch],
  );

  // React to the global header toggle. The boot script sets `data-units`
  // before paint, so on mount we may need to align local `units` with the
  // stored preference (when the URL didn't pin a value). After mount, listen
  // for UNITS_CHANGE_EVENT fired by <UnitToggle /> so a header click
  // re-fetches this recipe in the new unit system.
  useEffect(() => {
    function syncFromDocument() {
      const attr = document.documentElement.getAttribute("data-units");
      const next: UnitSystem = isUnitSystem(attr) ? attr : "metric";
      applyUnits(next);
    }
    syncFromDocument();
    window.addEventListener(UNITS_CHANGE_EVENT, syncFromDocument);
    return () => {
      window.removeEventListener(UNITS_CHANGE_EVENT, syncFromDocument);
    };
  }, [applyUnits]);

  const applyBatchSize = useCallback(
    (next: string) => {
      setBatchSize(next);
      const parsed = Number.parseFloat(next);
      if (Number.isFinite(parsed) && parsed > 0) {
        void refetch(parsed, unitsRef.current);
      } else {
        setShoppingListError(null);
      }
    },
    [refetch],
  );

  const resetBatchSize = useCallback(() => {
    setBatchSize(String(initialRecipe.batchSizeLiters));
    void refetch(initialRecipe.batchSizeLiters, unitsRef.current);
  }, [initialRecipe.batchSizeLiters, refetch]);

  const originalBatchLiters = initialRecipe.batchSizeLiters;
  const currentBatch = Number.parseFloat(batchSize);
  const isScaled =
    Number.isFinite(currentBatch) &&
    Math.abs(currentBatch - originalBatchLiters) > 0.01;

  return (
    <div>
      <Header recipe={recipe} />

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-fg)]"
        >
          Couldn&apos;t reload recipe: {error}
        </div>
      )}

      <div className="mt-8 space-y-6">
        <RecipeActions recipeId={recipe.id} recipeTitle={recipe.title} />
        <TagsSection recipe={recipe} />

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

        <BatchHistorySection
          recipeId={recipe.id}
          batches={batches}
          units={units}
          error={batchesError}
        />

        <ShoppingListSection
          shoppingList={shoppingList}
          units={units}
          error={shoppingListError}
          recipeTitle={recipe.title}
          crossReference={crossReference}
        />

        {recipe.notes && (
          <section className="section">
            <div className="section-title">
              <NoteGlyph className="h-5 w-5 text-[var(--accent)]" />
              Brewer&apos;s notes
            </div>
            <p className="max-w-prose whitespace-pre-line text-[0.95rem] leading-relaxed text-[var(--foreground)]">
              {recipe.notes}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function TagsSection({ recipe }: { recipe: RecipeDetail }) {
  const tags = recipe.tags ?? [];
  return (
    <section className="section" aria-labelledby="tags-heading">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="tags-heading" className="section-title mb-0">
          Tags
          <span className="count">{tags.length}</span>
        </h2>
        {tags.length > 0 && (
          <p className="text-xs text-[var(--muted-foreground)]">
            Click a tag to filter the library
          </p>
        )}
      </div>
      <TagEditor recipeId={recipe.id} initialTags={tags} />
    </section>
  );
}

function Header({ recipe }: { recipe: RecipeDetail }) {
  const accent = categoryAccent(recipe.category, recipe.targetSrm);
  const srmHex = srmToHex(recipe.category === "beer" ? recipe.targetSrm : null);
  const srmInk = inkOn(srmHex);
  return (
    <header
      className="relative overflow-hidden border-b border-[var(--border)]"
      style={{ background: "var(--surface-2)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(720px 320px at 6% -30%, color-mix(in srgb, ${accent} 22%, transparent), transparent 70%)`,
        }}
      />
      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <nav className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--muted-foreground)] no-underline hover:text-[var(--foreground)]"
            >
              <ArrowGlyph className="h-3.5 w-3.5 rotate-180" />
              All recipes
            </Link>
            <Link
              href={`/recipes/${recipe.id}/print`}
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--muted-foreground)] no-underline hover:text-[var(--foreground)]"
              data-testid="print-sheet-link"
            >
              Print brew sheet
              <ArrowGlyph className="h-3.5 w-3.5" />
            </Link>
          </div>
        </nav>

        <div className="flex flex-wrap items-center gap-4">
          <span
            aria-hidden
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl shadow-sm"
            style={{
              background: `color-mix(in srgb, ${accent} 18%, var(--card))`,
              color: accent,
            }}
          >
            <CategoryGlyph category={recipe.category} className="h-8 w-8" />
          </span>

          {/* Beer colour swatch */}
          {recipe.category === "beer" && recipe.targetSrm != null && (
            <span
              className="hidden sm:grid h-14 w-10 shrink-0 place-items-end rounded-md border border-[var(--border-strong)] shadow-inner"
              style={{ background: srmHex }}
              title={`SRM ${fmtNumber(recipe.targetSrm, 1)}`}
            >
              <span
                className="w-full rounded-b-md py-0.5 text-center font-mono text-[0.6rem] font-semibold"
                style={{ color: srmInk, background: "color-mix(in srgb, #000 8%, transparent)" }}
              >
                {fmtNumber(recipe.targetSrm, 0)}
              </span>
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <CategoryBadge category={recipe.category} withIcon />
              {recipe.styleName && (
                <span className="text-sm text-[var(--muted-foreground)]">
                  {recipe.styleName}
                  {recipe.bjcpCategory ? (
                    <span className="font-mono ml-1.5 text-[var(--border-strong)]">
                      · {recipe.bjcpCategory}
                    </span>
                  ) : null}
                </span>
              )}
            </div>
            <h1 className="font-display mt-1.5 text-4xl sm:text-5xl font-semibold leading-tight tracking-tight text-[var(--foreground)]">
              {recipe.title}
            </h1>
            {recipe.author && (
              <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
                by <span className="font-medium text-[var(--foreground)]">{recipe.author}</span>
              </p>
            )}
          </div>

          <div className="ml-auto flex gap-2">
            <Link
              href={`/recipes/compare?a=${recipe.id}`}
              className="btn btn-ghost no-underline"
              data-testid="compare-link"
            >
              Compare with…
            </Link>
            <Link
              href={`/recipes/${recipe.id}/edit`}
              className="btn btn-outline no-underline"
            >
              <PencilGlyph className="h-4 w-4" />
              Edit
            </Link>
          </div>
        </div>

        {recipe.description && (
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-[var(--foreground)]/90">
            {recipe.description}
          </p>
        )}
      </div>
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
    <section className="section">
      <div className="section-title">
        <ScaleGlyph className="h-5 w-5 text-[var(--accent)]" />
        Scale &amp; units
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[2fr_1fr] md:items-end">
        <div>
          <label htmlFor="batch-size" className="label-eyebrow block mb-1.5">
            Target batch size ({units === "imperial" ? "gallons" : "litres"})
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="batch-size"
              type="number"
              min="0.1"
              step="0.1"
              value={batchSize}
              onChange={(e) => onBatchSizeChange(e.target.value)}
              className="field field-mono flex-1 min-w-[8rem]"
            />
            {isScaled && (
              <button
                type="button"
                onClick={onResetBatchSize}
                className="btn btn-outline btn-sm"
              >
                Reset ·{" "}
                {fmtBatchSize(
                  originalBatchLiters,
                  recipe.batchSizeGallons ?? null,
                  units,
                )}
              </button>
            )}
          </div>
          {isScaled && currentBatchLiters != null && (
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              Scaled to{" "}
              <span className="font-mono text-[var(--foreground)]">
                {fmtBatchSize(
                  currentBatchLiters,
                  litersToGallons(currentBatchLiters),
                  units,
                )}
              </span>{" "}
              (from{" "}
              <span className="font-mono">
                {fmtBatchSize(
                  originalBatchLiters,
                  recipe.batchSizeGallons ?? null,
                  units,
                )}
              </span>
              ). Targets are not rescaled.
            </p>
          )}
        </div>
        <div className="md:justify-self-end">
          <span className="label-eyebrow block mb-1.5">Units</span>
          <div
            className="inline-flex rounded-lg border border-[var(--border-strong)] bg-[var(--background)] p-0.5"
            role="group"
            aria-label="Unit system"
          >
            <UnitButton
              active={units === "metric"}
              onClick={() => onUnitsChange("metric")}
            >
              Metric
            </UnitButton>
            <UnitButton
              active={units === "imperial"}
              onClick={() => onUnitsChange("imperial")}
            >
              Imperial
            </UnitButton>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted-foreground)]">
        <span>
          Batch{" "}
          <span className="font-mono text-[var(--foreground)]">
            {fmtBatchSize(
              recipe.batchSizeLiters,
              recipe.batchSizeGallons ?? null,
              units,
            )}
          </span>
        </span>
        <span>
          Boil{" "}
          <span className="font-mono text-[var(--foreground)]">
            {recipe.boilTimeMinutes} min
          </span>
        </span>
        <span>
          Efficiency{" "}
          <span className="font-mono text-[var(--foreground)]">
            {fmtNumber(recipe.efficiencyPct, 0)}%
          </span>
        </span>
        <Link
          href={`/priming-sugar?recipeId=${recipe.id}&units=${units}`}
          className="text-[var(--accent)] underline"
          data-testid="priming-sugar-link"
        >
          Calculate priming sugar →
        </Link>
        <Link
          href={`/abv?recipeId=${recipe.id}`}
          className="text-[var(--accent)] underline"
          data-testid="abv-link"
        >
          Calculate ABV →
        </Link>
        <Link
          href={`/strike-water?recipeId=${recipe.id}&units=${units}`}
          className="text-[var(--accent)] underline"
          data-testid="strike-water-link"
        >
          Calculate strike water →
        </Link>
        {loading && <span className="italic">updating…</span>}
      </div>
    </section>
  );
}

function UnitButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-sm"
          : "text-[var(--foreground)] hover:bg-[var(--muted)]"
      }`}
    >
      {children}
    </button>
  );
}

function Targets({ recipe }: { recipe: RecipeDetail }) {
  const cells: Array<{
    label: string;
    value: string;
    ratio?: number;
    accent?: string;
  }> = [];
  cells.push({
    label: "OG",
    value: recipe.targetOg != null ? fmtGravity(recipe.targetOg) : "—",
    ratio: recipe.targetOg != null ? clamp((recipe.targetOg - 1.0) / 0.12) : 0,
  });
  cells.push({
    label: "FG",
    value: recipe.targetFg != null ? fmtGravity(recipe.targetFg) : "—",
    ratio: recipe.targetFg != null ? clamp((recipe.targetFg - 1.0) / 0.06) : 0,
  });
  cells.push({
    label: "ABV",
    value: recipe.targetAbv != null ? fmtPercent(recipe.targetAbv, 1) : "—",
    ratio: recipe.targetAbv != null ? clamp(recipe.targetAbv / 15) : 0,
  });
  cells.push({
    label: "pH",
    value: recipe.targetPh != null ? fmtNumber(recipe.targetPh, 2) : "—",
    ratio: recipe.targetPh != null ? clamp((7 - recipe.targetPh) / 5) : 0,
  });
  if (recipe.category === "beer") {
    cells.push({
      label: "IBU",
      value: recipe.targetIbu != null ? fmtNumber(recipe.targetIbu, 0) : "—",
      ratio: recipe.targetIbu != null ? clamp(recipe.targetIbu / 80) : 0,
    });
    cells.push({
      label: "SRM",
      value: recipe.targetSrm != null ? fmtNumber(recipe.targetSrm, 1) : "—",
      ratio: recipe.targetSrm != null ? clamp(recipe.targetSrm / 40) : 0,
      accent: srmToHex(recipe.targetSrm),
    });
  }
  const cols =
    cells.length === 6 ? "sm:grid-cols-3 lg:grid-cols-6" : "sm:grid-cols-4";
  return (
    <section className="section">
      <div className="section-title">
        <FlaskGlyph className="h-5 w-5 text-[var(--accent)]" />
        Vital measurements
      </div>
      <div className={`vitals grid-cols-2 ${cols}`}>
        {cells.map((c) => (
          <div
            key={c.label}
            className="vital"
            style={
              c.accent
                ? {
                    borderColor: "color-mix(in srgb, " + c.accent + " 45%, var(--border))",
                  }
                : undefined
            }
          >
            <div className="flex items-center justify-between gap-2">
              <span className="vital-label">{c.label}</span>
              {c.accent && (
                <span
                  className="h-4 w-4 rounded-full border border-[var(--border-strong)]"
                  style={{ background: c.accent }}
                  aria-hidden
                />
              )}
            </div>
            <div className="vital-value">{c.value}</div>
            {c.ratio != null && (
              <div className="vital-bar" aria-hidden>
                <span
                  style={{
                    width: `${Math.max(6, Math.min(100, c.ratio * 100))}%`,
                    background: c.accent
                      ? c.accent
                      : undefined,
                  }}
                />
              </div>
            )}
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
    <Section title="Fermentables" icon={<GrainGlyph className="h-5 w-5 text-[var(--accent)]" />} count={recipe.fermentables.length}>
      {recipe.fermentables.length === 0 ? (
        <Empty>None listed.</Empty>
      ) : (
        <Table headers={["Name", "Type", "Amount", "Notes"]}>
          {recipe.fermentables.map((f) => (
            <tr key={f.id}>
              <td className="font-medium">{f.name}</td>
              <td>
                <Tag>{fermentableTypeLabel(f.type)}</Tag>
              </td>
              <td className="num">
                {formatFermentableAmount(
                  f.amountKg,
                  f.amountLiters,
                  f.amountLbs ?? null,
                  f.amountGallons ?? null,
                  units,
                )}
              </td>
              <td>
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
    <Section title="Hops" icon={<HopGlyph className="h-5 w-5 text-[var(--accent)]" />} count={recipe.hops.length}>
      {recipe.hops.length === 0 ? (
        <Empty>None — this recipe isn&apos;t hopped.</Empty>
      ) : (
        <Table headers={["Name", "Amount", "Time", "Use", "Form", "α-acid", "Notes"]}>
          {recipe.hops.map((h) => (
            <tr key={h.id}>
              <td className="font-medium">{h.name}</td>
              <td className="num">{fmtGrams(h.amountGrams, units)}</td>
              <td className="num">
                {h.timeMinutes} {h.use === "dryHop" ? "d" : "min"}
              </td>
              <td>
                <Tag>{hopUseLabel(h.use)}</Tag>
              </td>
              <td>{titleCase(h.form)}</td>
              <td className="num">
                {h.alphaAcidPct != null ? `${fmtNumber(h.alphaAcidPct, 1)}%` : "—"}
              </td>
              <td>
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
    <Section title="Yeast" icon={<YeastGlyph className="h-5 w-5 text-[var(--accent)]" />} count={recipe.yeasts.length}>
      {recipe.yeasts.length === 0 ? (
        <Empty>None listed.</Empty>
      ) : (
        <Table headers={["Name", "Lab / code", "Type", "Form", "Attenuation", "ABV tolerance", "Temperature", "Notes"]}>
          {recipe.yeasts.map((y) => (
            <tr key={y.id}>
              <td className="font-medium">{y.name}</td>
              <td>
                {[y.laboratory, y.productId].filter(Boolean).join(" · ") || "—"}
              </td>
              <td>{titleCase(y.type)}</td>
              <td>{titleCase(y.form)}</td>
              <td className="num">
                {y.attenuationPct != null ? fmtPercent(y.attenuationPct, 0) : "—"}
              </td>
              <td className="num">
                {y.abvTolerancePct != null ? fmtPercent(y.abvTolerancePct, 1) : "—"}
              </td>
              <td className="num">
                {fmtTempRange(y.temperatureCMin, y.temperatureCMax, units)}
              </td>
              <td>
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
    <Section title="Mash steps" icon={<MashGlyph className="h-5 w-5 text-[var(--accent)]" />} count={recipe.mashSteps.length}>
      <Table headers={["#", "Name", "Type", "Temperature", "Time", "Infuse", "Notes"]}>
        {recipe.mashSteps.map((m, i) => (
          <tr key={m.id}>
            <td className="num text-[var(--muted-foreground)]">{i + 1}</td>
            <td className="font-medium">{m.name}</td>
            <td>
              <Tag>{mashStepTypeLabel(m.type)}</Tag>
            </td>
            <td className="num">{fmtTemp(m.stepTempC, m.stepTempF ?? null, units)}</td>
            <td className="num">
              {m.stepTimeMinutes != null ? `${m.stepTimeMinutes} min` : "—"}
            </td>
            <td className="num">
              {m.infuseAmountLiters != null
                ? fmtLiters(m.infuseAmountLiters, units)
                : "—"}
            </td>
            <td>
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
    <Section title="Process steps" icon={<FlaskGlyph className="h-5 w-5 text-[var(--accent)]" />} count={recipe.processSteps.length}>
      <div className="relative">
        {/* timeline rail */}
        <span
          aria-hidden
          className="absolute left-[0.65rem] top-2 bottom-2 w-px bg-[var(--border)]"
        />
        <ol className="space-y-1">
          {recipe.processSteps.map((p) => (
            <li key={p.id} className="relative flex gap-3 pl-0">
              <span
                aria-hidden
                className="z-10 mt-3 h-3 w-3 shrink-0 rounded-full border-2 border-[var(--card)]"
                style={{ background: "var(--accent)", marginLeft: "0.18rem" }}
              />
              <div className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="font-medium text-[var(--foreground)]">{p.name}</span>
                  <Tag>{processStepLabel(p.type)}</Tag>
                  <span className="num text-xs text-[var(--muted-foreground)]">
                    {p.tempC != null
                      ? fmtTemp(p.tempC, p.tempF ?? null, units)
                      : null}
                    {p.tempC != null && p.durationDays != null ? " · " : ""}
                    {p.durationDays != null ? `${fmtNumber(p.durationDays, 1)} d` : null}
                    {p.tempC == null && p.durationDays == null ? "—" : null}
                  </span>
                </div>
                {p.notes && (
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {p.notes}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

function Additions({ recipe }: { recipe: RecipeDetail }) {
  return (
    <Section title="Additions" icon={<FlaskGlyph className="h-5 w-5 text-[var(--accent)]" />} count={recipe.additions.length}>
      <Table headers={["Name", "Amount", "Purpose", "Timing", "Notes"]}>
        {recipe.additions.map((a) => (
          <tr key={a.id}>
            <td className="font-medium">{a.name}</td>
            <td className="num">
              {a.amount != null ? `${fmtNumber(a.amount, 2)} ${a.unit ?? ""}` : "—"}
            </td>
            <td>{a.purpose ?? "—"}</td>
            <td>{a.timing ?? "—"}</td>
            <td>
              <NotesText text={a.notes} />
            </td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}

// ---------- shared subcomponents ----------

function Section({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-title">
        {icon}
        {title}
        <span className="count">{count}</span>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm italic text-[var(--muted-foreground)]">{children}</p>
  );
}

function Table({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
      {children}
    </span>
  );
}

function NotesText({ text }: { text: string | null }) {
  if (!text) {
    return <span className="text-[var(--muted-foreground)]/60">—</span>;
  }
  return (
    <span className="text-sm text-[var(--muted-foreground)]">{text}</span>
  );
}

// ---------- helpers ----------

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
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
      return <>{fmtNumber(lbs, 2)} lb</>;
    }
    return <>{fmtKg(kg, units)}</>;
  }
  if (liters != null) {
    if (units === "imperial" && gallons != null) {
      return <>{fmtNumber(gallons, 2)} gal</>;
    }
    return <>{fmtLiters(liters, units)}</>;
  }
  return "—";
}
