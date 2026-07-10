"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  StrikeWaterResponse,
  StrikeWaterResult,
  UnitSystem,
} from "@/lib/ui/types";

/** Common mash-temperature presets. */
const MASH_PRESETS: { label: string; tempC: number }[] = [
  { label: "Saccharification (α)", tempC: 65 },
  { label: "β-amylase rest", tempC: 67 },
  { label: "Acid rest", tempC: 40 },
  { label: "Dextrin rest", tempC: 72 },
];

/** Water-to-grain ratio presets in L/kg. Imperial qt/lb equivalents shown
 *  beside each. */
const RATIO_PRESETS: { label: string; ratio: number }[] = [
  { label: "Thick (2.5 L/kg · ~1.2 qt/lb)", ratio: 2.5 },
  { label: "Classic (3.0 L/kg · ~1.5 qt/lb)", ratio: 3.0 },
  { label: "Thin (3.5 L/kg · ~1.7 qt/lb)", ratio: 3.5 },
];

interface StrikeWaterCalculatorProps {
  /** Optional recipe context (for the "pre-filled from recipe" callout). */
  recipe: { id: string; title: string; grainKg: number } | null;
  /** Starting grain mass in kg (recipe grain mass wins if both given). */
  initialGrainKg: number;
  /** Default unit system. */
  initialUnits: UnitSystem;
}

const DEBOUNCE_MS = 200;

export default function StrikeWaterCalculator({
  recipe,
  initialGrainKg,
  initialUnits,
}: StrikeWaterCalculatorProps) {
  // Form state — every input lives in React state so the URL can be rebuilt
  // and the API can be re-called as the user types.
  const [grainKgInput, setGrainKgInput] = useState<string>(
    String(initialGrainKg),
  );
  const [targetMashTempC, setTargetMashTempC] = useState<number>(67);
  const [grainTempC, setGrainTempC] = useState<number>(20);
  const [waterToGrainRatioLPerKg, setWaterToGrainRatioLPerKg] =
    useState<number>(3.0);
  const [units, setUnits] = useState<UnitSystem>(initialUnits);

  const [result, setResult] = useState<StrikeWaterResult | null>(null);
  const [imperial, setImperial] = useState<
    { volumeGallons: number; strikeTempF: number } | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const grainKg = Number.parseFloat(grainKgInput);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      targetMashTempC: String(targetMashTempC),
      grainTempC: String(grainTempC),
      waterToGrainRatioLPerKg: String(waterToGrainRatioLPerKg),
      units,
    });
    if (Number.isFinite(grainKg) && grainKg > 0) {
      params.set("grainKg", String(grainKg));
    }
    if (recipe) params.set("recipeId", recipe.id);
    return params.toString();
  }, [
    grainKg,
    targetMashTempC,
    grainTempC,
    waterToGrainRatioLPerKg,
    units,
    recipe,
  ]);

  const fetchResult = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/strike-water?${q}`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(
          body?.error?.message ?? `request failed: ${res.status}`,
        );
      }
      const body = (await res.json()) as StrikeWaterResponse;
      setResult(body.data.result);
      setImperial(body.data.imperial ?? null);
    } catch (err) {
      console.error("strike-water fetch failed", err);
      setError(err instanceof Error ? err.message : "failed to load result");
      setResult(null);
      setImperial(null);
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
        grainKgInput={grainKgInput}
        onGrainKgChange={setGrainKgInput}
        targetMashTempC={targetMashTempC}
        onTargetMashTempCChange={setTargetMashTempC}
        grainTempC={grainTempC}
        onGrainTempCChange={setGrainTempC}
        waterToGrainRatioLPerKg={waterToGrainRatioLPerKg}
        onWaterToGrainRatioLPerKgChange={setWaterToGrainRatioLPerKg}
        units={units}
        onUnitsChange={setUnits}
        recipe={recipe}
      />

      <ResultSection
        result={result}
        imperial={imperial}
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
  grainKgInput: string;
  onGrainKgChange: (s: string) => void;
  targetMashTempC: number;
  onTargetMashTempCChange: (n: number) => void;
  grainTempC: number;
  onGrainTempCChange: (n: number) => void;
  waterToGrainRatioLPerKg: number;
  onWaterToGrainRatioLPerKgChange: (n: number) => void;
  units: UnitSystem;
  onUnitsChange: (u: UnitSystem) => void;
  recipe: { id: string; title: string; grainKg: number } | null;
}

function FormSection({
  grainKgInput,
  onGrainKgChange,
  targetMashTempC,
  onTargetMashTempCChange,
  grainTempC,
  onGrainTempCChange,
  waterToGrainRatioLPerKg,
  onWaterToGrainRatioLPerKgChange,
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
          (grain bill {recipe.grainKg} kg). Adjust the temperatures and ratio
          below.
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor="grain-kg"
          className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] block"
        >
          Grain mass (kg)
        </label>
        <input
          id="grain-kg"
          type="number"
          min="0.1"
          step="0.1"
          value={grainKgInput}
          onChange={(e) => onGrainKgChange(e.target.value)}
          className="w-full border border-[var(--border)] rounded-md px-3 py-2 bg-[var(--background)] text-[var(--foreground)] font-mono"
          data-testid="grain-kg-input"
        />
        <UnitToggle units={units} onUnitsChange={onUnitsChange} />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="target-mash-temp"
            className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]"
          >
            Target mash temp (°C)
          </label>
          <span
            className="font-mono text-sm"
            data-testid="target-mash-temp-readout"
          >
            {targetMashTempC.toFixed(0)} °C
          </span>
        </div>
        <input
          id="target-mash-temp"
          type="range"
          min="55"
          max="75"
          step="0.5"
          value={targetMashTempC}
          onChange={(e) =>
            onTargetMashTempCChange(Number.parseFloat(e.target.value))
          }
          className="w-full accent-[var(--accent)]"
          data-testid="target-mash-temp-input"
        />
        <div className="flex flex-wrap gap-2 pt-1">
          {MASH_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onTargetMashTempCChange(p.tempC)}
              className={`text-xs px-2 py-1 rounded-md border ${
                Math.abs(p.tempC - targetMashTempC) < 0.05
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-transparent"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              }`}
              data-testid={`mash-preset-${p.tempC}`}
            >
              {p.label} · {p.tempC.toFixed(0)} °C
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="grain-temp"
            className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]"
          >
            Grain temp (°C)
          </label>
          <span
            className="font-mono text-sm"
            data-testid="grain-temp-readout"
          >
            {grainTempC.toFixed(0)} °C
          </span>
        </div>
        <input
          id="grain-temp"
          type="range"
          min="0"
          max="35"
          step="0.5"
          value={grainTempC}
          onChange={(e) => onGrainTempCChange(Number.parseFloat(e.target.value))}
          className="w-full accent-[var(--accent)]"
          data-testid="grain-temp-input"
        />
        <p className="text-xs text-[var(--muted-foreground)]">
          Temperature the grain is sitting at right now — usually room
          temperature (~20 °C), or whatever your grain fridge is set to.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="ratio"
            className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]"
          >
            Water-to-grain ratio (L/kg)
          </label>
          <span className="font-mono text-sm" data-testid="ratio-readout">
            {waterToGrainRatioLPerKg.toFixed(2)} L/kg
          </span>
        </div>
        <input
          id="ratio"
          type="range"
          min="1.5"
          max="6"
          step="0.1"
          value={waterToGrainRatioLPerKg}
          onChange={(e) =>
            onWaterToGrainRatioLPerKgChange(Number.parseFloat(e.target.value))
          }
          className="w-full accent-[var(--accent)]"
          data-testid="ratio-input"
        />
        <div className="flex flex-wrap gap-2 pt-1">
          {RATIO_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onWaterToGrainRatioLPerKgChange(p.ratio)}
              className={`text-xs px-2 py-1 rounded-md border ${
                Math.abs(p.ratio - waterToGrainRatioLPerKg) < 0.05
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-transparent"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              }`}
              data-testid={`ratio-preset-${p.ratio}`}
            >
              {p.label}
            </button>
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
        Metric (kg · L · °C)
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
        Imperial (lb · gal · °F)
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result section
// ---------------------------------------------------------------------------

interface ResultSectionProps {
  result: StrikeWaterResult | null;
  imperial: { volumeGallons: number; strikeTempF: number } | null;
  units: UnitSystem;
  loading: boolean;
  error: string | null;
  recipe: { id: string; title: string; grainKg: number } | null;
}

function ResultSection({
  result,
  imperial,
  units,
  loading,
  error,
  recipe,
}: ResultSectionProps) {
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
          {loading ? "Calculating…" : "Enter a grain mass to see the result."}
        </p>
      </section>
    );
  }

  const metricVolumeLabel = `${result.volumeLiters.toFixed(2)} L`;
  const imperialVolumeLabel = imperial
    ? `${imperial.volumeGallons.toFixed(2)} gal`
    : "—";
  const primaryVolumeLabel =
    units === "imperial" ? imperialVolumeLabel : metricVolumeLabel;
  const secondaryVolumeLabel =
    units === "imperial" ? metricVolumeLabel : imperialVolumeLabel;

  const metricTempLabel = `${result.strikeTempC.toFixed(1)} °C`;
  const imperialTempLabel = imperial
    ? `${imperial.strikeTempF.toFixed(1)} °F`
    : "—";
  const primaryTempLabel =
    units === "imperial" ? imperialTempLabel : metricTempLabel;
  const secondaryTempLabel =
    units === "imperial" ? metricTempLabel : imperialTempLabel;

  const targetTempF = (result.input.targetMashTempC * 9) / 5 + 32;
  const grainTempF = (result.input.grainTempC * 9) / 5 + 32;

  return (
    <section
      className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 space-y-4 print:border-black print:bg-white"
      data-testid="result-card"
    >
      <div className="flex items-baseline justify-between gap-3 print:hidden">
        <h2 className="text-base font-semibold">Strike water</h2>
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
          Strike water — {recipe?.title ?? "standalone batch"}
        </h2>
        <p className="text-sm text-black">
          Grain: {formatGrainForPrint(result.input.grainKg, units)} · Target
          mash: {result.input.targetMashTempC.toFixed(0)} °C · Grain temp:{" "}
          {result.input.grainTempC.toFixed(0)} °C · Ratio:{" "}
          {result.input.waterToGrainRatioLPerKg.toFixed(2)} L/kg
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <div
          className="rounded-md border border-[var(--border)] bg-[var(--background)] p-4 print:border-black print:bg-white"
          data-testid="result-volume"
        >
          <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] print:text-black">
            Volume
          </div>
          <div className="mt-1 text-4xl font-mono font-semibold">
            {primaryVolumeLabel}
          </div>
          <div className="text-sm text-[var(--muted-foreground)] print:text-black">
            ({secondaryVolumeLabel})
          </div>
        </div>
        <div
          className="rounded-md border border-[var(--border)] bg-[var(--background)] p-4 print:border-black print:bg-white"
          data-testid="result-strike-temp"
        >
          <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] print:text-black">
            Strike temp
          </div>
          <div className="mt-1 text-4xl font-mono font-semibold">
            {primaryTempLabel}
          </div>
          <div className="text-sm text-[var(--muted-foreground)] print:text-black">
            ({secondaryTempLabel})
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Stat
          label="Target mash"
          value={
            units === "imperial"
              ? `${targetTempF.toFixed(1)} °F (${result.input.targetMashTempC.toFixed(0)} °C)`
              : `${result.input.targetMashTempC.toFixed(0)} °C`
          }
          testId="stat-target"
        />
        <Stat
          label="Grain temp"
          value={
            units === "imperial"
              ? `${grainTempF.toFixed(1)} °F (${result.input.grainTempC.toFixed(0)} °C)`
              : `${result.input.grainTempC.toFixed(0)} °C`
          }
          testId="stat-grain"
        />
        <Stat
          label="Water-to-grain"
          value={`${result.input.waterToGrainRatioLPerKg.toFixed(2)} L/kg`}
          testId="stat-ratio"
        />
        <Stat
          label="Grain mass"
          value={formatGrainForPrint(result.input.grainKg, units)}
          testId="stat-grain-mass"
        />
      </dl>

      <p className="text-xs text-[var(--muted-foreground)] print:text-black">
        Heat the strike water to the strike temp, then dough in. Adjust the
        ratio if your tun struggles to hold the target temperature or if you
        prefer a thinner/wetter mash.
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

function formatGrainForPrint(kg: number, units: UnitSystem): string {
  if (units === "imperial") {
    const pounds = kg / 0.45359237;
    return `${pounds.toFixed(2)} lb`;
  }
  return `${kg.toFixed(2)} kg`;
}