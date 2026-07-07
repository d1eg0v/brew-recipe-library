import Link from "next/link";

import BatchSizeStat from "@/components/BatchSizeStat";
import CategoryBadge from "@/components/CategoryBadge";
import { categoryLabel, fmtPercent } from "@/lib/ui/format";
import type {
  RecipeCategory,
  RecipeListItem,
  RecipeListResponse,
} from "@/lib/ui/types";
import { RECIPE_CATEGORIES } from "@/lib/api/schemas";

export const dynamic = "force-dynamic";

const CATEGORIES = RECIPE_CATEGORIES;

interface BrowseSearchParams {
  category?: string;
  style?: string;
}

async function fetchRecipes(
  base: string,
  params: BrowseSearchParams,
): Promise<RecipeListResponse> {
  const url = new URL("/api/recipes", base);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.style) url.searchParams.set("style", params.style);
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
  const filtered = params.category || params.style;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">Recipes</h1>
        <p className="mt-1 text-[var(--muted-foreground)]">
          {response.total} recipe{response.total === 1 ? "" : "s"}
          {filtered ? " matching your filters" : " in the library"}
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
      className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-3 items-end p-4 rounded-lg border border-[var(--border)] bg-[var(--card)]"
    >
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
          Filter
        </button>
        {(params.category || params.style) && (
          <Link
            href="/"
            className="px-4 py-2 rounded-md border border-[var(--border)] text-[var(--foreground)] no-underline hover:bg-[var(--muted)]"
          >
            Clear
          </Link>
        )}
      </div>
    </form>
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
        <Stat label="Batch">
          <BatchSizeStat liters={recipe.batchSizeLiters} />
        </Stat>
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

function Stat({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </dt>
      <dd className="font-mono text-sm">{children ?? value}</dd>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-8 text-center text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-lg">
      No recipes match those filters. Try clearing the style search or
      selecting a different category.
    </div>
  );
}