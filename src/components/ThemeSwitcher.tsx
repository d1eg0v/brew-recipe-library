"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  DEFAULT_THEME,
  STORAGE_KEY,
  THEMES,
  isThemeId,
  type ThemeId,
} from "@/lib/theme/themes";

function readAppliedTheme(): ThemeId {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const attr = document.documentElement.getAttribute("data-theme");
  return isThemeId(attr) ? attr : DEFAULT_THEME;
}

export default function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ThemeId>(() => readAppliedTheme());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  // Close the menu when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function applyTheme(next: ThemeId) {
    setActive(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage failures (private mode / quota); the visual choice still applies for this session.
    }
    setOpen(false);
    buttonRef.current?.focus();
  }

  const current = THEMES.find((t) => t.id === active) ?? THEMES[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
      >
        <span
          aria-hidden
          className="inline-flex h-4 w-4 overflow-hidden rounded-full border border-[var(--border)]"
        >
          <span
            className="block h-full w-1/2"
            style={{ background: "var(--swatch-bg)" }}
          />
          <span
            className="block h-full w-1/2"
            style={{ background: "var(--swatch-accent)" }}
          />
        </span>
        <span className="font-medium">{current.label}</span>
        <span aria-hidden className="text-[var(--muted-foreground)]">▾</span>
      </button>
      {open && (
        <ul
          id={menuId}
          role="listbox"
          aria-label="Color theme"
          className="absolute right-0 mt-2 w-64 rounded-md border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden z-20"
        >
          {THEMES.map((theme) => {
            const selected = theme.id === active;
            return (
              <li key={theme.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => applyTheme(theme.id)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 text-sm hover:bg-[var(--muted)] ${
                    selected ? "bg-[var(--muted)]" : ""
                  }`}
                >
                  <span
                    aria-hidden
                    className="inline-flex h-5 w-8 overflow-hidden rounded border border-[var(--border)] shrink-0"
                  >
                    <span
                      className="block h-full w-2/3"
                      style={{
                        background:
                          theme.id === "light" || theme.id === "sepia"
                            ? "var(--background)"
                            : theme.id === "dark"
                              ? "#14110b"
                              : "#0b1322",
                      }}
                    />
                    <span
                      className="block h-full w-1/3"
                      style={{
                        background:
                          theme.id === "light"
                            ? "#8b3a13"
                            : theme.id === "sepia"
                              ? "#a05a2c"
                              : theme.id === "dark"
                                ? "#d48137"
                                : "#f0b86e",
                      }}
                    />
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium text-[var(--foreground)]">
                      {theme.label}
                      {selected ? (
                        <span
                          aria-hidden
                          className="ml-2 text-xs text-[var(--accent)]"
                        >
                          ✓
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-xs text-[var(--muted-foreground)]">
                      {theme.description}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}