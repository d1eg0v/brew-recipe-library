// Client-side validation for the batch (brew-log) form.
//
// Reuses the server-side Zod schemas as the single source of truth so the
// client never diverges from what the API will accept. The form is
// deliberately small — brew date plus four optional measurements — and
// represents a separate page from the recipe form, so this module is
// self-contained rather than shared with `components/recipe/validation.ts`.

import {
  batchCreateSchema,
  type BatchCreateBody,
} from "@/lib/api/schemas";

/** Form state the user edits in the browser. */
export interface BatchFormState {
  brewDate: string; // ISO datetime string, or "" while empty
  measuredOg: string; // numeric input, kept as string for editability
  measuredFg: string;
  volumeLiters: string;
  notes: string;
}

/** Map of dotted-path -> first error message. */
export type FormErrors = Record<string, string>;

export function blankBatchFormState(): BatchFormState {
  return {
    brewDate: defaultBrewDate(),
    measuredOg: "",
    measuredFg: "",
    volumeLiters: "",
    notes: "",
  };
}

/** ISO yyyy-mm-dd for "today" (local date) — convenient default for new brews. */
export function defaultBrewDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parse an optional numeric input.
 * Returns `null` when the field is blank (so it's omitted from the body).
 * Throws `NaN` (via `Number.parseFloat`'s contract) on garbage — callers
 * must pre-check `Number.isFinite`.
 */
function parseOptionalFloat(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return Number.parseFloat(trimmed);
}

function trimOrUndefined(v: string): string | undefined {
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Convert the form state into the body shape the server-side Zod schema
 * expects. Strips blank optional fields; rounds numeric values for
 * transmission.
 */
export function toCreateBody(state: BatchFormState): BatchCreateBody {
  const body: Record<string, unknown> = {};
  body.brewDate = state.brewDate;

  const og = parseOptionalFloat(state.measuredOg);
  if (og != null) body.measuredOg = og;

  const fg = parseOptionalFloat(state.measuredFg);
  if (fg != null) body.measuredFg = fg;

  const vol = parseOptionalFloat(state.volumeLiters);
  if (vol != null) body.volumeLiters = vol;

  const notes = trimOrUndefined(state.notes);
  if (notes != null) body.notes = notes;

  return body as unknown as BatchCreateBody;
}

/** Map a Zod issue path (e.g. "measuredOg") to a key. */
function issuePathToKey(path: ReadonlyArray<PropertyKey>): string {
  return path
    .map((p) => (typeof p === "symbol" ? "" : String(p)))
    .filter((p) => p.length > 0)
    .join(".");
}

/**
 * Validate a batch form state by running the server-side schema and returning
 * a `{ ok, errors, body }` tuple. `body` is the normalised submission payload
 * ready to POST — undefined when validation failed.
 */
export function validateBatchForm(state: BatchFormState): {
  ok: boolean;
  errors: FormErrors;
  body?: BatchCreateBody;
} {
  const errors: FormErrors = {};

  if (!state.brewDate.trim()) {
    errors["brewDate"] = "Brew date is required.";
  }

  // Surface obviously unparseable numbers up-front so the user sees a clear
  // message instead of Zod's "Expected number".
  for (const field of ["measuredOg", "measuredFg", "volumeLiters"] as const) {
    const raw = state[field];
    if (raw.trim() === "") continue;
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) {
      errors[field] = "Must be a number.";
    }
  }

  const body = toCreateBody(state);
  const parsed = batchCreateSchema.safeParse(body);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issuePathToKey(issue.path);
      if (key && !(key in errors)) {
        errors[key] = issue.message;
      }
    }
  }

  return Object.keys(errors).length === 0
    ? { ok: true, errors, body }
    : { ok: false, errors };
}
