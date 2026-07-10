// BRE-43 — share-link management UI on the owner-side recipe detail.
//
// Renders an "Enable sharing" CTA when the recipe is not shareable, and
// the absolute share URL plus a "Stop sharing" button when it is. The UI
// talks to the existing `/api/recipes/[id]/share` endpoints (no extra
// state needs to live on the page; the parent's RecipeDetail keeps the
// `shareable`/`shareUrl` shape consistent with the API).

"use client";

import { useCallback, useRef, useState, useTransition } from "react";

import {
  ClipboardGlyph,
  ShareGlyph,
} from "@/components/icons";
import type { RecipeDetail } from "@/lib/ui/types";

interface ShareLinkProps {
  recipe: RecipeDetail;
}

/** Auto-reverting "Copied" indicator. The expiry timer is held in a ref so a
 *  fast second click cancels the prior timeout cleanly. We surface a boolean
 *  `copied` rather than a timestamp, because reading Date.now() during
 *  render trips the rules-of-hooks linter. */
function useCopyFeedback() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  const cancelTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const copy = useCallback(
    async (text: string) => {
      let ok = false;
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(text);
          ok = true;
        } catch {
          // fall through to legacy selection-copy
        }
      }
      if (!ok && typeof document !== "undefined") {
        const input = document.createElement("input");
        input.value = text;
        input.setAttribute("readonly", "");
        input.style.position = "absolute";
        input.style.left = "-9999px";
        document.body.appendChild(input);
        input.select();
        try {
          ok = document.execCommand("copy");
        } finally {
          document.body.removeChild(input);
        }
      }
      if (ok) {
        setCopied(true);
        cancelTimer();
        timerRef.current = window.setTimeout(() => {
          setCopied(false);
          timerRef.current = null;
        }, 3000);
      }
    },
    [cancelTimer],
  );

  return { copy, copied };
}

export default function ShareLink({ recipe }: ShareLinkProps) {
  const initial = {
    shareable: recipe.shareable,
    shareUrl: recipe.shareUrl ?? null,
  };
  const [shareable, setShareable] = useState<boolean>(initial.shareable);
  const [shareUrl, setShareUrl] = useState<string | null>(initial.shareUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { copy, copied } = useCopyFeedback();

  const enable = useCallback(() => {
    setError(null);
    startTransition(() => {
      (async () => {
        try {
          const res = await fetch(`/api/recipes/${recipe.id}/share`, {
            method: "POST",
          });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(text || `request failed: ${res.status}`);
          }
          const body = (await res.json()) as {
            data?: { shareable?: boolean; shareUrl?: string | null };
          };
          const url = body.data?.shareUrl ?? null;
          setShareable(true);
          setShareUrl(url);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "failed to enable sharing",
          );
        }
      })();
    });
  }, [recipe.id]);

  const disable = useCallback(() => {
    setError(null);
    startTransition(() => {
      (async () => {
        try {
          const res = await fetch(`/api/recipes/${recipe.id}/share`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(text || `request failed: ${res.status}`);
          }
          setShareable(false);
          setShareUrl(null);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "failed to stop sharing",
          );
        }
      })();
    });
  }, [recipe.id]);

  return (
    <section
      aria-labelledby="share-heading"
      className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
      data-testid="share-section"
    >
      <h2
        id="share-heading"
        className="flex items-center gap-2 text-base font-semibold mb-3"
      >
        <ShareGlyph className="h-4 w-4 text-[var(--accent)]" />
        Share link
      </h2>

      {!shareable ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted-foreground)]">
            Generate a public, read-only URL for this recipe. The link shows the
            recipe detail with no edit or delete controls.
          </p>
          <button
            type="button"
            onClick={enable}
            disabled={pending}
            aria-busy={pending}
            className="px-4 py-2 rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm font-medium hover:bg-[var(--muted)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending ? "Enabling…" : "Enable sharing"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted-foreground)]">
            Anyone with this link can view the recipe — no edit or delete
            controls are exposed.
          </p>
          <div className="flex flex-wrap items-stretch gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl ?? ""}
              aria-label="Share URL"
              onFocus={(e) => e.currentTarget.select()}
              className="field field-mono flex-1 min-w-[16rem]"
              data-testid="share-url-input"
            />
            <button
              type="button"
              onClick={() => {
                if (shareUrl) void copy(shareUrl);
              }}
              className="px-4 py-2 rounded-md border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)] text-sm font-medium hover:bg-[var(--muted)]"
              aria-label="Copy share URL to clipboard"
            >
              <span className="inline-flex items-center gap-1.5">
                <ClipboardGlyph className="h-4 w-4" />
                {copied ? "Copied" : "Copy"}
              </span>
            </button>
          </div>
          <button
            type="button"
            onClick={disable}
            disabled={pending}
            aria-busy={pending}
            className="px-4 py-2 rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm font-medium hover:bg-[var(--muted)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending ? "Stopping…" : "Stop sharing"}
          </button>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 text-sm text-[var(--error-fg)]"
        >
          {error}
        </p>
      )}
    </section>
  );
}
