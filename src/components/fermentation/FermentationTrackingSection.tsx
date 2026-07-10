"use client";

// Fermentation tracking section for a single batch (BRE-38).
//
// Renders three things, all in one panel:
//   1. A small inline SVG chart of gravity over time (uses pure helpers from
//      `@/lib/brewing/fermentationChart`).
//   2. A "log a reading" form (gravity, optional temperature, optional pH,
//      optional date override, optional notes) that POSTs to
//      `/api/batches/[id]/logs`.
//   3. A list of every reading, newest first, with a delete button that
//      DELETE-s `/api/batches/[id]/logs/[logId]`.
//
// The component is self-contained: it manages its own loading / error state
// and re-fetches the full log list after each mutation rather than diffing
// optimistically. That's the boring/standard path the project prefers.

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_GEOMETRY,
  gravityAxis,
  gravityTicks,
  polylinePoints,
  timeAxis,
  timeTicks,
  toGravityReadings,
  type GravityReading,
} from "@/lib/brewing/fermentationChart";
import { fmtNumber } from "@/lib/ui/format";
import type { BatchLogRow } from "@/lib/ui/types";

interface FermentationTrackingSectionProps {
  batchId: string;
}

interface FormState {
  logDate: string;
  gravity: string;
  temperatureC: string;
  ph: string;
  notes: string;
}

interface FormErrors {
  [key: string]: string;
}

const GRAVITY_MIN = 0.95;
const GRAVITY_MAX = 1.2;
const TEMP_MIN_C = -20;
const TEMP_MAX_C = 60;
const PH_MIN = 2;
const PH_MAX = 7;

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultFormState(): FormState {
  return {
    logDate: todayIso(),
    gravity: "",
    temperatureC: "",
    ph: "",
    notes: "",
  };
}

export default function FermentationTrackingSection({
  batchId,
}: FermentationTrackingSectionProps) {
  const [logs, setLogs] = useState<BatchLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Captured at fetch time so the time axis is stable between renders and
  // we don't call Date.now() inside a useMemo (which would be an impure
  // call during render).
  const [fetchedAt, setFetchedAt] = useState<number>(() => Date.now());

  const refresh = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/batches/${batchId}/logs`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`request failed: ${res.status}`);
      }
      const body = (await res.json()) as { data: BatchLogRow[] };
      setLogs(body.data ?? []);
      setFetchedAt(Date.now());
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "failed to load readings",
      );
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  // Initial fetch on mount. Mirrors the same one-shot pattern the project
  // uses for ThemeSwitcher: the setState cascade is bounded to a single
  // post-mount re-render (loading → loaded).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const gravityReadings = useMemo<GravityReading[]>(
    () => toGravityReadings(logs),
    [logs],
  );

  const geometry = DEFAULT_GEOMETRY;
  const gAxis = useMemo(() => gravityAxis(gravityReadings), [gravityReadings]);
  const tAxis = useMemo(
    () => timeAxis(gravityReadings, fetchedAt),
    [gravityReadings, fetchedAt],
  );
  const projected = useMemo(
    () => polylinePoints(gravityReadings, gAxis, tAxis, geometry),
    [gravityReadings, gAxis, tAxis, geometry],
  );
  const yTicks = useMemo(() => gravityTicks(gAxis), [gAxis]);
  const xTicks = useMemo(() => timeTicks(tAxis), [tAxis]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(state: FormState): { ok: boolean; body?: Record<string, unknown>; errors: FormErrors } {
    const errs: FormErrors = {};
    if (!state.logDate.trim()) errs.logDate = "Date is required.";

    const gravityRaw = state.gravity.trim();
    if (gravityRaw === "") {
      errs.gravity = "Gravity reading is required.";
    } else {
      const parsed = Number.parseFloat(gravityRaw);
      if (!Number.isFinite(parsed)) {
        errs.gravity = "Must be a number.";
      } else if (parsed < GRAVITY_MIN || parsed > GRAVITY_MAX) {
        errs.gravity = `Must be between ${GRAVITY_MIN.toFixed(2)} and ${GRAVITY_MAX.toFixed(2)}.`;
      }
    }

    const tempRaw = state.temperatureC.trim();
    if (tempRaw !== "") {
      const parsed = Number.parseFloat(tempRaw);
      if (!Number.isFinite(parsed)) {
        errs.temperatureC = "Must be a number.";
      } else if (parsed < TEMP_MIN_C || parsed > TEMP_MAX_C) {
        errs.temperatureC = `Must be between ${TEMP_MIN_C} and ${TEMP_MAX_C}.`;
      }
    }

    const phRaw = state.ph.trim();
    if (phRaw !== "") {
      const parsed = Number.parseFloat(phRaw);
      if (!Number.isFinite(parsed)) {
        errs.ph = "Must be a number.";
      } else if (parsed < PH_MIN || parsed > PH_MAX) {
        errs.ph = `Must be between ${PH_MIN} and ${PH_MAX}.`;
      }
    }

    if (Object.keys(errs).length > 0) return { ok: false, errors: errs };

    const body: Record<string, unknown> = {
      type: "gravity",
      logDate: new Date(`${state.logDate.trim()}T12:00:00.000Z`).toISOString(),
      gravity: Number.parseFloat(gravityRaw),
    };
    if (tempRaw !== "") body.temperatureC = Number.parseFloat(tempRaw);
    if (phRaw !== "") body.ph = Number.parseFloat(phRaw);
    if (state.notes.trim() !== "") body.notes = state.notes.trim();
    return { ok: true, body, errors: {} };
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setErrors({});
    const result = validate(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/batches/${batchId}/logs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(result.body),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setSubmitError(
          payload?.error?.message ?? `Request failed (${res.status}).`,
        );
        return;
      }
      setForm(defaultFormState());
      await refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(logId: string) {
    setDeletingId(logId);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/batches/${batchId}/logs/${logId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setSubmitError(
          payload?.error?.message ?? `Delete failed (${res.status}).`,
        );
        return;
      }
      await refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  // Display sorted newest-first for the table; the chart projection is driven
  // by toGravityReadings (already sorted ascending).
  const sortedDesc = useMemo(
    () =>
      [...logs].sort(
        (a, b) => Date.parse(b.logDate) - Date.parse(a.logDate),
      ),
    [logs],
  );

  return (
    <div className="space-y-4" data-testid="fermentation-section">
      <header className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Fermentation readings
        </h3>
        <span
          className="text-xs text-[var(--muted-foreground)]"
          data-testid="fermentation-count"
        >
          {gravityReadings.length} plotted
        </span>
      </header>

      {fetchError ? (
        <div
          role="alert"
          className="text-xs text-[var(--error-fg)]"
          data-testid="fermentation-fetch-error"
        >
          Couldn&apos;t load readings: {fetchError}
        </div>
      ) : null}

      <FermentationChart
        loading={loading}
        geometry={geometry}
        gAxis={gAxis}
        tAxis={tAxis}
        yTicks={yTicks}
        xTicks={xTicks}
        projected={projected.points}
        hasReadings={gravityReadings.length > 0}
      />

      {submitError ? (
        <div
          role="alert"
          className="p-2 rounded-md border border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-fg)] text-xs"
          data-testid="fermentation-submit-error"
        >
          {submitError}
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        noValidate
        className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end"
        aria-busy={submitting}
        data-testid="fermentation-form"
      >
        <Field
          label="Date"
          error={errors["logDate"]}
          fieldPath="logDate"
        >
          <input
            type="date"
            value={form.logDate}
            onChange={(e) => update("logDate", e.target.value)}
            required
            className={inputClass}
            data-field-path="logDate"
          />
        </Field>
        <Field
          label="Gravity"
          error={errors["gravity"]}
          fieldPath="gravity"
        >
          <input
            type="number"
            inputMode="decimal"
            value={form.gravity}
            onChange={(e) => update("gravity", e.target.value)}
            min={GRAVITY_MIN}
            max={GRAVITY_MAX}
            step={0.001}
            placeholder="1.054"
            className={inputClass}
            data-field-path="gravity"
          />
        </Field>
        <Field
          label="Temp °C"
          error={errors["temperatureC"]}
          fieldPath="temperatureC"
        >
          <input
            type="number"
            inputMode="decimal"
            value={form.temperatureC}
            onChange={(e) => update("temperatureC", e.target.value)}
            min={TEMP_MIN_C}
            max={TEMP_MAX_C}
            step={0.1}
            placeholder="e.g. 19.5"
            className={inputClass}
            data-field-path="temperatureC"
          />
        </Field>
        <Field
          label="pH"
          error={errors["ph"]}
          fieldPath="ph"
        >
          <input
            type="number"
            inputMode="decimal"
            value={form.ph}
            onChange={(e) => update("ph", e.target.value)}
            min={PH_MIN}
            max={PH_MAX}
            step={0.01}
            placeholder="e.g. 4.4"
            className={inputClass}
            data-field-path="ph"
          />
        </Field>
        <div>
          <button
            type="submit"
            disabled={submitting || loading}
            className="w-full px-3 py-2 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] text-sm font-medium hover:opacity-90 disabled:opacity-50"
            data-testid="fermentation-submit"
          >
            {submitting ? "Saving…" : "Log reading"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table
          className="w-full text-xs"
          data-testid="fermentation-log-table"
        >
          <thead>
            <tr>
              <th
                scope="col"
                className="pb-1 text-left text-[var(--muted-foreground)] font-medium"
              >
                Date
              </th>
              <th
                scope="col"
                className="pb-1 text-right text-[var(--muted-foreground)] font-medium"
              >
                Gravity
              </th>
              <th
                scope="col"
                className="pb-1 text-right text-[var(--muted-foreground)] font-medium"
              >
                Temp °C
              </th>
              <th
                scope="col"
                className="pb-1 text-right text-[var(--muted-foreground)] font-medium"
              >
                pH
              </th>
              <th
                scope="col"
                className="pb-1 text-left text-[var(--muted-foreground)] font-medium"
              >
                Notes
              </th>
              <th scope="col" className="pb-1 w-8">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedDesc.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-3 text-center text-[var(--muted-foreground)] italic"
                  data-testid="fermentation-empty"
                >
                  No readings yet — log your first one above.
                </td>
              </tr>
            ) : (
              sortedDesc.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-[var(--border)]"
                  data-testid={`fermentation-row-${row.id}`}
                >
                  <td className="py-1.5 pr-2 font-mono">
                    {row.logDate.slice(0, 10)}
                  </td>
                  <td className="py-1.5 pr-2 font-mono text-right">
                    {row.gravity != null ? fmtNumber(row.gravity, 3) : "—"}
                  </td>
                  <td className="py-1.5 pr-2 font-mono text-right">
                    {row.temperatureC != null
                      ? fmtNumber(row.temperatureC, 1)
                      : "—"}
                  </td>
                  <td className="py-1.5 pr-2 font-mono text-right">
                    {row.ph != null ? fmtNumber(row.ph, 2) : "—"}
                  </td>
                  <td className="py-1.5 pr-2 text-[var(--muted-foreground)] truncate max-w-[20ch]">
                    {row.notes ?? ""}
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => void onDelete(row.id)}
                      disabled={deletingId === row.id}
                      aria-label={`Delete reading from ${row.logDate.slice(0, 10)}`}
                      className="px-2 py-1 rounded border border-[var(--border)] text-xs hover:bg-[var(--muted)] disabled:opacity-50"
                      data-testid={`fermentation-delete-${row.id}`}
                    >
                      {deletingId === row.id ? "…" : "×"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputClass =
  "w-full border border-[var(--border)] rounded-md px-2 py-1.5 bg-[var(--background)] text-[var(--foreground)] text-sm";

function Field({
  label,
  error,
  fieldPath,
  children,
}: {
  label: string;
  error?: string;
  fieldPath: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1" data-field-key={fieldPath}>
      <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </span>
      {children}
      {error ? (
        <span
          className="text-[10px] text-[var(--error-fg)]"
          role="alert"
          data-error-path={fieldPath}
        >
          {error}
        </span>
      ) : null}
    </label>
  );
}

interface FermentationChartProps {
  loading: boolean;
  geometry: typeof DEFAULT_GEOMETRY;
  gAxis: { min: number; max: number };
  tAxis: { min: number; max: number };
  yTicks: number[];
  xTicks: { value: number; label: string }[];
  projected: { reading: GravityReading; point: { x: number; y: number } }[];
  hasReadings: boolean;
}

function FermentationChart({
  loading,
  geometry,
  gAxis,
  tAxis,
  yTicks,
  xTicks,
  projected,
  hasReadings,
}: FermentationChartProps) {
  const polyline = projected
    .map(({ point }) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");

  return (
    <figure
      className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3"
      data-testid="fermentation-chart"
    >
      <svg
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        width="100%"
        height={geometry.height}
        role="img"
        aria-label="Specific gravity over time"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y-axis grid lines and tick labels */}
        {yTicks.map((tick) => {
          const usableH = geometry.height - geometry.padding * 2;
          const yRatio = (tick - gAxis.min) / (gAxis.max - gAxis.min);
          const y = geometry.padding + (1 - yRatio) * usableH;
          return (
            <g key={`y-${tick}`}>
              <line
                x1={geometry.padding}
                x2={geometry.width - geometry.padding}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.12}
                strokeWidth={1}
              />
              <text
                x={geometry.padding - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={10}
                fill="currentColor"
                fillOpacity={0.7}
              >
                {tick.toFixed(3)}
              </text>
            </g>
          );
        })}

        {/* X-axis tick labels */}
        {xTicks.map((tick, idx) => {
          const usableW = geometry.width - geometry.padding * 2;
          const xRatio = (tick.value - tAxis.min) / (tAxis.max - tAxis.min);
          const x = geometry.padding + xRatio * usableW;
          return (
            <text
              key={`x-${idx}-${tick.value}`}
              x={x}
              y={geometry.height - geometry.padding + 12}
              textAnchor="middle"
              fontSize={10}
              fill="currentColor"
              fillOpacity={0.7}
            >
              {tick.label}
            </text>
          );
        })}

        {/* Baseline */}
        <line
          x1={geometry.padding}
          x2={geometry.width - geometry.padding}
          y1={geometry.height - geometry.padding}
          y2={geometry.height - geometry.padding}
          stroke="currentColor"
          strokeOpacity={0.4}
          strokeWidth={1}
        />

        {hasReadings ? (
          <>
            <polyline
              points={polyline}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              data-testid="fermentation-chart-line"
            />
            {projected.map(({ reading, point }) => (
              <circle
                key={reading.timestamp}
                cx={point.x}
                cy={point.y}
                r={3}
                fill="var(--accent)"
                data-testid="fermentation-chart-point"
              >
                <title>
                  {new Date(reading.timestamp).toISOString().slice(0, 10)} —{" "}
                  {reading.gravity.toFixed(3)}
                </title>
              </circle>
            ))}
          </>
        ) : (
          <text
            x={geometry.width / 2}
            y={geometry.height / 2}
            textAnchor="middle"
            fontSize={12}
            fill="currentColor"
            fillOpacity={0.5}
            data-testid="fermentation-chart-empty"
          >
            {loading ? "Loading…" : "Log a reading to plot the curve"}
          </text>
        )}
      </svg>
      <figcaption className="sr-only">
        Gravity-over-time chart for this batch.
      </figcaption>
    </figure>
  );
}