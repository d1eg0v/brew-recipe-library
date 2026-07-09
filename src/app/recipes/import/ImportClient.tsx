"use client";

import { useCallback, useState } from "react";

export default function ImportPage() {
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok"; id: string; title: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [fileName, setFileName] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok"; inserted: number; skipped: number; loaded: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const handleFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setStatus({ kind: "loading" });
    try {
      const text = await file.text();
      const res = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: text,
      });
      const body = (await res.json()) as
        | { data?: { id: string; title: string } }
        | { error?: { message: string; issues?: unknown } };
      if (!res.ok) {
        const msg =
          (body as { error?: { message?: string } }).error?.message ??
          `Import failed (HTTP ${res.status})`;
        setStatus({ kind: "error", message: msg });
        return;
      }
      const data = (body as { data?: { id: string; title: string } }).data;
      if (!data) {
        setStatus({ kind: "error", message: "Server returned no recipe" });
        return;
      }
      setStatus({ kind: "ok", id: data.id, title: data.title });
      // Redirect to the imported recipe so the user can review it.
      window.location.href = `/recipes/${data.id}`;
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Import failed",
      });
    }
  }, []);

  const handleBaselineSync = useCallback(async () => {
    setSyncStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/recipes/import/baseline", { method: "POST" });
      const body = (await res.json()) as
        | { data?: { inserted: number; skipped: number; loaded: number } }
        | { error?: { message: string } };
      if (!res.ok) {
        setSyncStatus({
          kind: "error",
          message:
            (body as { error?: { message?: string } }).error?.message ??
            `Baseline sync failed (HTTP ${res.status})`,
        });
        return;
      }
      const data = (body as { data?: { inserted: number; skipped: number; loaded: number } }).data;
      if (!data) {
        setSyncStatus({ kind: "error", message: "Server returned no sync report" });
        return;
      }
      setSyncStatus({ kind: "ok", ...data });
    } catch (err) {
      setSyncStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Baseline sync failed",
      });
    }
  }, []);

  return (
    <div className="space-y-6 max-w-2xl">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Import data</h1>
        <p className="text-[var(--muted-foreground)]">
          Upload a BeerXML 1.0 file or sync the curated FermentDB baseline
          recipes for beer, mead, wine, and cider.
        </p>
      </header>

      <label
        htmlFor="beerxml-file"
        className="block rounded-lg border-2 border-dashed border-[var(--border)] p-8 text-center cursor-pointer hover:border-[var(--accent)] transition-colors"
      >
        <span className="block font-medium">Choose a .xml file</span>
        <span className="block text-xs text-[var(--muted-foreground)] mt-1">
          {fileName ?? "no file selected"}
        </span>
        <input
          id="beerxml-file"
          type="file"
          accept=".xml,application/xml,text/xml"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            void handleFile(f);
          }}
        />
      </label>

      {status.kind === "loading" && (
        <div className="p-3 rounded-md border border-[var(--border)] bg-[var(--muted)] text-sm">
          Importing <span className="font-mono">{fileName}</span>…
        </div>
      )}
      {status.kind === "error" && (
        <div className="p-3 rounded-md border border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-fg)] text-sm">
          {status.message}
        </div>
      )}
      {status.kind === "ok" && (
        <div className="p-3 rounded-md border border-[var(--border)] bg-[var(--muted)] text-sm">
          Imported <strong>{status.title}</strong>. Redirecting…
        </div>
      )}

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 space-y-3">
        <div>
          <h2 className="text-base font-semibold">Baseline sync</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Adds missing curated FermentDB seed recipes without deleting your
            existing library.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handleBaselineSync()}
          disabled={syncStatus.kind === "loading"}
        >
          {syncStatus.kind === "loading" ? "Syncing…" : "Sync baseline"}
        </button>
        {syncStatus.kind === "error" && (
          <div className="p-3 rounded-md border border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-fg)] text-sm">
            {syncStatus.message}
          </div>
        )}
        {syncStatus.kind === "ok" && (
          <div className="p-3 rounded-md border border-[var(--border)] bg-[var(--muted)] text-sm">
            Synced {syncStatus.inserted} new recipe
            {syncStatus.inserted === 1 ? "" : "s"}; {syncStatus.skipped} already
            present from {syncStatus.loaded} baseline entries.
          </div>
        )}
      </section>
    </div>
  );
}
