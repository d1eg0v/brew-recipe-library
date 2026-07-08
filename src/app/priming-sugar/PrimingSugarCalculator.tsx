"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  PrimingSugarResponse,
  PrimingSugarType,
  UnitSystem,
} from "@/lib/ui/types";

/** Sugar options the user can pick from. */
const SUGAR_OPTIONS: { value: PrimingSugarType; label: string; hint: string }[] = [
  {
    value: "cornSugar",
    label: "Corn sugar (dextrose)",
    hint: "Most common. Clean, neutral flavour; 0.5 oz/gal/volume.",
  },
  {
    value: "tableSugar",
    label: "Table sugar (sucrose)",
    hint: "Slightly fruitier. 0.54 oz/gal/volume.",
  },
  {
    value: "dme",
    label: "Dry malt extract (DME)",
    hint: "Adds a touch of malt flavour. 0.96 oz/gal/volume.",
  },
];

/** Style-typical CO2 volumes, for the quick-preset buttons. */
const STYLE_PRESETS: { label: string; volumes: number }[] = [
  { label: "British cask ale", volumes: 1.5 },
  { label: "American ale", volumes: 2.4 },
  { label: "Lager / pilsner", volumes: 2.7 },
  { label: "Belgian / wheat", volumes: 3.2 },
  { label: "Highly carbonated", volumes: 3.7 },
];

interface PrimingSugarCalculatorProps {
  /** Optional recipe context (for the "pre-filled from recipe" callout). */
  recipe: { id: string; title: string; batchSizeLiters: number } | null;
  /** Starting batch size in litres (recipe batch size wins if both given). */
  initialBatchSize: number;
  /** Default unit system. */
  initialUnits: UnitSystem;
}

const DEBOUNCE_MS = 200;

export default function PrimingSugarCalculator({
  recipe,
  initialBatchSize,
  initialUnits,
}: PrimingSugarCalculatorProps) {
  // Form state — every input lives in React state so the URL can be rebuilt
  // and the API can be re-called as the user types.
  const [batchSizeInput, setBatchSizeInput] = useState<string>(
    String(initialBatchSize),
  );
  const [targetVolumes, setTargetVolumes] = useState<number>(2.5);
  const [temperatureC, setTemperatureC] = useState<number>(20);
  const [sugarType, setSugarType] = useState<PrimingSugarType>("cornSugar");
  const [units, setUnits] = useState<UnitSystem>(initialUnits);

  const [result, setResult] = useState<PrimingSugarResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const batchSize = Number.parseFloat(batchSizeInput);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      targetVolumes: String(targetVolumes),
      temperatureC: String(temperatureC),
      sugarType,
      units,
    });
    if (Number.isFinite(batchSize) && batchSize > 0) {
      params.set("volumeLiters", String(batchSize));
    }
    if (recipe) params.set("recipeId", recipe.id);
    return params.toString();
  }, [batchSize, targetVolumes, temperatureC, sugarType, units, recipe]);

  const fetchResult = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/priming-sugar?${q}`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(
          body?.error?.message ?? `request failed: ${res.status}`,
        );
      }
      const body = (await res.json()) as PrimingSugarResponse;
      setResult(body.data.result);
    } catch (err) {
      console.error("priming-sugar fetch failed", err);
      setError(err instanceof Error ? err.message : "failed to load result");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce input-driven refetches.
  useEffect(() => {
    const handle = setTimeout(() => {
      fetchResult(query);
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, fetchResult]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 items-start">
      <FormSection
        batchSizeInput={batchSizeInput}
        onBatchSizeChange={setBatchSizeInput}
        targetVolumes={targetVolumes}
        onTargetVolumesChange={setTargetVolumes}
        temperatureC={temperatureC}
        onTemperatureCChange={setTemperatureC}
        sugarType={sugarType}
        onSugarTypeChange={setSugarType}
        units={units}
        onUnitsChange={setUnits}
        recipe={recipe}
      />

      <ResultSection
        result={result}
        units={units}
        loading={loading}
        error={error}
        recipe={recipe}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form section
// ---------------------------------------------------------------------------

interface FormSectionProps {
  batchSizeInput: string;
  onBatchSizeChange: (s: string) => void;
  targetVolumes: number;
  onTargetVolumesChange: (n: number) => void;
  temperatureC: number;
  onTemperatureCChange: (n: number) => void;
  sugarType: PrimingSugarType;
  onSugarTypeChange: (t: PrimingSugarType) => void;
  units: UnitSystem;
  onUnitsChange: (u: UnitSystem) => void;
  recipe: { id: string; title: string; batchSizeLiters: number } | null;
}

function FormSection({
  batchSizeInput,
  onBatchSizeChange,
  targetVolumes,
  onTargetVolumesChange,
  temperatureC,
  onTemperatureCChange,
  sugarType,
  onSugarTypeChange,
  units,
  onUnitsChange,
  recipe,
}: FormSectionProps) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 space-y-5">
      {recipe && (
        <div
          className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-sm"
          data-testid="recipe-prefill"
        >
          Pre-filled from{" "}
          <Link
            href={`/recipes/${recipe.id}`}
            className="font-medium text-[var(--foreground)] underline"
          >
            {recipe.title}
          </Link>{" "}
          (batch size {recipe.batchSizeLiters} L). Adjust the temperature and
          target CO<sub>2</sub> below.
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor="batch-size"
          className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] block"
        >
          Batch size (litres)
        </label>
        <input
          id="batch-size"
          type="number"
          min="0.1"
          step="0.1"
          value={batchSizeInput}
          onChange={(e) => onBatchSizeChange(e.target.value)}
          className="w-full border border-[var(--border)] rounded-md px-3 py-2 bg-[var(--background)] text-[var(--foreground)] font-mono"
          data-testid="batch-size-input"
        />
        <UnitToggle units={units} onUnitsChange={onUnitsChange} />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="target-volumes"
            className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]"
          >
            Target CO<sub>2</sub> (volumes)
          </label>
          <span
            className="font-mono text-sm"
            data-testid="target-volumes-readout"
          >
            {targetVolumes.toFixed(1)}
          </span>
        </div>
        <input
          id="target-volumes"
          type="range"
          min="1"
          max="4"
          step="0.1"
          value={targetVolumes}
          onChange={(e) => onTargetVolumesChange(Number.parseFloat(e.target.value))}
          className="w-full accent-[var(--accent)]"
          data-testid="target-volumes-input"
        />
        <div className="flex flex-wrap gap-2 pt-1">
          {STYLE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onTargetVolumesChange(p.volumes)}
              className={`text-xs px-2 py-1 rounded-md border ${
                Math.abs(p.volumes - targetVolumes) < 0.05
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-transparent"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              }`}
              data-testid={`preset-${p.volumes}`}
            >
              {p.label} · {p.volumes.toFixed(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="temperature"
            className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]"
          >
            Conditioning temperature (°C)
          </label>
          <span
            className="font-mono text-sm"
            data-testid="temperature-readout"
          >
            {temperatureC.toFixed(0)} °C
          </span>
        </div>
        <input
          id="temperature"
          type="range"
          min="0"
          max="30"
          step="0.5"
          value={temperatureC}
          onChange={(e) => onTemperatureCChange(Number.parseFloat(e.target.value))}
          className="w-full accent-[var(--accent)]"
          data-testid="temperature-input"
        />
        <p className="text-xs text-[var(--muted-foreground)]">
          The temperature your bottles will sit at while carbonating. Colder
          beer holds more residual CO<sub>2</sub> and needs less priming sugar.
        </p>
      </div>

      <div className="space-y-2">
        <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] block">
          Priming sugar
        </span>
        <div className="space-y-2">
          {SUGAR_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer ${
                sugarType === opt.value
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] hover:bg-[var(--muted)]"
              }`}
            >
              <input
                type="radio"
                name="sugarType"
                value={opt.value}
                checked={sugarType === opt.value}
                onChange={() => onSugarTypeChange(opt.value)}
                className="mt-1"
                data-testid={`sugar-radio-${opt.value}`}
              />
              <span className="flex-1">
                <span className="block text-sm font-medium">{opt.label}</span>
                <span className="block text-xs text-[var(--muted-foreground)]">
                  {opt.hint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}

function UnitToggle({
  units,
  onUnitsChange,
}: {
  units: UnitSystem;
  onUnitsChange: (u: UnitSystem) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-[var(--border)] overflow-hidden">
      <button
        type="button"
        onClick={() => onUnitsChange("metric")}
        className={`px-3 py-1.5 text-xs ${
          units === "metric"
            ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
            : "bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--muted)]"
        }`}
        aria-pressed={units === "metric"}
      >
        Metric (L)
      </button>
      <button
        type="button"
        onClick={() => onUnitsChange("imperial")}
        className={`px-3 py-1.5 text-xs border-l border-[var(--border)] ${
          units === "imperial"
            ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
            : "bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--muted)]"
        }`}
        aria-pressed={units === "imperial"}
      >
        Imperial (gal)
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result section
// ---------------------------------------------------------------------------

interface PrimingSugarResult {
  weightGrams: number;
  weightOz: number;
  residualVolumes: number;
  volumesToAdd: number;
  sugarType: PrimingSugarType;
  input: {
    volumeLiters: number;
    targetVolumes: number;
    temperatureC: number;
    sugarType: PrimingSugarType;
  };
}

interface ResultSectionProps {
  result: PrimingSugarResult | null;
  units: UnitSystem;
  loading: boolean;
  error: string | null;
  recipe: { id: string; title: string; batchSizeLiters: number } | null;
}

function ResultSection({ result, units, loading, error, recipe }: ResultSectionProps) {
  if (error) {
    return (
      <section
        className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] p-5 text-sm text-[var(--error-fg)]"
        data-testid="result-error"
      >
        <h2 className="text-base font-semibold mb-1">Couldn&apos;t compute</h2>
        <p>{error}</p>
      </section>
    );
  }

  if (!result) {
    return (
      <section
        className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
        data-testid="result-empty"
      >
        <p className="text-sm text-[var(--muted-foreground)]">
          {loading ? "Calculating…" : "Enter a batch size to see the result."}
        </p>
      </section>
    );
  }

  const metricLabel = `${result.weightGrams.toFixed(1)} g`;
  const imperialLabel = `${result.weightOz.toFixed(2)} oz`;
  const primaryLabel = units === "imperial" ? imperialLabel : metricLabel;
  const secondaryLabel =
    units === "imperial" ? metricLabel : imperialLabel;
  const temperatureF = (result.input.temperatureC * 9) / 5 + 32;

  return (
    <section
      className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 space-y-4 print:border-black print:bg-white"
      data-testid="result-card"
    >
      <div className="flex items-baseline justify-between gap-3 print:hidden">
        <h2 className="text-base font-semibold">Priming dose</h2>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") window.print();
          }}
          className="text-xs px-3 py-1.5 rounded-md border border-[var(--border)] hover:bg-[var(--muted)]"
        >
          Print
        </button>
      </div>

      {/* Print-only header (hidden on screen) */}
      <header className="hidden print:block">
        <h2 className="text-lg font-semibold text-black">
          Priming sugar — {recipe?.title ?? "standalone batch"}
        </h2>
        <p className="text-sm text-black">
          Batch: {formatVolumeForPrint(result.input.volumeLiters, units)} ·{" "}
          {result.input.targetVolumes.toFixed(1)} vol ·{" "}
          {result.input.temperatureC.toFixed(0)} °C conditioning
        </p>
      </header>

      <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-4 print:border-black print:bg-white">
        <div
          className="text-4xl font-mono font-semibold"
          data-testid="primary-dose"
        >
          {primaryLabel}
        </div>
        <div className="text-sm text-[var(--muted-foreground)] print:text-black">
          ({secondaryLabel}) of{" "}
          {labelForSugar(result.sugarType)}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Stat
          label="Residual CO₂"
          value={`${result.residualVolumes.toFixed(2)} vol`}
          testId="stat-residual"
        />
        <Stat
          label="CO₂ to add"
          value={`${result.volumesToAdd.toFixed(2)} vol`}
          testId="stat-add"
        />
        <Stat
          label="Batch size"
          value={formatVolumeForPrint(result.input.volumeLiters, units)}
          testId="stat-volume"
        />
        <Stat
          label="Conditioning temp"
          value={
            units === "imperial"
              ? `${temperatureF.toFixed(0)} °F (${result.input.temperatureC.toFixed(0)} °C)`
              : `${result.input.temperatureC.toFixed(0)} °C`
          }
          testId="stat-temp"
        />
      </dl>

      <p className="text-xs text-[var(--muted-foreground)] print:text-black">
        Boil the sugar in a small amount of water, cool, and add to the
        bottling bucket before racking. Stir gently to avoid oxidising the
        beer.
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] print:text-black">
        {label}
      </dt>
      <dd className="font-mono text-base" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function formatVolumeForPrint(liters: number, units: UnitSystem): string {
  if (units === "imperial") {
    return `${(liters / 3.785411784).toFixed(2)} gal`;
  }
  return `${liters.toFixed(2)} L`;
}

function labelForSugar(sugarType: PrimingSugarType): string {
  switch (sugarType) {
    case "cornSugar":
      return "corn sugar (dextrose)";
    case "tableSugar":
      return "table sugar (sucrose)";
    case "dme":
      return "dry malt extract (DME)";
  }
}
