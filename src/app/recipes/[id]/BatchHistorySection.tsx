// Batch history section for the recipe detail page.
//
// Renders the list of brews logged for the recipe (newest first), with
// measured values, derived metrics, and notes. Each row expands a details
// panel that lazily fetches the single-batch endpoint
// (`GET /api/batches/[id]`) so the full contract shipped in BRE-37.3 is
// exercised on demand rather than up front.

"use client";

import Link from "next/link";
import { useState } from "react";

import FermentationTrackingSection from "@/components/fermentation/FermentationTrackingSection";
import { buildBatchUrl } from "@/lib/ui/api";
import {
  fmtBatchVolume,
  fmtBrewDate,
  fmtGravity,
  fmtPercent,
} from "@/lib/ui/format";
import type {
  BatchResponse,
  BatchSummary,
  UnitSystem,
} from "@/lib/ui/types";

interface BatchHistorySectionProps {
  recipeId: string;
  batches: BatchSummary[];
  units: UnitSystem;
  error: string | null;
}

const NOTES_PREVIEW_LIMIT = 90;

export default function BatchHistorySection({
  recipeId,
  batches,
  units,
  error,
}: BatchHistorySectionProps) {
  if (error) {
    return (
      <section
        className="rounded-lg border border-red-300 bg-red-50 p-5 text-sm text-red-900"
        data-testid="batch-history-error"
      >
        Couldn&apos;t reload batch history: {error}
      </section>
    );
  }
  const newBrewHref = `/recipes/${recipeId}/batches/new`;
  if (batches.length === 0) {
    return (
      <section
        className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 space-y-3"
        data-testid="batch-history-empty"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Batch history</h2>
          <Link
            href={newBrewHref}
            className="px-3 py-1.5 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] text-sm font-medium hover:opacity-90 no-underline"
            data-testid="batch-history-new-brew"
          >
            + Log a brew
          </Link>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          No brews logged for this recipe yet.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
      aria-label="Batch history"
      data-testid="batch-history"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-base font-semibold">
          Batch history{" "}
          <span className="text-sm font-normal text-[var(--muted-foreground)]">
            ({batches.length} brew{batches.length === 1 ? "" : "s"})
          </span>
        </h2>
        <Link
          href={newBrewHref}
          className="px-3 py-1.5 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] text-sm font-medium hover:opacity-90 no-underline"
          data-testid="batch-history-new-brew"
        >
          + Log a brew
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="pb-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium text-left"
              >
                Brew date
              </th>
              <th
                scope="col"
                className="pb-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium text-right"
              >
                OG
              </th>
              <th
                scope="col"
                className="pb-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium text-right"
              >
                FG
              </th>
              <th
                scope="col"
                className="pb-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium text-right"
              >
                Volume
              </th>
              <th
                scope="col"
                className="pb-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium text-right"
              >
                ABV
              </th>
              <th
                scope="col"
                className="pb-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium text-right"
              >
                Atten.
              </th>
              <th
                scope="col"
                className="pb-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium text-right"
              >
                Efficiency
              </th>
              <th
                scope="col"
                className="pb-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium text-left"
              >
                Notes
              </th>
              <th scope="col" className="pb-2 w-10">
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <BatchRow
                key={batch.id}
                batch={batch}
                units={units}
                recipeId={recipeId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BatchRow({
  batch,
  units,
  recipeId,
}: {
  batch: BatchSummary;
  units: UnitSystem;
  recipeId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [details, setDetails] = useState<BatchSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  async function toggleDetails() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (details) return;
    setLoading(true);
    setDetailsError(null);
    try {
      const res = await fetch(buildBatchUrl("", batch.id), {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`request failed: ${res.status}`);
      }
      const body = (await res.json()) as BatchResponse;
      setDetails(body.data);
    } catch (err) {
      console.error("batch detail fetch error", err);
      setDetailsError(
        err instanceof Error ? err.message : "failed to load batch details",
      );
    } finally {
      setLoading(false);
    }
  }

  const { derived } = batch;
  const previewNotes = truncateNotes(batch.notes);

  return (
    <>
      <tr
        className="border-t border-[var(--border)] align-top"
        data-testid={`batch-row-${batch.id}`}
      >
        <td className="py-2 pr-3 font-mono whitespace-nowrap">
          {fmtBrewDate(batch.brewDate)}
        </td>
        <td className="py-2 pr-3 font-mono text-right">
          {fmtGravity(batch.measuredOg)}
        </td>
        <td className="py-2 pr-3 font-mono text-right">
          {fmtGravity(batch.measuredFg)}
        </td>
        <td className="py-2 pr-3 font-mono text-right">
          {fmtBatchVolume(batch.volumeLiters, units)}
        </td>
        <td className="py-2 pr-3 font-mono text-right">
          {fmtPercent(derived.actualAbv, 1)}
        </td>
        <td className="py-2 pr-3 font-mono text-right">
          {fmtPercent(derived.apparentAttenuation, 1)}
        </td>
        <td className="py-2 pr-3 font-mono text-right">
          {fmtPercent(derived.brewhouseEfficiency, 1)}
        </td>
        <td className="py-2 pr-3 text-[var(--muted-foreground)]">
          {previewNotes}
        </td>
        <td className="py-2 pr-3 text-right">
          <button
            type="button"
            onClick={toggleDetails}
            aria-expanded={expanded}
            aria-controls={`batch-details-${batch.id}`}
            aria-label={
              expanded ? "Hide batch details" : "Show batch details"
            }
            className="px-2 py-1 text-xs rounded border border-[var(--border)] hover:bg-[var(--muted)]"
            data-testid={`batch-toggle-${batch.id}`}
          >
            {expanded ? "Hide" : "View"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr data-testid={`batch-details-row-${batch.id}`}>
          <td
            colSpan={9}
            className="py-3 pr-3 border-t border-[var(--border)] bg-[var(--muted)]"
          >
            <BatchDetailsPanel
              loading={loading}
              error={detailsError}
              details={details ?? batch}
              units={units}
              id={batch.id}
              recipeId={recipeId}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function BatchDetailsPanel({
  loading,
  error,
  details,
  units,
  id,
  recipeId,
}: {
  loading: boolean;
  error: string | null;
  details: BatchSummary;
  units: UnitSystem;
  id: string;
  recipeId: string;
}) {
  if (error) {
    return (
      <div
        className="text-sm text-red-900"
        data-testid={`batch-details-error-${id}`}
      >
        Couldn&apos;t load details: {error}
      </div>
    );
  }
  if (loading) {
    return (
      <div
        className="text-sm text-[var(--muted-foreground)] italic"
        data-testid={`batch-details-loading-${id}`}
      >
        Refreshing from /api/batches/{id}…
      </div>
    );
  }
  return (
    <div
      className="space-y-2"
      id={`batch-details-${id}`}
      data-testid={`batch-details-${id}`}
    >
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
        <Detail label="Brew date" value={fmtBrewDate(details.brewDate)} />
        <Detail
          label="Measured OG"
          value={fmtGravity(details.measuredOg)}
        />
        <Detail
          label="Measured FG"
          value={fmtGravity(details.measuredFg)}
        />
        <Detail
          label="Volume"
          value={fmtBatchVolume(details.volumeLiters, units)}
        />
        <Detail
          label="Actual ABV"
          value={fmtPercent(details.derived.actualAbv, 1)}
        />
        <Detail
          label="Apparent attenuation"
          value={fmtPercent(details.derived.apparentAttenuation, 1)}
        />
        <Detail
          label="Brewhouse efficiency"
          value={fmtPercent(details.derived.brewhouseEfficiency, 1)}
        />
        <Detail
          label="Logged"
          value={fmtBrewDate(details.createdAt)}
        />
      </dl>
      {details.notes ? (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] mb-1">
            Notes
          </h3>
          <p className="text-sm whitespace-pre-line text-[var(--foreground)]">
            {details.notes}
          </p>
        </div>
      ) : (
        <p className="text-sm text-[var(--muted-foreground)]">
          No notes recorded for this brew.
        </p>
      )}
      <p className="text-xs text-[var(--muted-foreground)]">
        Source: <span className="font-mono">GET /api/batches/{id}</span>
      </p>
      <div>
        <Link
          href={`/recipes/${recipeId}/batches/${id}/edit`}
          className="inline-block px-3 py-1.5 rounded-md border border-[var(--border)] text-sm hover:bg-[var(--muted)] no-underline"
          data-testid={`batch-edit-link-${id}`}
        >
          Edit this brew
        </Link>
      </div>

      <div className="border-t border-[var(--border)] pt-3 mt-2">
        <FermentationTrackingSection batchId={id} />
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}

function truncateNotes(notes: string | null): string {
  if (!notes) return "—";
  const trimmed = notes.trim();
  if (trimmed.length <= NOTES_PREVIEW_LIMIT) return trimmed;
  return `${trimmed.slice(0, NOTES_PREVIEW_LIMIT).trimEnd()}…`;
}
