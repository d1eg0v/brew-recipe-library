"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { PitchRateResponse, PitchRateResult } from "@/lib/ui/types";

const DEBOUNCE_MS = 200;

const STYLE_PRESETS: { label: string; og: number }[] = [
  { label: "Pale ale (1.052)", og: 1.052 },
  { label: "IPA (1.064)", og: 1.064 },
  { label: "Imperial stout (1.090)", og: 1.09 },
  { label: "Dry mead (1.110)", og: 1.11 },
  { label: "Cream ale (1.040)", og: 1.04 },
  { label: "Pilsner (1.048)", og: 1.048 },
];

export default function PitchRateCalculator() {
  const [ogInput, setOgInput] = useState<string>("1.050");
  const [batchSizeInput, setBatchSizeInput] = useState<string>("20");
  const [beerType, setBeerType] = useState<"ale" | "lager">("ale");
  const [yeastForm, setYeastForm] = useState<"dry" | "liquid">("liquid");
  const [daysSinceProduction, setDaysSinceProduction] = useState<string>("0");

  const [result, setResult] = useState<PitchRateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const og = Number.parseFloat(ogInput);
  const batchSizeLiters = Number.parseFloat(batchSizeInput);
  const days = Number.parseInt(daysSinceProduction, 10);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      og: String(og),
      batchSizeLiters: String(batchSizeLiters),
      beerType,
      yeastForm,
    });
    if (Number.isFinite(days) && days > 0) {
      params.set("daysSinceProduction", String(days));
    }
    return params.toString();
  }, [og, batchSizeLiters, beerType, yeastForm, days]);

  const fetchResult = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pitch-rate?${q}`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(
          body?.error?.message ?? `request failed: ${res.status}`,
        );
      }
      const body = (await res.json()) as PitchRateResponse;
      setResult(body.data.result);
    } catch (err) {
      console.error("pitch-rate fetch failed", err);
      setError(err instanceof Error ? err.message : "failed to load result");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      fetchResult(query);
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, fetchResult]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 items-start">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label
              htmlFor="og"
              className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] block"
            >
              Original gravity
            </label>
            <input
              id="og"
              type="number"
              min="1"
              max="1.2"
              step="0.001"
              value={ogInput}
              onChange={(e) => setOgInput(e.target.value)}
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 bg-[var(--background)] text-[var(--foreground)] font-mono"
              data-testid="og-input"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="batch-size"
              className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] block"
            >
              Batch volume (L)
            </label>
            <input
              id="batch-size"
              type="number"
              min="0.1"
              max="200"
              step="0.5"
              value={batchSizeInput}
              onChange={(e) => setBatchSizeInput(e.target.value)}
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 bg-[var(--background)] text-[var(--foreground)] font-mono"
              data-testid="batch-size-input"
            />
          </div>
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
                onClick={() => setOgInput(String(p.og))}
                className="text-xs px-2 py-1 rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                data-testid={`preset-${p.og}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] block">
            Beer type
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(["ale", "lager"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setBeerType(t)}
                className={`text-sm px-3 py-2 rounded-md border ${
                  beerType === t
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-transparent"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                }`}
                data-testid={`beer-type-${t}`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] block">
            Yeast form
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(["liquid", "dry"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setYeastForm(f)}
                className={`text-sm px-3 py-2 rounded-md border ${
                  yeastForm === f
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-transparent"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                }`}
                data-testid={`yeast-form-${f}`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          {yeastForm === "liquid" && (
            <div className="space-y-2 pt-2">
              <label
                htmlFor="days"
                className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] block"
              >
                Days since production
              </label>
              <input
                id="days"
                type="number"
                min="0"
                max="500"
                step="1"
                value={daysSinceProduction}
                onChange={(e) => setDaysSinceProduction(e.target.value)}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 bg-[var(--background)] text-[var(--foreground)] font-mono"
                data-testid="days-input"
              />
              <p className="text-xs text-[var(--muted-foreground)]">
                Liquid yeast loses ~21 % viability per month. Check the
                production date on the pack. 0 = fresh.
              </p>
            </div>
          )}
          {yeastForm === "dry" && (
            <p className="text-xs text-[var(--muted-foreground)] pt-1">
              Dry yeast has ~200 billion cells per pack and&nbsp;excellent
              shelf&nbsp;life. A starter is&nbsp;rarely needed.
            </p>
          )}
        </div>
      </section>

      <ResultSection result={result} loading={loading} error={error} />
    </div>
  );
}

function ResultSection({
  result,
  loading,
  error,
}: {
  result: PitchRateResult | null;
  loading: boolean;
  error: string | null;
}) {
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
            : "Enter your wort gravity and batch size to see the pitch-rate recommendation."}
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
        <h2 className="text-base font-semibold">Pitch rate</h2>
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

      <header className="hidden print:block">
        <h2 className="text-lg font-semibold text-black">
          Yeast pitch rate —{" "}
          {result.input.beerType === "lager" ? "Lager" : "Ale"}
        </h2>
        <p className="text-sm text-black">
          OG {result.input.og.toFixed(3)} · {result.degreesPlato.toFixed(1)} °P ·{" "}
          {result.input.batchSizeLiters.toFixed(1)} L
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-4 print:border-black print:bg-white">
          <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] print:text-black">
            Pitch rate
          </div>
          <div
            className="mt-1 text-4xl font-mono font-semibold"
            data-testid="primary-cells"
          >
            {result.recommendedCells.toFixed(0)} B
          </div>
          <div className="text-sm text-[var(--muted-foreground)] print:text-black">
            recommended cells
          </div>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-4 print:border-black print:bg-white">
          <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] print:text-black">
            Packs needed
          </div>
          <div
            className="mt-1 text-4xl font-mono font-semibold"
            data-testid="primary-packs"
          >
            {result.packsNeeded}
          </div>
          <div className="text-sm text-[var(--muted-foreground)] print:text-black">
            {result.viableCellsPerPack.toFixed(0)} B viable per pack
          </div>
        </div>
      </div>

      {result.starterRecommended && (
        <div
          className="rounded-md border border-[var(--accent)] bg-[var(--accent)]/10 p-4"
          data-testid="starter-callout"
        >
          <h3 className="text-sm font-semibold mb-1">
            Starter recommended
          </h3>
          <p className="text-sm">
            Prepare a{" "}
            <strong>
              {result.starterVolumeLiters.toFixed(1)}&nbsp;L
            </strong>{" "}
            starter to grow enough viable cells from {result.packsNeeded}{" "}
            pack{result.packsNeeded !== 1 ? "s" : ""} of liquid yeast. Use
            100&nbsp;g of DME per litre of starter water (target ~1.040).
          </p>
        </div>
      )}

      {!result.starterRecommended && result.input.yeastForm === "liquid" && (
        <div
          className="rounded-md border border-[var(--border)] bg-[var(--background)] p-4"
          data-testid="no-starter-callout"
        >
          <p className="text-sm text-[var(--muted-foreground)]">
            <strong>{result.packsNeeded}</strong> fresh pack
            {result.packsNeeded !== 1 ? "s" : ""} of liquid yeast should be
            enough — no starter needed.
          </p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Stat
          label="Viability"
          value={`${(result.viability * 100).toFixed(0)} %`}
          testId="stat-viability"
        />
        <Stat
          label="Degrees Plato"
          value={`${result.degreesPlato.toFixed(1)} °P`}
          testId="stat-plato"
        />
        <Stat
          label="OG"
          value={result.input.og.toFixed(3)}
          testId="stat-og"
        />
        <Stat
          label="Batch size"
          value={`${result.input.batchSizeLiters.toFixed(1)} L`}
          testId="stat-volume"
        />
      </dl>

      <p className="text-xs text-[var(--muted-foreground)] print:text-black">
        Pitch rate:{" "}
        {result.input.beerType === "lager" ? "1.5" : "0.75"} million cells /
        mL / °P. Viability estimated from age at{" "}
        {(0.7).toFixed(1)} % loss per day. Always rehydrate dry yeast
        according to the manufacturer&apos;s instructions.
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
