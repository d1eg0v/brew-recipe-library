"use client";

import { useEffect, useRef, useState } from "react";

import {
  DEFAULT_UNIT_SYSTEM,
  STORAGE_KEY,
  UNITS_CHANGE_EVENT,
  isUnitSystem,
  type UnitSystem,
} from "@/lib/units/units";

const OPTIONS: ReadonlyArray<{ id: UnitSystem; label: string; hint: string }> =
  [
    { id: "metric", label: "Metric", hint: "kg · L · °C" },
    { id: "imperial", label: "Imperial", hint: "lb · gal · °F" },
  ];

function readAppliedUnits(): UnitSystem {
  if (typeof document === "undefined") return DEFAULT_UNIT_SYSTEM;
  const attr = document.documentElement.getAttribute("data-units");
  return isUnitSystem(attr) ? attr : DEFAULT_UNIT_SYSTEM;
}

export default function UnitToggle() {
  // Initial state must match the server-rendered HTML to avoid a hydration
  // mismatch. The boot script in `src/lib/units/bootScript.ts` may have set
  // `data-units` on <html> to the user's stored preference before React
  // hydrates; reading from `document` here would diverge from the SSR output
  // (which has no `document`). Defer that read to an effect so the first
  // client paint matches what the server sent. Same pattern as
  // `src/components/ThemeSwitcher.tsx` (BRE-22).
  const [active, setActive] = useState<UnitSystem>(DEFAULT_UNIT_SYSTEM);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(readAppliedUnits());
  }, []);

  function applyUnits(next: UnitSystem) {
    if (next === active) return;
    setActive(next);
    document.documentElement.setAttribute("data-units", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage failures (private mode / quota); the visual choice
      // still applies for this session via the data-units attribute.
    }
    window.dispatchEvent(
      new CustomEvent(UNITS_CHANGE_EVENT, { detail: next }),
    );
    containerRef.current?.querySelector<HTMLButtonElement>(
      `button[data-units-option="${next}"]`,
    )?.focus();
  }

  return (
    <div
      ref={containerRef}
      className="inline-flex rounded-md border border-[var(--border)] overflow-hidden"
      role="group"
      aria-label="Unit system"
    >
      {OPTIONS.map((opt, i) => {
        const selected = opt.id === active;
        return (
          <button
            key={opt.id}
            type="button"
            data-units-option={opt.id}
            onClick={() => applyUnits(opt.id)}
            aria-pressed={selected}
            title={opt.hint}
            className={`px-2.5 py-1.5 text-sm font-medium ${
              i > 0 ? "border-l border-[var(--border)]" : ""
            } ${
              selected
                ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}