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

  return (
    <div className="space-y-6 max-w-2xl">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Import BeerXML</h1>
        <p className="text-[var(--muted-foreground)]">
          Upload a BeerXML 1.0 file (e.g. from BeerSmith, Brewfather, or another
          homebrew tool) to create a new recipe. The parser accepts the
          standard recipe schema; non-beer categories round-trip as best as
          the format allows.
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
    </div>
  );
}