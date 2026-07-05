"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

interface ScaleAndUnitsBarProps {
  defaultBatchSizeLiters: number;
}

export function ScaleAndUnitsBar({ defaultBatchSizeLiters }: ScaleAndUnitsBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const units = (searchParams.get("units") === "imperial" ? "imperial" : "metric") as
    | "metric"
    | "imperial";
  const rawBatchSize = searchParams.get("batchSize");
  const currentBatchSize = parseBatchSize(rawBatchSize, defaultBatchSizeLiters);

  // Local draft for the input so the user can type freely. When the user
  // hasn't typed anything (or just submitted/reset), the input falls back to
  // the URL-derived value.
  const [draftBatchSize, setDraftBatchSize] = useState<string>("");

  const displayValue = draftBatchSize !== "" ? draftBatchSize : formatNumber(currentBatchSize);

  const navigate = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [pathname, router],
  );

  const onApplyBatchSize = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const parsed = Number.parseFloat(draftBatchSize.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) return;
      const next = new URLSearchParams(searchParams.toString());
      next.set("batchSize", String(parsed));
      setDraftBatchSize("");
      navigate(next);
    },
    [draftBatchSize, navigate, searchParams, setDraftBatchSize],
  );

  const onResetBatchSize = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("batchSize");
    setDraftBatchSize("");
    navigate(next);
  }, [navigate, searchParams, setDraftBatchSize]);

  const onSetUnits = useCallback(
    (next: "metric" | "imperial") => {
      if (next === units) return;
      const params = new URLSearchParams(searchParams.toString());
      if (next === "metric") params.delete("units");
      else params.set("units", "imperial");
      navigate(params);
    },
    [navigate, searchParams, units],
  );

  const isScaled =
    rawBatchSize != null &&
    rawBatchSize !== "" &&
    Math.abs(parseBatchSize(rawBatchSize, defaultBatchSizeLiters) - defaultBatchSizeLiters) >
      1e-6;

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <form onSubmit={onApplyBatchSize} className="flex flex-col gap-1">
        <label
          htmlFor="batch-size"
          className="text-xs font-medium uppercase tracking-wide text-zinc-500"
        >
          Target batch size (L)
        </label>
        <div className="flex items-center gap-2">
          <input
            id="batch-size"
            type="number"
            min={0.1}
            step={0.1}
            value={displayValue}
            onChange={(e) => setDraftBatchSize(e.target.value)}
            className="w-28 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-amber-600 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:opacity-60"
          >
            Scale
          </button>
          {isScaled && (
            <button
              type="button"
              onClick={onResetBatchSize}
              disabled={pending}
              className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Reset
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          Original: {formatNumber(defaultBatchSizeLiters)} L
        </p>
      </form>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Units
        </span>
        <div
          role="group"
          aria-label="Unit system"
          className="inline-flex rounded-md border border-zinc-300 dark:border-zinc-700"
        >
          <button
            type="button"
            onClick={() => onSetUnits("metric")}
            disabled={pending}
            aria-pressed={units === "metric"}
            className={`px-3 py-1 text-sm ${
              units === "metric"
                ? "bg-amber-600 text-white"
                : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            Metric
          </button>
          <button
            type="button"
            onClick={() => onSetUnits("imperial")}
            disabled={pending}
            aria-pressed={units === "imperial"}
            className={`px-3 py-1 text-sm ${
              units === "imperial"
                ? "bg-amber-600 text-white"
                : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            Imperial
          </button>
        </div>
      </div>
    </div>
  );
}

function parseBatchSize(raw: string | null, fallback: number): number {
  if (raw == null || raw === "") return fallback;
  const v = Number.parseFloat(raw);
  if (!Number.isFinite(v) || v <= 0) return fallback;
  return v;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}
