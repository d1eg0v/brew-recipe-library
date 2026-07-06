import Link from "next/link";

import CategoryBadge from "@/components/CategoryBadge";
import { categoryLabel, fmtNumber, fmtPercent } from "@/lib/ui/format";
import type {
  RecipeCategory,
  RecipeListItem,
  RecipeListResponse,
} from "@/lib/ui/types";
import { RECIPE_CATEGORIES } from "@/lib/api/schemas";

export const dynamic = "force-dynamic";

const CATEGORIES = RECIPE_CATEGORIES;

interface BrowseSearchParams {
  q?: string;
  category?: string;
  style?: string;
  abvMin?: string;
  abvMax?: string;
  ibuMin?: string;
  ibuMax?: string;
  srmMin?: string;
  srmMax?: string;
  ogMin?: string;
  ogMax?: string;
}

async function fetchRecipes(
  base: string,
  params: BrowseSearchParams,
): Promise<RecipeListResponse> {
  const url = new URL("/api/recipes", base);
  if (params.q) url.searchParams.set("q", params.q);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.style) url.searchParams.set("style", params.style);
  if (params.abvMin) url.searchParams.set("abvMin", params.abvMin);
  if (params.abvMax) url.searchParams.set("abvMax", params.abvMax);
  if (params.ibuMin) url.searchParams.set("ibuMin", params.ibuMin);
  if (params.ibuMax) url.searchParams.set("ibuMax", params.ibuMax);
  if (params.srmMin) url.searchParams.set("srmMin", params.srmMin);
  if (params.srmMax) url.searchParams.set("srmMax", params.srmMax);
  if (params.ogMin) url.searchParams.set("ogMin", params.ogMin);
  if (params.ogMax) url.searchParams.set("ogMax", params.ogMax);
  url.searchParams.set("limit", "100");

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      console.error("browse fetch failed", res.status, await res.text());
      return { data: [], total: 0, limit: 100, offset: 0 };
    }
    return (await res.json()) as RecipeListResponse;
  } catch (err) {
    console.error("browse fetch error", err);
    return { data: [], total: 0, limit: 100, offset: 0 };
  }
}

function recipeHref(r: RecipeListItem): string {
  return `/recipes/${r.id}`;
}

function hasRangeFilter(p: BrowseSearchParams): boolean {
  return Boolean(
    p.abvMin ||
      p.abvMax ||
      p.ibuMin ||
      p.ibuMax ||
      p.srmMin ||
      p.srmMax ||
      p.ogMin ||
      p.ogMax,
  );
}

function hasAnyFilter(p: BrowseSearchParams): boolean {
  return Boolean(
    p.q ||
      p.category ||
      p.style ||
      hasRangeFilter(p),
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<BrowseSearchParams>;
}) {
  const params = await searchParams;
  // We don't know the public origin here at SSR (the page is rendered
  // relative to the request), so build absolute URLs from the relative path
  // by letting fetch resolve them. `http://localhost` works because Next.js
  // routes /api/* internally even with absolute URLs of the same host. To
  // keep things robust we use a dummy base and let the dev server's internal
  // routing resolve it via the host header. In production this also works
  // since both pages and API are in the same Next.js deployment.
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const response = await fetchRecipes(base, params);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">Recipes</h1>
        <p className="mt-1 text-[var(--muted-foreground)]">
          {response.total} recipe{response.total === 1 ? "" : "s"}
          {hasAnyFilter(params) ? " matching your filters" : " in the library"}
        </p>
      </section>

      <FilterControls params={params} />

      {response.data.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {response.data.map((r) => (
            <li key={r.id}>
              <RecipeCard recipe={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterControls({ params }: { params: BrowseSearchParams }) {
  return (
    <form
      method="get"
      action="/"
      className="grid grid-cols-1 gap-3 p-4 rounded-lg border border-[var(--border)] bg-[var(--card)]"
    >
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_2fr_auto] gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="q"
            className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]"
          >
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder="Search title, author, description, notes"
            className="border border-[var(--border)] rounded-md px-3 py-2 bg-[var(--background)] text-[var(--foreground)]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="category"
            className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]"
          >
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue={params.category ?? ""}
            className="border border-[var(--border)] rounded-md px-3 py-2 bg-[var(--background)] text-[var(--foreground)]"
          >
            <option value="">All</option>
            {CATEGORIES.map((c: RecipeCategory) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="style"
            className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]"
          >
            Style contains
          </label>
          <input
            id="style"
            name="style"
            type="text"
            defaultValue={params.style ?? ""}
            placeholder="e.g. IPA, mead, country"
            className="border border-[var(--border)] rounded-md px-3 py-2 bg-[var(--background)] text-[var(--foreground)]"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] font-medium hover:opacity-90"
          >
            Search
          </button>
          {hasAnyFilter(params) && (
            <Link
              href="/"
              className="px-4 py-2 rounded-md border border-[var(--border)] text-[var(--foreground)] no-underline hover:bg-[var(--muted)]"
            >
              Clear
            </Link>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--border)] pt-3">
        <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] mb-2">
          Target ranges
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <RangeControl
            label="ABV (%)"
            minId="abvMin"
            maxId="abvMax"
            minName="abvMin"
            maxName="abvMax"
            minValue={params.abvMin}
            maxValue={params.abvMax}
            step={0.1}
            placeholder="min"
            placeholderMax="max"
          />
          <RangeControl
            label="IBU"
            minId="ibuMin"
            maxId="ibuMax"
            minName="ibuMin"
            maxName="ibuMax"
            minValue={params.ibuMin}
            maxValue={params.ibuMax}
            step={1}
            placeholder="min"
            placeholderMax="max"
          />
          <RangeControl
            label="SRM"
            minId="srmMin"
            maxId="srmMax"
            minName="srmMin"
            maxName="srmMax"
            minValue={params.srmMin}
            maxValue={params.srmMax}
            step={0.5}
            placeholder="min"
            placeholderMax="max"
          />
          <RangeControl
            label="OG"
            minId="ogMin"
            maxId="ogMax"
            minName="ogMin"
            maxName="ogMax"
            minValue={params.ogMin}
            maxValue={params.ogMax}
            step={0.001}
            placeholder="min"
            placeholderMax="max"
          />
        </div>
      </div>
    </form>
  );
}

interface RangeControlProps {
  label: string;
  minId: string;
  maxId: string;
  minName: string;
  maxName: string;
  minValue: string | undefined;
  maxValue: string | undefined;
  step: number;
  placeholder: string;
  placeholderMax: string;
}

function RangeControl({
  label,
  minId,
  maxId,
  minName,
  maxName,
  minValue,
  maxValue,
  step,
  placeholder,
  placeholderMax,
}: RangeControlProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <input
          id={minId}
          name={minName}
          type="number"
          inputMode="decimal"
          step={step}
          min="0"
          defaultValue={minValue ?? ""}
          placeholder={placeholder}
          aria-label={`${label} minimum`}
          className="border border-[var(--border)] rounded-md px-3 py-2 bg-[var(--background)] text-[var(--foreground)]"
        />
        <input
          id={maxId}
          name={maxName}
          type="number"
          inputMode="decimal"
          step={step}
          min="0"
          defaultValue={maxValue ?? ""}
          placeholder={placeholderMax}
          aria-label={`${label} maximum`}
          className="border border-[var(--border)] rounded-md px-3 py-2 bg-[var(--background)] text-[var(--foreground)]"
        />
      </div>
    </div>
  );
}

function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  return (
    <Link
      href={recipeHref(recipe)}
      className="block h-full p-4 rounded-lg border border-[var(--border)] bg-[var(--card)] no-underline text-[var(--card-foreground)] hover:border-[var(--accent)] transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold leading-snug">{recipe.title}</h3>
        <CategoryBadge category={recipe.category} />
      </div>
      {recipe.styleName && (
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {recipe.styleName}
          {recipe.bjcpCategory ? ` · ${recipe.bjcpCategory}` : ""}
        </p>
      )}
      <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <Stat label="Batch" value={`${fmtNumber(recipe.batchSizeLiters, 1)} L`} />
        <Stat
          label="ABV"
          value={
            recipe.targetAbv != null ? fmtPercent(recipe.targetAbv, 1) : "—"
          }
        />
        <Stat
          label="OG"
          value={recipe.targetOg != null ? recipe.targetOg.toFixed(3) : "—"}
        />
      </dl>
      {recipe.description && (
        <p className="mt-3 text-sm text-[var(--muted-foreground)] line-clamp-3">
          {recipe.description}
        </p>
      )}
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </dt>
      <dd className="font-mono text-sm">{value}</dd>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-8 text-center text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-lg">
      No recipes match those filters. Try clearing the search box, the style
      filter, the category, or any active target ranges.
    </div>
  );
}