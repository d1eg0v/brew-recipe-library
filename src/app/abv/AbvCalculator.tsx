"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { MeasuredAbvResponse, MeasuredAbvResult } from "@/lib/ui/types";

type FormulaChoice = "auto" | "linear" | "highGravity";

const FORMULA_OPTIONS: { value: FormulaChoice; label: string; hint: string }[] = [
  {
    value: "auto",
    label: "Auto",
    hint: "Picks the high-gravity formula above OG 1.07, linear below.",
  },
  {
    value: "linear",
    label: "Linear",
    hint: "ABV = (OG − FG) × 131.25. Fine for most ales and lagers.",
  },
  {
    value: "highGravity",
    label: "High-gravity",
    hint: "Non-linear correction for meads, wines, and big beers.",
  },
];

/** Style-typical OG/FG presets — common beer, mead, and wine landing points. */
const STYLE_PRESETS: { label: string; og: number; fg: number }[] = [
  { label: "Pale ale (1.052→1.012)", og: 1.052, fg: 1.012 },
  { label: "IPA (1.064→1.014)", og: 1.064, fg: 1.014 },
  { label: "Imperial stout (1.090→1.024)", og: 1.09, fg: 1.024 },
  { label: "Dry mead (1.110→0.998)", og: 1.11, fg: 0.998 },
  { label: "Sweet mead (1.120→1.040)", og: 1.12, fg: 1.04 },
  { label: "Dry wine (1.095→0.995)", og: 1.095, fg: 0.995 },
];

interface AbvCalculatorProps {
  /** Optional recipe context (for the "pre-filled from recipe" callout). */
  recipe: {
    id: string;
    title: string;
    targetOg: number | null;
    targetFg: number | null;
  } | null;
  /** Starting OG value. */
  initialOg: number;
  /** Starting FG value. */
  initialFg: number;
  /** Starting formula choice. */
  initialFormula: FormulaChoice;
}

const DEBOUNCE_MS = 200;

export default function AbvCalculator({
  recipe,
  initialOg,
  initialFg,
  initialFormula,
}: AbvCalculatorProps) {
  // Form state — every input lives in React state so the URL can be rebuilt
  // and the API can be re-called as the user types.
  const [ogInput, setOgInput] = useState<string>(String(initialOg));
  const [fgInput, setFgInput] = useState<string>(String(initialFg));
  const [formula, setFormula] = useState<FormulaChoice>(initialFormula);

  const [result, setResult] = useState<MeasuredAbvResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const og = Number.parseFloat(ogInput);
  const fg = Number.parseFloat(fgInput);

  const query = useMemo(() => {
    const params = new URLSearchParams({ formula });
    if (Number.isFinite(og) && og > 0) params.set("measuredOg", String(og));
    if (Number.isFinite(fg) && fg > 0) params.set("measuredFg", String(fg));
    if (recipe) params.set("recipeId", recipe.id);
    return params.toString();
  }, [og, fg, formula, recipe]);

  const fetchResult = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/abv?${q}`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(
          body?.error?.message ?? `request failed: ${res.status}`,
        );
      }
      const body = (await res.json()) as MeasuredAbvResponse;
      setResult(body.data.result);
    } catch (err) {
      console.error("abv fetch failed", err);
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
        ogInput={ogInput}
        onOgChange={setOgInput}
        fgInput={fgInput}
        onFgChange={setFgInput}
        formula={formula}
        onFormulaChange={setFormula}
        recipe={recipe}
      />

      <ResultSection
        result={result}
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
  ogInput: string;
  onOgChange: (s: string) => void;
  fgInput: string;
  onFgChange: (s: string) => void;
  formula: FormulaChoice;
  onFormulaChange: (f: FormulaChoice) => void;
  recipe: {
    id: string;
    title: string;
    targetOg: number | null;
    targetFg: number | null;
  } | null;
}

function FormSection({
  ogInput,
  onOgChange,
  fgInput,
  onFgChange,
  formula,
  onFormulaChange,
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
          (targets {formatGravity(recipe.targetOg)} →{" "}
          {formatGravity(recipe.targetFg)}). Edit the gravities below to
          record what your hydrometer actually read.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <GravityInput
          id="measured-og"
          label="Measured OG"
          value={ogInput}
          onChange={onOgChange}
          testId="og-input"
        />
        <GravityInput
          id="measured-fg"
          label="Measured FG"
          value={fgInput}
          onChange={onFgChange}
          testId="fg-input"
        />
      </div>

      <div className="space-y-2">
        <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] block">
          Style presets
        </span>
        <div className="flex flex-wrap gap-2">
          {STYLE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                onOgChange(String(p.og));
                onFgChange(String(p.fg));
              }}
              className="text-xs px-2 py-1 rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              data-testid={`preset-${p.og}-${p.fg}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] block">
          Formula
        </span>
        <div className="space-y-2">
          {FORMULA_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer ${
                formula === opt.value
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] hover:bg-[var(--muted)]"
              }`}
            >
              <input
                type="radio"
                name="formula"
                value={opt.value}
                checked={formula === opt.value}
                onChange={() => onFormulaChange(opt.value)}
                className="mt-1"
                data-testid={`formula-radio-${opt.value}`}
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

function GravityInput({
  id,
  label,
  value,
  onChange,
  testId,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (s: string) => void;
  testId: string;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] block"
      >
        {label}
      </label>
      <input
        id={id}
        type="number"
        min="0.95"
        max="1.2"
        step="0.001"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[var(--border)] rounded-md px-3 py-2 bg-[var(--background)] text-[var(--foreground)] font-mono"
        data-testid={testId}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result section
// ---------------------------------------------------------------------------

interface ResultSectionProps {
  result: MeasuredAbvResult | null;
  loading: boolean;
  error: string | null;
  recipe: {
    id: string;
    title: string;
    targetOg: number | null;
    targetFg: number | null;
  } | null;
}

function ResultSection({
  result,
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
          {loading
            ? "Calculating…"
            : "Enter your measured OG and FG to see the result."}
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 space-y-4 print:border-black print:bg-white"
      data-testid="result-card"
    >
      <div className="flex items-baseline justify-between gap-3 print:hidden">
        <h2 className="text-base font-semibold">Achieved ABV</h2>
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
          Quick ABV — {recipe?.title ?? "standalone batch"}
        </h2>
        <p className="text-sm text-black">
          OG {result.input.measuredOg.toFixed(3)} → FG{" "}
          {result.input.measuredFg.toFixed(3)} · {labelForFormula(result.formulaUsed)}{" "}
          formula
        </p>
      </header>

      <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-4 print:border-black print:bg-white">
        <div
          className="text-4xl font-mono font-semibold"
          data-testid="primary-abv"
        >
          {result.abvPct.toFixed(2)} % ABV
        </div>
        <div className="text-sm text-[var(--muted-foreground)] print:text-black">
          {result.isHighGravity
            ? "High-gravity formula applied"
            : "Standard linear formula"}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Stat
          label="Apparent attenuation"
          value={`${result.apparentAttenuationPct.toFixed(1)} %`}
          testId="stat-attenuation"
        />
        <Stat
          label="Gravity points dropped"
          value={`${result.gravityPointsDropped.toFixed(1)} pts`}
          testId="stat-points"
        />
        <Stat
          label="OG"
          value={result.input.measuredOg.toFixed(3)}
          testId="stat-og"
        />
        <Stat
          label="FG"
          value={result.input.measuredFg.toFixed(3)}
          testId="stat-fg"
        />
      </dl>

      <p className="text-xs text-[var(--muted-foreground)] print:text-black">
        Hydrometer readings are temperature-sensitive — most hydrometers are
        calibrated to 15 °C / 20 °C, so adjust your measurement to that
        temperature before reading. A refractometer needs the wort-correction
        factor applied to the final gravity.
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

function formatGravity(v: number | null): string {
  if (v == null) return "—";
  return v.toFixed(3);
}

function labelForFormula(formula: "linear" | "highGravity"): string {
  return formula === "highGravity" ? "high-gravity" : "linear";
}