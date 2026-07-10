"use client";

// Recipe create/edit form.
//
// Handles both modes (`mode="create"` for /recipes/new, `mode="edit"` for
// /recipes/[id]/edit), including all six nested lists (fermentables, hops,
// yeasts, mash steps, process steps, additions) with add/remove and live
// OG/FG/ABV/IBU/SRM preview wired to `computeTargets`.

import { useRouter } from "next/navigation";
import {
  useCallback,
  useMemo,
  useState,
} from "react";

import { RECIPE_CATEGORIES } from "@/lib/api/schemas";
import type { RecipeDetail } from "@/lib/ui/types";
import {
  fmtGravity,
  fmtNumber,
  fmtPercent,
} from "@/lib/ui/format";

import {
  blankRecipeFormState,
  emptyAddition,
  emptyFermentable,
  emptyHop,
  emptyMashStep,
  emptyProcessStep,
  emptyYeast,
  newRowKey,
  type AdditionRowState,
  type FermentableRowState,
  type HopRowState,
  type MashStepRowState,
  type ProcessStepRowState,
  type RecipeFormState,
  type YeastRowState,
} from "./recipeFormState";
import {
  validateRecipeForm,
  type FormErrors,
} from "./validation";
import { computeLiveTargets } from "./liveTargets";

interface RecipeFormProps {
  mode: "create" | "edit";
  initial?: RecipeDetail;
}

export default function RecipeForm({ mode, initial }: RecipeFormProps) {
  const router = useRouter();
  const initialState = useMemo<RecipeFormState>(
    () => (initial ? fromRecipeDetail(initial) : blankRecipeFormState()),
    [initial],
  );
  const [state, setState] = useState<RecipeFormState>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const targets = useMemo(() => computeLiveTargets(state), [state]);

  const update = useCallback(
    <K extends keyof RecipeFormState>(key: K, value: RecipeFormState[K]) => {
      setState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const updateRow = useCallback(
    <T, K extends keyof T>(listKey: keyof RecipeFormState, rowKey: string, field: K, value: T[K]) => {
      setState((prev) => {
        const list = prev[listKey] as T[];
        const next = list.map((row) =>
          (row as T & { key: string }).key === rowKey
            ? { ...row, [field]: value }
            : row,
        );
        return { ...prev, [listKey]: next };
      });
    },
    [],
  );

  const addRow = useCallback(
    (listKey: keyof RecipeFormState, factory: () => unknown) => {
      setState((prev) => {
        const list = prev[listKey] as Array<{ key: string }>;
        const next = [...list, factory() as { key: string }];
        return { ...prev, [listKey]: next };
      });
    },
    [],
  );

  const removeRow = useCallback(
    (listKey: keyof RecipeFormState, rowKey: string) => {
      setState((prev) => {
        const list = prev[listKey] as Array<{ key: string }>;
        const next = list.filter((row) => row.key !== rowKey);
        return { ...prev, [listKey]: next };
      });
    },
    [],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setErrors({});

    const result = validateRecipeForm(state);
    if (!result.ok) {
      setErrors(result.errors);
      // focus first errored field if present
      const firstKey = Object.keys(result.errors)[0];
      if (firstKey && typeof document !== "undefined") {
        const el = document.querySelector<HTMLElement>(`[data-field-path="${firstKey}"]`);
        el?.focus();
      }
      return;
    }

    setSubmitting(true);
    try {
      const url = mode === "create" ? "/api/recipes" : `/api/recipes/${initial!.id}`;
      const init: RequestInit = {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(result.body),
      };
      const res = await fetch(url, init);
      const payload = (await res.json().catch(() => null)) as
        | { data?: { id?: string }; error?: { message?: string; issues?: { path?: string; message: string }[] } }
        | null;
      if (!res.ok) {
        const message = payload?.error?.message ?? `Request failed (${res.status}).`;
        const issues = payload?.error?.issues ?? [];
        if (issues.length > 0) {
          const next: FormErrors = {};
          for (const issue of issues) {
            const path = (issue.path ?? "").replace(/^\.?/, "");
            if (path && !(path in next)) next[path] = issue.message;
          }
          setErrors(next);
        }
        setSubmitError(message);
        return;
      }
      const id = payload?.data?.id ?? initial?.id;
      if (!id) {
        setSubmitError("Saved, but the server did not return a recipe id.");
        return;
      }
      router.push(`/recipes/${id}`);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-8"
      aria-busy={submitting}
    >
      {submitError && (
        <div
          role="alert"
          className="p-3 rounded-md border border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-fg)] text-sm"
        >
          {submitError}
        </div>
      )}

      <MetaSection
        state={state}
        update={update}
        errors={errors}
      />

      <TargetsSection
        state={state}
        update={update}
        errors={errors}
        live={targets}
      />

      <FermentablesSection
        rows={state.fermentables}
        errors={errors}
        onAdd={() => addRow("fermentables", emptyFermentable)}
        onChange={(key, field, value) =>
          updateRow<FermentableRowState, keyof FermentableRowState>("fermentables", key, field as keyof FermentableRowState, value as never)
        }
        onRemove={(key) => removeRow("fermentables", key)}
      />

      <HopsSection
        rows={state.hops}
        errors={errors}
        onAdd={() => addRow("hops", emptyHop)}
        onChange={(key, field, value) =>
          updateRow<HopRowState, keyof HopRowState>("hops", key, field as keyof HopRowState, value as never)
        }
        onRemove={(key) => removeRow("hops", key)}
      />

      <YeastsSection
        rows={state.yeasts}
        errors={errors}
        onAdd={() => addRow("yeasts", emptyYeast)}
        onChange={(key, field, value) =>
          updateRow<YeastRowState, keyof YeastRowState>("yeasts", key, field as keyof YeastRowState, value as never)
        }
        onRemove={(key) => removeRow("yeasts", key)}
      />

      <MashStepsSection
        rows={state.mashSteps}
        errors={errors}
        onAdd={() => addRow("mashSteps", emptyMashStep)}
        onChange={(key, field, value) =>
          updateRow<MashStepRowState, keyof MashStepRowState>("mashSteps", key, field as keyof MashStepRowState, value as never)
        }
        onRemove={(key) => removeRow("mashSteps", key)}
      />

      <ProcessStepsSection
        rows={state.processSteps}
        errors={errors}
        onAdd={() => addRow("processSteps", emptyProcessStep)}
        onChange={(key, field, value) =>
          updateRow<ProcessStepRowState, keyof ProcessStepRowState>("processSteps", key, field as keyof ProcessStepRowState, value as never)
        }
        onRemove={(key) => removeRow("processSteps", key)}
      />

      <AdditionsSection
        rows={state.additions}
        errors={errors}
        onAdd={() => addRow("additions", emptyAddition)}
        onChange={(key, field, value) =>
          updateRow<AdditionRowState, keyof AdditionRowState>("additions", key, field as keyof AdditionRowState, value as never)
        }
        onRemove={(key) => removeRow("additions", key)}
      />

      <FormActions
        mode={mode}
        submitting={submitting}
        onCancel={() => {
          if (mode === "edit" && initial) router.push(`/recipes/${initial.id}`);
          else router.push("/");
        }}
      />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

function MetaSection({
  state,
  update,
  errors,
}: {
  state: RecipeFormState;
  update: <K extends keyof RecipeFormState>(key: K, value: RecipeFormState[K]) => void;
  errors: FormErrors;
}) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
      <h2 className="text-base font-semibold">Recipe details</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Title"
          required
          error={errors["title"]}
          fieldPath="title"
        >
          <input
            type="text"
            value={state.title}
            onChange={(e) => update("title", e.target.value)}
            maxLength={200}
            required
            className={inputClass}
            data-field-path="title"
            placeholder="e.g. Cascade SMaSH"
          />
        </Field>

        <Field label="Author" error={errors["author"]} fieldPath="author">
          <input
            type="text"
            value={state.author}
            onChange={(e) => update("author", e.target.value)}
            maxLength={200}
            className={inputClass}
            data-field-path="author"
            placeholder="Optional"
          />
        </Field>

        <Field label="Category" required error={errors["category"]} fieldPath="category">
          <select
            value={state.category}
            onChange={(e) => update("category", e.target.value as RecipeFormState["category"])}
            className={inputClass}
            data-field-path="category"
          >
            <option value="">Select…</option>
            {RECIPE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Style name" error={errors["styleName"]} fieldPath="styleName">
          <input
            type="text"
            value={state.styleName}
            onChange={(e) => update("styleName", e.target.value)}
            maxLength={200}
            className={inputClass}
            data-field-path="styleName"
            placeholder="e.g. American IPA"
          />
        </Field>

        <Field
          label="BJCP category"
          error={errors["bjcpCategory"]}
          fieldPath="bjcpCategory"
        >
          <input
            type="text"
            value={state.bjcpCategory}
            onChange={(e) => update("bjcpCategory", e.target.value)}
            maxLength={20}
            className={inputClass}
            data-field-path="bjcpCategory"
            placeholder="e.g. 21A"
          />
        </Field>

        <Field
          label="Batch size (litres)"
          required
          error={errors["batchSizeLiters"]}
          fieldPath="batchSizeLiters"
        >
          <input
            type="number"
            value={numValue(state.batchSizeLiters)}
            onChange={(e) => {
              const raw = e.target.value;
              const next = raw.trim() === "" ? 0 : Number.parseFloat(raw);
              update("batchSizeLiters", Number.isFinite(next) ? next : 0);
            }}
            min={0.1}
            step={0.1}
            required
            className={inputClass}
            data-field-path="batchSizeLiters"
          />
        </Field>

        <Field
          label="Boil time (minutes)"
          error={errors["boilTimeMinutes"]}
          fieldPath="boilTimeMinutes"
        >
          <input
            type="number"
            value={numValue(state.boilTimeMinutes)}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw.trim() === "") {
                update("boilTimeMinutes", null);
                return;
              }
              const parsed = Number.parseInt(raw, 10);
              update("boilTimeMinutes", Number.isFinite(parsed) ? parsed : null);
            }}
            min={0}
            step={1}
            className={inputClass}
            data-field-path="boilTimeMinutes"
          />
        </Field>

        <Field
          label="Brewhouse efficiency (%)"
          error={errors["efficiencyPct"]}
          fieldPath="efficiencyPct"
        >
          <input
            type="number"
            value={numValue(state.efficiencyPct)}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw.trim() === "") {
                update("efficiencyPct", null);
                return;
              }
              const parsed = Number.parseFloat(raw);
              update("efficiencyPct", Number.isFinite(parsed) ? parsed : null);
            }}
            min={0}
            max={100}
            step={0.1}
            className={inputClass}
            data-field-path="efficiencyPct"
          />
        </Field>
      </div>

      <Field
        label="Description"
        error={errors["description"]}
        fieldPath="description"
      >
        <textarea
          value={state.description}
          onChange={(e) => update("description", e.target.value)}
          rows={3}
          maxLength={5000}
          className={inputClass}
          data-field-path="description"
        />
      </Field>

      <Field
        label="Brewer's notes"
        error={errors["notes"]}
        fieldPath="notes"
      >
        <textarea
          value={state.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={4}
          maxLength={10000}
          className={inputClass}
          data-field-path="notes"
        />
      </Field>
    </section>
  );
}

interface TargetsSectionProps {
  state: RecipeFormState;
  update: <K extends keyof RecipeFormState>(key: K, value: RecipeFormState[K]) => void;
  errors: FormErrors;
  live: ReturnType<typeof computeLiveTargets>;
}

function TargetsSection({
  state,
  update,
  errors,
  live,
}: TargetsSectionProps) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
      <h2 className="text-base font-semibold">Target measurements</h2>
      <p className="text-xs text-[var(--muted-foreground)]">
        Optional. Leave blank to let the live preview fill in the values for you.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <TargetInput
          label="OG"
          fieldPath="targetOg"
          error={errors["targetOg"]}
          value={state.targetOg}
          onChange={(v) => update("targetOg", v)}
          step={0.001}
          min={0.95}
          max={1.2}
          placeholder={live.og != null ? live.og.toFixed(3) : "auto"}
        />
        <TargetInput
          label="FG"
          fieldPath="targetFg"
          error={errors["targetFg"]}
          value={state.targetFg}
          onChange={(v) => update("targetFg", v)}
          step={0.001}
          min={0.95}
          max={1.2}
          placeholder={live.fg != null ? live.fg.toFixed(3) : "auto"}
        />
        <TargetInput
          label="ABV %"
          fieldPath="targetAbv"
          error={errors["targetAbv"]}
          value={state.targetAbv}
          onChange={(v) => update("targetAbv", v)}
          step={0.1}
          min={0}
          max={25}
          placeholder={
            live.abv != null ? `${live.abv.toFixed(1)}` : "auto"
          }
        />
        <TargetInput
          label="pH"
          fieldPath="targetPh"
          error={errors["targetPh"]}
          value={state.targetPh}
          onChange={(v) => update("targetPh", v)}
          step={0.01}
          min={2}
          max={7}
          placeholder="target"
        />
        <TargetInput
          label="IBU"
          fieldPath="targetIbu"
          error={errors["targetIbu"]}
          value={state.targetIbu}
          onChange={(v) => update("targetIbu", v)}
          step={1}
          min={0}
          max={200}
          placeholder={live.ibu != null ? String(Math.round(live.ibu)) : "auto"}
        />
        <TargetInput
          label="SRM"
          fieldPath="targetSrm"
          error={errors["targetSrm"]}
          value={state.targetSrm}
          onChange={(v) => update("targetSrm", v)}
          step={0.1}
          min={0}
          max={80}
          placeholder={live.srm != null ? live.srm.toFixed(1) : "auto"}
        />
      </div>

      <div
        className="grid grid-cols-2 sm:grid-cols-5 gap-4 rounded-md border border-dashed border-[var(--border)] p-4"
        data-testid="live-preview"
        aria-live="polite"
      >
        <PreviewCell label="OG" value={live.og != null ? fmtGravity(live.og) : "—"} />
        <PreviewCell label="FG" value={live.fg != null ? fmtGravity(live.fg) : "—"} />
        <PreviewCell
          label="ABV"
          value={live.abv != null ? fmtPercent(live.abv, 1) : "—"}
        />
        <PreviewCell
          label="IBU"
          value={live.ibu != null ? fmtNumber(live.ibu, 0) : "—"}
        />
        <PreviewCell
          label="SRM"
          value={live.srm != null ? fmtNumber(live.srm, 1) : "—"}
        />
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">
        Live preview is computed from the fermentables, hops, and yeast you enter
        (Tinseth for IBU, Morey for SRM). Targets above override the preview when
        set.
      </p>
    </section>
  );
}

function FermentablesSection({
  rows,
  errors,
  onAdd,
  onChange,
  onRemove,
}: {
  rows: FermentableRowState[];
  errors: FormErrors;
  onAdd: () => void;
  onChange: (key: string, field: keyof FermentableRowState, value: unknown) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <ListSection
      title="Fermentables"
      description="Grain bill, extract, sugar, honey, juice, or fruit. Enter either kg (solids) or litres (liquids)."
      errorCount={countListErrors(errors, "fermentables")}
      onAdd={onAdd}
      addLabel="Add fermentable"
      emptyHint="No fermentables yet — add at least one to enable the live preview."
      rows={rows}
      renderRow={(row) => (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-start">
          <Field
            label="Name"
            required
            error={errors[`fermentables.${rowIndex(rows, row.key)}.name`]}
            fieldPath={`fermentables.${rowIndex(rows, row.key)}.name`}
          >
            <input
              type="text"
              value={row.name}
              onChange={(e) => onChange(row.key, "name", e.target.value)}
              className={inputClass}
              maxLength={200}
              required
              data-field-path={`fermentables.${rowIndex(rows, row.key)}.name`}
            />
          </Field>
          <Field
            label="Type"
            error={errors[`fermentables.${rowIndex(rows, row.key)}.type`]}
            fieldPath={`fermentables.${rowIndex(rows, row.key)}.type`}
          >
            <select
              value={row.type}
              onChange={(e) => onChange(row.key, "type", e.target.value)}
              className={inputClass}
              data-field-path={`fermentables.${rowIndex(rows, row.key)}.type`}
            >
              <option value="">—</option>
              <option value="grain">Grain</option>
              <option value="extract">Extract</option>
              <option value="sugar">Sugar</option>
              <option value="adjunct">Adjunct</option>
              <option value="honey">Honey</option>
              <option value="juice">Juice</option>
              <option value="concentrate">Concentrate</option>
              <option value="fruit">Fruit</option>
              <option value="must">Must</option>
            </select>
          </Field>
          <Field
            label="Amount (kg)"
            error={errors[`fermentables.${rowIndex(rows, row.key)}.amountKg`]}
            fieldPath={`fermentables.${rowIndex(rows, row.key)}.amountKg`}
          >
            <input
              type="number"
              value={numValue(row.amountKg)}
              onChange={(e) => {
                const v = e.target.value.trim() === "" ? null : Number.parseFloat(e.target.value);
                onChange(row.key, "amountKg", Number.isFinite(v as number) ? v : null);
              }}
              min={0}
              step={0.001}
              className={inputClass}
              data-field-path={`fermentables.${rowIndex(rows, row.key)}.amountKg`}
            />
          </Field>
          <Field
            label="Amount (L)"
            error={errors[`fermentables.${rowIndex(rows, row.key)}.amountLiters`]}
            fieldPath={`fermentables.${rowIndex(rows, row.key)}.amountLiters`}
          >
            <input
              type="number"
              value={numValue(row.amountLiters)}
              onChange={(e) => {
                const v = e.target.value.trim() === "" ? null : Number.parseFloat(e.target.value);
                onChange(row.key, "amountLiters", Number.isFinite(v as number) ? v : null);
              }}
              min={0}
              step={0.001}
              className={inputClass}
              data-field-path={`fermentables.${rowIndex(rows, row.key)}.amountLiters`}
            />
          </Field>
          <Field
            label="°L"
            error={errors[`fermentables.${rowIndex(rows, row.key)}.colorLovibond`]}
            fieldPath={`fermentables.${rowIndex(rows, row.key)}.colorLovibond`}
          >
            <input
              type="number"
              value={numValue(row.colorLovibond)}
              onChange={(e) => {
                const v = e.target.value.trim() === "" ? null : Number.parseFloat(e.target.value);
                onChange(row.key, "colorLovibond", Number.isFinite(v as number) ? v : null);
              }}
              min={0}
              step={0.1}
              className={inputClass}
              data-field-path={`fermentables.${rowIndex(rows, row.key)}.colorLovibond`}
            />
          </Field>
          <Field
            label="PPG"
            error={errors[`fermentables.${rowIndex(rows, row.key)}.potentialPpg`]}
            fieldPath={`fermentables.${rowIndex(rows, row.key)}.potentialPpg`}
          >
            <input
              type="number"
              value={numValue(row.potentialPpg)}
              onChange={(e) => {
                const v = e.target.value.trim() === "" ? null : Number.parseFloat(e.target.value);
                onChange(row.key, "potentialPpg", Number.isFinite(v as number) ? v : null);
              }}
              min={0}
              step={0.1}
              className={inputClass}
              data-field-path={`fermentables.${rowIndex(rows, row.key)}.potentialPpg`}
            />
          </Field>
          <Field
            label="Notes"
            error={errors[`fermentables.${rowIndex(rows, row.key)}.notes`]}
            fieldPath={`fermentables.${rowIndex(rows, row.key)}.notes`}
            className="md:col-span-5"
          >
            <input
              type="text"
              value={row.notes}
              onChange={(e) => onChange(row.key, "notes", e.target.value)}
              maxLength={10000}
              className={inputClass}
              data-field-path={`fermentables.${rowIndex(rows, row.key)}.notes`}
            />
          </Field>
        </div>
      )}
      onRemove={onRemove}
      getRowKey={(row) => row.key}
    />
  );
}

function HopsSection({
  rows,
  errors,
  onAdd,
  onChange,
  onRemove,
}: {
  rows: HopRowState[];
  errors: FormErrors;
  onAdd: () => void;
  onChange: (key: string, field: keyof HopRowState, value: unknown) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <ListSection
      title="Hops"
      description="Boil, first-wort, whirlpool, dry-hop additions."
      errorCount={countListErrors(errors, "hops")}
      onAdd={onAdd}
      addLabel="Add hop"
      emptyHint="No hops added."
      rows={rows}
      renderRow={(row) => (
        <div className="grid grid-cols-2 md:grid-cols-8 gap-3 items-start">
          <Field
            label="Name"
            required
            error={errors[`hops.${rowIndex(rows, row.key)}.name`]}
            fieldPath={`hops.${rowIndex(rows, row.key)}.name`}
          >
            <input
              type="text"
              value={row.name}
              onChange={(e) => onChange(row.key, "name", e.target.value)}
              maxLength={200}
              required
              className={inputClass}
              data-field-path={`hops.${rowIndex(rows, row.key)}.name`}
            />
          </Field>
          <Field
            label="Amount (g)"
            required
            error={errors[`hops.${rowIndex(rows, row.key)}.amountGrams`]}
            fieldPath={`hops.${rowIndex(rows, row.key)}.amountGrams`}
          >
            <input
              type="number"
              value={numValue(row.amountGrams)}
              onChange={(e) => {
                const v = e.target.value.trim() === "" ? null : Number.parseFloat(e.target.value);
                onChange(row.key, "amountGrams", Number.isFinite(v as number) ? v : null);
              }}
              min={0}
              step={0.1}
              required
              className={inputClass}
              data-field-path={`hops.${rowIndex(rows, row.key)}.amountGrams`}
            />
          </Field>
          <Field
            label="Time"
            required
            error={errors[`hops.${rowIndex(rows, row.key)}.timeMinutes`]}
            fieldPath={`hops.${rowIndex(rows, row.key)}.timeMinutes`}
          >
            <input
              type="number"
              value={numValue(row.timeMinutes)}
              onChange={(e) => {
                const v = e.target.value.trim() === "" ? null : Number.parseFloat(e.target.value);
                onChange(row.key, "timeMinutes", Number.isFinite(v as number) ? v : null);
              }}
              min={0}
              step={1}
              required
              className={inputClass}
              data-field-path={`hops.${rowIndex(rows, row.key)}.timeMinutes`}
            />
          </Field>
          <Field
            label="α-acid %"
            error={errors[`hops.${rowIndex(rows, row.key)}.alphaAcidPct`]}
            fieldPath={`hops.${rowIndex(rows, row.key)}.alphaAcidPct`}
          >
            <input
              type="number"
              value={numValue(row.alphaAcidPct)}
              onChange={(e) => {
                const v = e.target.value.trim() === "" ? null : Number.parseFloat(e.target.value);
                onChange(row.key, "alphaAcidPct", Number.isFinite(v as number) ? v : null);
              }}
              min={0}
              max={30}
              step={0.1}
              className={inputClass}
              data-field-path={`hops.${rowIndex(rows, row.key)}.alphaAcidPct`}
            />
          </Field>
          <Field
            label="Use"
            error={errors[`hops.${rowIndex(rows, row.key)}.use`]}
            fieldPath={`hops.${rowIndex(rows, row.key)}.use`}
          >
            <select
              value={row.use}
              onChange={(e) => onChange(row.key, "use", e.target.value)}
              className={inputClass}
              data-field-path={`hops.${rowIndex(rows, row.key)}.use`}
            >
              <option value="">—</option>
              <option value="boil">Boil</option>
              <option value="firstWort">First wort</option>
              <option value="whirlpool">Whirlpool</option>
              <option value="dryHop">Dry hop</option>
              <option value="mash">Mash</option>
            </select>
          </Field>
          <Field
            label="Form"
            error={errors[`hops.${rowIndex(rows, row.key)}.form`]}
            fieldPath={`hops.${rowIndex(rows, row.key)}.form`}
          >
            <select
              value={row.form}
              onChange={(e) => onChange(row.key, "form", e.target.value)}
              className={inputClass}
              data-field-path={`hops.${rowIndex(rows, row.key)}.form`}
            >
              <option value="">—</option>
              <option value="pellet">Pellet</option>
              <option value="leaf">Leaf</option>
              <option value="plug">Plug</option>
              <option value="extract">Extract</option>
            </select>
          </Field>
          <Field
            label="Notes"
            error={errors[`hops.${rowIndex(rows, row.key)}.notes`]}
            fieldPath={`hops.${rowIndex(rows, row.key)}.notes`}
            className="md:col-span-6"
          >
            <input
              type="text"
              value={row.notes}
              onChange={(e) => onChange(row.key, "notes", e.target.value)}
              maxLength={10000}
              className={inputClass}
              data-field-path={`hops.${rowIndex(rows, row.key)}.notes`}
            />
          </Field>
        </div>
      )}
      onRemove={onRemove}
      getRowKey={(row) => row.key}
    />
  );
}

function YeastsSection({
  rows,
  errors,
  onAdd,
  onChange,
  onRemove,
}: {
  rows: YeastRowState[];
  errors: FormErrors;
  onAdd: () => void;
  onChange: (key: string, field: keyof YeastRowState, value: unknown) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <ListSection
      title="Yeast"
      errorCount={countListErrors(errors, "yeasts")}
      onAdd={onAdd}
      addLabel="Add yeast"
      emptyHint="No yeast recorded."
      rows={rows}
      renderRow={(row) => (
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3 items-start">
          <Field
            label="Name"
            required
            error={errors[`yeasts.${rowIndex(rows, row.key)}.name`]}
            fieldPath={`yeasts.${rowIndex(rows, row.key)}.name`}
          >
            <input
              type="text"
              value={row.name}
              onChange={(e) => onChange(row.key, "name", e.target.value)}
              maxLength={200}
              required
              className={inputClass}
              data-field-path={`yeasts.${rowIndex(rows, row.key)}.name`}
            />
          </Field>
          <Field
            label="Lab"
            error={errors[`yeasts.${rowIndex(rows, row.key)}.laboratory`]}
            fieldPath={`yeasts.${rowIndex(rows, row.key)}.laboratory`}
          >
            <input
              type="text"
              value={row.laboratory}
              onChange={(e) => onChange(row.key, "laboratory", e.target.value)}
              maxLength={200}
              className={inputClass}
              data-field-path={`yeasts.${rowIndex(rows, row.key)}.laboratory`}
            />
          </Field>
          <Field
            label="Code"
            error={errors[`yeasts.${rowIndex(rows, row.key)}.productId`]}
            fieldPath={`yeasts.${rowIndex(rows, row.key)}.productId`}
          >
            <input
              type="text"
              value={row.productId}
              onChange={(e) => onChange(row.key, "productId", e.target.value)}
              maxLength={100}
              className={inputClass}
              data-field-path={`yeasts.${rowIndex(rows, row.key)}.productId`}
            />
          </Field>
          <Field
            label="Type"
            error={errors[`yeasts.${rowIndex(rows, row.key)}.type`]}
            fieldPath={`yeasts.${rowIndex(rows, row.key)}.type`}
          >
            <select
              value={row.type}
              onChange={(e) => onChange(row.key, "type", e.target.value)}
              className={inputClass}
              data-field-path={`yeasts.${rowIndex(rows, row.key)}.type`}
            >
              <option value="">—</option>
              <option value="ale">Ale</option>
              <option value="lager">Lager</option>
              <option value="wheat">Wheat</option>
              <option value="wine">Wine</option>
              <option value="champagne">Champagne</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field
            label="Form"
            error={errors[`yeasts.${rowIndex(rows, row.key)}.form`]}
            fieldPath={`yeasts.${rowIndex(rows, row.key)}.form`}
          >
            <select
              value={row.form}
              onChange={(e) => onChange(row.key, "form", e.target.value)}
              className={inputClass}
              data-field-path={`yeasts.${rowIndex(rows, row.key)}.form`}
            >
              <option value="">—</option>
              <option value="dry">Dry</option>
              <option value="liquid">Liquid</option>
              <option value="slant">Slant</option>
              <option value="culture">Culture</option>
            </select>
          </Field>
          <Field
            label="Att. %"
            error={errors[`yeasts.${rowIndex(rows, row.key)}.attenuationPct`]}
            fieldPath={`yeasts.${rowIndex(rows, row.key)}.attenuationPct`}
          >
            <input
              type="number"
              value={numValue(row.attenuationPct)}
              onChange={(e) => {
                const v = e.target.value.trim() === "" ? null : Number.parseFloat(e.target.value);
                onChange(row.key, "attenuationPct", Number.isFinite(v as number) ? v : null);
              }}
              min={0}
              max={100}
              step={0.1}
              className={inputClass}
              data-field-path={`yeasts.${rowIndex(rows, row.key)}.attenuationPct`}
            />
          </Field>
          <Field
            label="ABV tol. %"
            error={errors[`yeasts.${rowIndex(rows, row.key)}.abvTolerancePct`]}
            fieldPath={`yeasts.${rowIndex(rows, row.key)}.abvTolerancePct`}
          >
            <input
              type="number"
              value={numValue(row.abvTolerancePct)}
              onChange={(e) => {
                const v = e.target.value.trim() === "" ? null : Number.parseFloat(e.target.value);
                onChange(row.key, "abvTolerancePct", Number.isFinite(v as number) ? v : null);
              }}
              min={0}
              max={100}
              step={0.1}
              className={inputClass}
              data-field-path={`yeasts.${rowIndex(rows, row.key)}.abvTolerancePct`}
            />
          </Field>
          <Field
            label="Temp °C (min–max)"
            error={
              errors[`yeasts.${rowIndex(rows, row.key)}.temperatureCMin`] ??
              errors[`yeasts.${rowIndex(rows, row.key)}.temperatureCMax`]
            }
            fieldPath={`yeasts.${rowIndex(rows, row.key)}.temperatureCMin`}
          >
            <div className="flex gap-2">
              <input
                type="number"
                value={numValue(row.temperatureCMin)}
                onChange={(e) => {
                  const v = e.target.value.trim() === "" ? null : Number.parseFloat(e.target.value);
                  onChange(row.key, "temperatureCMin", Number.isFinite(v as number) ? v : null);
                }}
                step={0.1}
                className={inputClass}
                placeholder="min"
                data-field-path={`yeasts.${rowIndex(rows, row.key)}.temperatureCMin`}
              />
              <input
                type="number"
                value={numValue(row.temperatureCMax)}
                onChange={(e) => {
                  const v = e.target.value.trim() === "" ? null : Number.parseFloat(e.target.value);
                  onChange(row.key, "temperatureCMax", Number.isFinite(v as number) ? v : null);
                }}
                step={0.1}
                className={inputClass}
                placeholder="max"
                data-field-path={`yeasts.${rowIndex(rows, row.key)}.temperatureCMax`}
              />
            </div>
          </Field>
          <Field
            label="Notes"
            error={errors[`yeasts.${rowIndex(rows, row.key)}.notes`]}
            fieldPath={`yeasts.${rowIndex(rows, row.key)}.notes`}
            className="md:col-span-7"
          >
            <input
              type="text"
              value={row.notes}
              onChange={(e) => onChange(row.key, "notes", e.target.value)}
              maxLength={10000}
              className={inputClass}
              data-field-path={`yeasts.${rowIndex(rows, row.key)}.notes`}
            />
          </Field>
        </div>
      )}
      onRemove={onRemove}
      getRowKey={(row) => row.key}
    />
  );
}

function MashStepsSection({
  rows,
  errors,
  onAdd,
  onChange,
  onRemove,
}: {
  rows: MashStepRowState[];
  errors: FormErrors;
  onAdd: () => void;
  onChange: (key: string, field: keyof MashStepRowState, value: unknown) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <ListSection
      title="Mash steps"
      description="Single-temperature, infusion, or decoction steps (grain-based recipes)."
      errorCount={countListErrors(errors, "mashSteps")}
      onAdd={onAdd}
      addLabel="Add mash step"
      emptyHint="No mash steps."
      rows={rows}
      renderRow={(row) => (
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3 items-start">
          <Field
            label="Name"
            required
            error={errors[`mashSteps.${rowIndex(rows, row.key)}.name`]}
            fieldPath={`mashSteps.${rowIndex(rows, row.key)}.name`}
          >
            <input
              type="text"
              value={row.name}
              onChange={(e) => onChange(row.key, "name", e.target.value)}
              maxLength={200}
              required
              className={inputClass}
              data-field-path={`mashSteps.${rowIndex(rows, row.key)}.name`}
            />
          </Field>
          <Field
            label="Type"
            error={errors[`mashSteps.${rowIndex(rows, row.key)}.type`]}
            fieldPath={`mashSteps.${rowIndex(rows, row.key)}.type`}
          >
            <select
              value={row.type}
              onChange={(e) => onChange(row.key, "type", e.target.value)}
              className={inputClass}
              data-field-path={`mashSteps.${rowIndex(rows, row.key)}.type`}
            >
              <option value="">—</option>
              <option value="infusion">Infusion</option>
              <option value="temperature">Temperature rest</option>
              <option value="decoction">Decoction</option>
            </select>
          </Field>
          <Field
            label="Step °C"
            required
            error={errors[`mashSteps.${rowIndex(rows, row.key)}.stepTempC`]}
            fieldPath={`mashSteps.${rowIndex(rows, row.key)}.stepTempC`}
          >
            <input
              type="number"
              value={numValue(row.stepTempC)}
              onChange={(e) => {
                const v = e.target.value.trim() === "" ? null : Number.parseFloat(e.target.value);
                onChange(row.key, "stepTempC", Number.isFinite(v as number) ? v : null);
              }}
              required
              step={0.1}
              className={inputClass}
              data-field-path={`mashSteps.${rowIndex(rows, row.key)}.stepTempC`}
            />
          </Field>
          <Field
            label="Time (min)"
            error={errors[`mashSteps.${rowIndex(rows, row.key)}.stepTimeMinutes`]}
            fieldPath={`mashSteps.${rowIndex(rows, row.key)}.stepTimeMinutes`}
          >
            <input
              type="number"
              value={numValue(row.stepTimeMinutes)}
              onChange={(e) => {
                const v = e.target.value.trim() === "" ? null : Number.parseFloat(e.target.value);
                onChange(row.key, "stepTimeMinutes", Number.isFinite(v as number) ? v : null);
              }}
              min={0}
              step={1}
              className={inputClass}
              data-field-path={`mashSteps.${rowIndex(rows, row.key)}.stepTimeMinutes`}
            />
          </Field>
          <Field
            label="Infuse (L)"
            error={errors[`mashSteps.${rowIndex(rows, row.key)}.infuseAmountLiters`]}
            fieldPath={`mashSteps.${rowIndex(rows, row.key)}.infuseAmountLiters`}
          >
            <input
              type="number"
              value={numValue(row.infuseAmountLiters)}
              onChange={(e) => {
                const v = e.target.value.trim() === "" ? null : Number.parseFloat(e.target.value);
                onChange(row.key, "infuseAmountLiters", Number.isFinite(v as number) ? v : null);
              }}
              min={0}
              step={0.1}
              className={inputClass}
              data-field-path={`mashSteps.${rowIndex(rows, row.key)}.infuseAmountLiters`}
            />
          </Field>
          <Field
            label="Notes"
            error={errors[`mashSteps.${rowIndex(rows, row.key)}.notes`]}
            fieldPath={`mashSteps.${rowIndex(rows, row.key)}.notes`}
            className="md:col-span-6"
          >
            <input
              type="text"
              value={row.notes}
              onChange={(e) => onChange(row.key, "notes", e.target.value)}
              maxLength={10000}
              className={inputClass}
              data-field-path={`mashSteps.${rowIndex(rows, row.key)}.notes`}
            />
          </Field>
        </div>
      )}
      onRemove={onRemove}
      getRowKey={(row) => row.key}
    />
  );
}

function ProcessStepsSection({
  rows,
  errors,
  onAdd,
  onChange,
  onRemove,
}: {
  rows: ProcessStepRowState[];
  errors: FormErrors;
  onAdd: () => void;
  onChange: (key: string, field: keyof ProcessStepRowState, value: unknown) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <ListSection
      title="Process steps"
      description="Generic fermentation, racking, backsweetening, aging, bottling steps."
      errorCount={countListErrors(errors, "processSteps")}
      onAdd={onAdd}
      addLabel="Add process step"
      emptyHint="No process steps."
      rows={rows}
      renderRow={(row) => (
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3 items-start">
          <Field
            label="Name"
            required
            error={errors[`processSteps.${rowIndex(rows, row.key)}.name`]}
            fieldPath={`processSteps.${rowIndex(rows, row.key)}.name`}
          >
            <input
              type="text"
              value={row.name}
              onChange={(e) => onChange(row.key, "name", e.target.value)}
              maxLength={200}
              required
              className={inputClass}
              data-field-path={`processSteps.${rowIndex(rows, row.key)}.name`}
            />
          </Field>
          <Field
            label="Type"
            error={errors[`processSteps.${rowIndex(rows, row.key)}.type`]}
            fieldPath={`processSteps.${rowIndex(rows, row.key)}.type`}
          >
            <select
              value={row.type}
              onChange={(e) => onChange(row.key, "type", e.target.value)}
              className={inputClass}
              data-field-path={`processSteps.${rowIndex(rows, row.key)}.type`}
            >
              <option value="">—</option>
              <option value="primary">Primary fermentation</option>
              <option value="secondary">Secondary fermentation</option>
              <option value="racking">Racking</option>
              <option value="backsweetening">Backsweetening</option>
              <option value="stabilizing">Stabilizing</option>
              <option value="aging">Aging</option>
              <option value="bottling">Bottling</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field
            label="Temp °C"
            error={errors[`processSteps.${rowIndex(rows, row.key)}.tempC`]}
            fieldPath={`processSteps.${rowIndex(rows, row.key)}.tempC`}
          >
            <input
              type="number"
              value={numValue(row.tempC)}
              onChange={(e) => {
                const v = e.target.value.trim() === "" ? null : Number.parseFloat(e.target.value);
                onChange(row.key, "tempC", Number.isFinite(v as number) ? v : null);
              }}
              step={0.1}
              className={inputClass}
              data-field-path={`processSteps.${rowIndex(rows, row.key)}.tempC`}
            />
          </Field>
          <Field
            label="Duration (days)"
            error={errors[`processSteps.${rowIndex(rows, row.key)}.durationDays`]}
            fieldPath={`processSteps.${rowIndex(rows, row.key)}.durationDays`}
          >
            <input
              type="number"
              value={numValue(row.durationDays)}
              onChange={(e) => {
                const v = e.target.value.trim() === "" ? null : Number.parseFloat(e.target.value);
                onChange(row.key, "durationDays", Number.isFinite(v as number) ? v : null);
              }}
              min={0}
              step={0.1}
              className={inputClass}
              data-field-path={`processSteps.${rowIndex(rows, row.key)}.durationDays`}
            />
          </Field>
          <Field
            label="Notes"
            error={errors[`processSteps.${rowIndex(rows, row.key)}.notes`]}
            fieldPath={`processSteps.${rowIndex(rows, row.key)}.notes`}
            className="md:col-span-7"
          >
            <input
              type="text"
              value={row.notes}
              onChange={(e) => onChange(row.key, "notes", e.target.value)}
              maxLength={10000}
              className={inputClass}
              data-field-path={`processSteps.${rowIndex(rows, row.key)}.notes`}
            />
          </Field>
        </div>
      )}
      onRemove={onRemove}
      getRowKey={(row) => row.key}
    />
  );
}

function AdditionsSection({
  rows,
  errors,
  onAdd,
  onChange,
  onRemove,
}: {
  rows: AdditionRowState[];
  errors: FormErrors;
  onAdd: () => void;
  onChange: (key: string, field: keyof AdditionRowState, value: unknown) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <ListSection
      title="Additions"
      description="Yeast nutrient, acid blend, pectic enzyme, campden, tannin, etc."
      errorCount={countListErrors(errors, "additions")}
      onAdd={onAdd}
      addLabel="Add addition"
      emptyHint="No additions."
      rows={rows}
      renderRow={(row) => (
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3 items-start">
          <Field
            label="Name"
            required
            error={errors[`additions.${rowIndex(rows, row.key)}.name`]}
            fieldPath={`additions.${rowIndex(rows, row.key)}.name`}
          >
            <input
              type="text"
              value={row.name}
              onChange={(e) => onChange(row.key, "name", e.target.value)}
              maxLength={200}
              required
              className={inputClass}
              data-field-path={`additions.${rowIndex(rows, row.key)}.name`}
            />
          </Field>
          <Field
            label="Amount"
            error={errors[`additions.${rowIndex(rows, row.key)}.amount`]}
            fieldPath={`additions.${rowIndex(rows, row.key)}.amount`}
          >
            <input
              type="number"
              value={numValue(row.amount)}
              onChange={(e) => {
                const v = e.target.value.trim() === "" ? null : Number.parseFloat(e.target.value);
                onChange(row.key, "amount", Number.isFinite(v as number) ? v : null);
              }}
              min={0}
              step={0.01}
              className={inputClass}
              data-field-path={`additions.${rowIndex(rows, row.key)}.amount`}
            />
          </Field>
          <Field
            label="Unit"
            error={errors[`additions.${rowIndex(rows, row.key)}.unit`]}
            fieldPath={`additions.${rowIndex(rows, row.key)}.unit`}
          >
            <input
              type="text"
              value={row.unit}
              onChange={(e) => onChange(row.key, "unit", e.target.value)}
              maxLength={50}
              className={inputClass}
              placeholder="g, ml, tsp, ppm…"
              data-field-path={`additions.${rowIndex(rows, row.key)}.unit`}
            />
          </Field>
          <Field
            label="Purpose"
            error={errors[`additions.${rowIndex(rows, row.key)}.purpose`]}
            fieldPath={`additions.${rowIndex(rows, row.key)}.purpose`}
          >
            <input
              type="text"
              value={row.purpose}
              onChange={(e) => onChange(row.key, "purpose", e.target.value)}
              maxLength={500}
              className={inputClass}
              data-field-path={`additions.${rowIndex(rows, row.key)}.purpose`}
            />
          </Field>
          <Field
            label="Timing"
            error={errors[`additions.${rowIndex(rows, row.key)}.timing`]}
            fieldPath={`additions.${rowIndex(rows, row.key)}.timing`}
          >
            <input
              type="text"
              value={row.timing}
              onChange={(e) => onChange(row.key, "timing", e.target.value)}
              maxLength={500}
              className={inputClass}
              data-field-path={`additions.${rowIndex(rows, row.key)}.timing`}
            />
          </Field>
          <Field
            label="Notes"
            error={errors[`additions.${rowIndex(rows, row.key)}.notes`]}
            fieldPath={`additions.${rowIndex(rows, row.key)}.notes`}
            className="md:col-span-7"
          >
            <input
              type="text"
              value={row.notes}
              onChange={(e) => onChange(row.key, "notes", e.target.value)}
              maxLength={10000}
              className={inputClass}
              data-field-path={`additions.${rowIndex(rows, row.key)}.notes`}
            />
          </Field>
        </div>
      )}
      onRemove={onRemove}
      getRowKey={(row) => row.key}
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full border border-[var(--border)] rounded-md px-3 py-2 bg-[var(--background)] text-[var(--foreground)]";

function numValue(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "";
  return String(v);
}

function rowIndex<T extends { key: string }>(rows: T[], key: string): number {
  return rows.findIndex((r) => r.key === key);
}

function countListErrors(errors: FormErrors, listKey: string): number {
  const prefix = `${listKey}.`;
  let count = 0;
  for (const key of Object.keys(errors)) {
    if (key.startsWith(prefix)) count++;
  }
  return count;
}

function Field({
  label,
  required,
  error,
  fieldPath,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  fieldPath: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`flex flex-col gap-1 ${className ?? ""}`}
      data-field-key={fieldPath}
    >
      <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
        {required ? <span className="ml-0.5 text-[var(--error-fg)]">*</span> : null}
      </span>
      {children}
      {error && (
        <span
          className="text-xs text-[var(--error-fg)]"
          role="alert"
          data-error-path={fieldPath}
        >
          {error}
        </span>
      )}
    </label>
  );
}

interface PreviewCellProps {
  label: string;
  value: string;
}

function PreviewCell({ label, value }: PreviewCellProps) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="text-xl font-mono">{value}</div>
    </div>
  );
}

interface TargetInputProps {
  label: string;
  fieldPath: string;
  error?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
}

function TargetInput({
  label,
  fieldPath,
  error,
  value,
  onChange,
  step,
  min,
  max,
  placeholder,
}: TargetInputProps) {
  return (
    <Field label={label} error={error} fieldPath={fieldPath}>
      <input
        type="number"
        value={numValue(value)}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw.trim() === "") {
            onChange(null);
            return;
          }
          const parsed = Number.parseFloat(raw);
          onChange(Number.isFinite(parsed) ? parsed : null);
        }}
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        className={inputClass + " font-mono"}
        data-field-path={fieldPath}
      />
    </Field>
  );
}

interface ListSectionProps<T extends { key: string }> {
  title: string;
  description?: string;
  errorCount: number;
  onAdd: () => void;
  addLabel: string;
  emptyHint: string;
  rows: T[];
  renderRow: (row: T) => React.ReactNode;
  onRemove: (key: string) => void;
  getRowKey: (row: T) => string;
}

function ListSection<T extends { key: string }>({
  title,
  description,
  errorCount,
  onAdd,
  addLabel,
  emptyHint,
  rows,
  renderRow,
  onRemove,
  getRowKey,
}: ListSectionProps<T>) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">
            {title}{" "}
            <span className="text-sm font-normal text-[var(--muted-foreground)]">
              ({rows.length})
            </span>
            {errorCount > 0 && (
              <span
                className="ml-2 text-xs font-normal text-[var(--error-fg)]"
                role="alert"
              >
                {errorCount} field{errorCount === 1 ? "" : "s"} need attention
              </span>
            )}
          </h2>
          {description && (
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="px-3 py-1.5 rounded-md border border-[var(--border)] text-sm hover:bg-[var(--muted)]"
        >
          + {addLabel}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">{emptyHint}</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row, i) => (
            <li
              key={getRowKey(row)}
              className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3 space-y-2"
              data-row-index={i}
            >
              <div className="flex justify-between items-center">
                <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  Row {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(getRowKey(row))}
                  className="text-xs text-[var(--error-fg)] hover:underline"
                  aria-label={`Remove row ${i + 1}`}
                >
                  Remove
                </button>
              </div>
              {renderRow(row)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FormActions({
  mode,
  submitting,
  onCancel,
}: {
  mode: "create" | "edit";
  submitting: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-5 -mx-2 px-2 py-3 bg-[var(--card)]/90 backdrop-blur border-t border-[var(--border)] flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 rounded-md border border-[var(--border)] text-sm"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] font-medium hover:opacity-90 disabled:opacity-50"
      >
        {submitting
          ? "Saving…"
          : mode === "create"
            ? "Create recipe"
            : "Save changes"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mapping detail -> form state
// ---------------------------------------------------------------------------

function fromRecipeDetail(d: RecipeDetail): RecipeFormState {
  return {
    title: d.title ?? "",
    author: d.author ?? "",
    description: d.description ?? "",
    notes: d.notes ?? "",
    category: (d.category as RecipeFormState["category"]) ?? "",
    styleName: d.styleName ?? "",
    bjcpCategory: d.bjcpCategory ?? "",
    batchSizeLiters: d.batchSizeLiters ?? 20,
    boilTimeMinutes: d.boilTimeMinutes ?? null,
    efficiencyPct: d.efficiencyPct ?? null,
    targetOg: d.targetOg ?? null,
    targetFg: d.targetFg ?? null,
    targetPh: d.targetPh ?? null,
    targetAbv: d.targetAbv ?? null,
    targetIbu: d.targetIbu ?? null,
    targetSrm: d.targetSrm ?? null,
    fermentables: d.fermentables.map((f) => ({
      key: f.id || newRowKey(),
      name: f.name ?? "",
      type: (f.type as FermentableRowState["type"]) ?? "",
      amountKg: f.amountKg ?? null,
      amountLiters: f.amountLiters ?? null,
      colorLovibond: f.colorLovibond ?? null,
      potentialPpg: f.potentialPpg ?? null,
      notes: f.notes ?? "",
    })),
    hops: d.hops.map((h) => ({
      key: h.id || newRowKey(),
      name: h.name ?? "",
      amountGrams: h.amountGrams ?? null,
      alphaAcidPct: h.alphaAcidPct ?? null,
      timeMinutes: h.timeMinutes ?? null,
      use: (h.use as HopRowState["use"]) ?? "",
      form: (h.form as HopRowState["form"]) ?? "",
      notes: h.notes ?? "",
    })),
    yeasts: d.yeasts.map((y) => ({
      key: y.id || newRowKey(),
      name: y.name ?? "",
      laboratory: y.laboratory ?? "",
      productId: y.productId ?? "",
      type: (y.type as YeastRowState["type"]) ?? "",
      form: (y.form as YeastRowState["form"]) ?? "",
      attenuationPct: y.attenuationPct ?? null,
      abvTolerancePct: y.abvTolerancePct ?? null,
      temperatureCMin: y.temperatureCMin ?? null,
      temperatureCMax: y.temperatureCMax ?? null,
      notes: y.notes ?? "",
    })),
    mashSteps: d.mashSteps.map((m) => ({
      key: m.id || newRowKey(),
      name: m.name ?? "",
      type: (m.type as MashStepRowState["type"]) ?? "",
      stepTempC: m.stepTempC ?? null,
      stepTimeMinutes: m.stepTimeMinutes ?? null,
      infuseAmountLiters: m.infuseAmountLiters ?? null,
      notes: m.notes ?? "",
    })),
    processSteps: d.processSteps.map((p) => ({
      key: p.id || newRowKey(),
      name: p.name ?? "",
      type: (p.type as ProcessStepRowState["type"]) ?? "",
      tempC: p.tempC ?? null,
      durationDays: p.durationDays ?? null,
      notes: p.notes ?? "",
    })),
    additions: d.additions.map((a) => ({
      key: a.id || newRowKey(),
      name: a.name ?? "",
      amount: a.amount ?? null,
      unit: a.unit ?? "",
      purpose: a.purpose ?? "",
      timing: a.timing ?? "",
      notes: a.notes ?? "",
    })),
  };
}
