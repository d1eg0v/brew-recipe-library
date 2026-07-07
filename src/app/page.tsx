import Link from "next/link";

import CategoryBadge from "@/components/CategoryBadge";
import {
  ArrowGlyph,
  CategoryGlyph,
  PencilGlyph,
  PlusGlyph,
} from "@/components/icons";
import {
  categoryAccent,
  categoryLabel,
  fmtNumber,
  fmtPercent,
} from "@/lib/ui/format";
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
): Promise<RecipeListResponse> {
  const url = new URL("/api/recipes", base);
  url.searchParams.set("limit", "200");

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      console.error("browse fetch failed", res.status, await res.text());
      return { data: [], total: 0, limit: 200, offset: 0 };
    }
    return (await res.json()) as RecipeListResponse;
  } catch (err) {
    console.error("browse fetch error", err);
    return { data: [], total: 0, limit: 200, offset: 0 };
  }
}

function matchesFilters(
  recipe: RecipeListItem,
  params: BrowseSearchParams,
): boolean {
  if (params.category && recipe.category !== params.category) return false;
  if (params.style) {
    const q = params.style.toLowerCase();
    const hay = [
      recipe.title,
      recipe.styleName ?? "",
      recipe.bjcpCategory ?? "",
      recipe.description ?? "",
      recipe.author ?? "",
    ]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<BrowseSearchParams>;
}) {
  const params = await searchParams;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const response = await fetchRecipes(base);
  const all = response.data;

  const counts = CATEGORIES.reduce<Record<string, number>>((acc, c) => {
    acc[c] = all.filter((r) => r.category === c).length;
    return acc;
  }, {});

  const filtered = all.filter((r) => matchesFilters(r, params));
  const isFiltered = Boolean(params.category || params.style);

  return (
    <div>
      {/* ---------------------------------------------------------- */}
      {/*  Hero                                                       */}
      {/* ---------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--surface-2)]/50">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            background:
              "radial-gradient(680px 320px at 8% -20%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%), radial-gradient(520px 280px at 95% 10%, color-mix(in srgb, var(--secondary) 12%, transparent), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-12 sm:py-16">
          <p className="label-eyebrow">A field notebook for fermentations</p>
          <h1 className="font-display mt-3 text-5xl sm:text-6xl font-semibold tracking-tight text-[var(--foreground)]">
            Recipes
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--muted-foreground)]">
            {all.length} recipe{all.length === 1 ? "" : "s"} in the library
            {isFiltered ? (
              <>
                {" "}
                — <span className="text-[var(--foreground)] font-medium">
                  {filtered.length} match
                  {filtered.length === 1 ? "" : "es"}
                </span>{" "}
                your filters
              </>
            ) : (
              <>
                {" "}
                across beer, mead, wine, and cider. Scale any batch, switch
                units, print a shopping list.
              </>
            )}
          </p>

          {/* Search bar */}
          <form
            method="get"
            action="/"
            className="mt-8 flex flex-col sm:flex-row gap-2 sm:gap-0 sm:items-stretch sm:max-w-xl"
          >
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m20 20-4-4" />
                </svg>
              </span>
              <input
                name="style"
                type="search"
                defaultValue={params.style ?? ""}
                placeholder="Search by style, name, or ingredient…"
                aria-label="Search recipes by style, name, or ingredient"
                className="field field-mono w-full rounded-r-none border-r-0 sm:pl-9"
                style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
              />
            </div>
            {/* Keep a category control in the form (progressive: chips below
                are the primary nav, but this keeps the query shareable). */}
            <select
              name="category"
              defaultValue={params.category ?? ""}
              aria-label="Filter by category"
              className="field field-mono sm:w-auto rounded-none border-x-0"
              style={{ borderRadius: 0 }}
            >
              <option value="">All</option>
              {CATEGORIES.map((c: RecipeCategory) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary sm:rounded-l-none" style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}>
              Search
            </button>
          </form>

          <div className="mt-6">
            <Link href="/recipes/new" className="btn btn-primary no-underline">
              <PlusGlyph className="h-4 w-4" />
              New recipe
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/*  Category chips + grid                                      */}
      {/* ---------------------------------------------------------- */}
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <CategoryChips
          counts={counts}
          active={params.category ?? ""}
          style={params.style}
        />

        {/* Active filter summary + clear */}
        {isFiltered && (
          <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
            <span>
              Showing {filtered.length} of {all.length}
            </span>
            <Link
              href="/"
              className="btn btn-ghost btn-sm no-underline"
            >
              Clear filters
            </Link>
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState filtered={isFiltered} />
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((r) => (
              <li key={r.id}>
                <RecipeCard recipe={r} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CategoryChips({
  counts,
  active,
  style,
}: {
  counts: Record<string, number>;
  active: string;
  style?: string;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const styleSuffix = style ? `&style=${encodeURIComponent(style)}` : "";
  return (
    <nav aria-label="Filter by category" className="flex flex-wrap gap-2">
      <Link
        href={style ? `/?style=${encodeURIComponent(style)}` : "/"}
        className="chip"
        data-active={active === "" ? "true" : "false"}
      >
        All
        <span className="chip-count">{total}</span>
      </Link>
      {CATEGORIES.map((c: RecipeCategory) => {
        const n = counts[c] ?? 0;
        if (n === 0) return null;
        return (
          <Link
            key={c}
            href={`/?category=${c}${styleSuffix}`}
            className="chip"
            data-active={active === c ? "true" : "false"}
          >
            <CategoryGlyph category={c} className="h-4 w-4" />
            {categoryLabel(c)}
            <span className="chip-count">{n}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  const accent = categoryAccent(recipe.category, recipe.targetSrm);
  const href = `/recipes/${recipe.id}`;
  return (
    <Link
      href={href}
      className="recipe-card no-underline"
      style={{ ["--card-accent" as string]: accent }}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
          style={{
            background: "color-mix(in srgb, var(--card-accent) 18%, var(--card))",
            color: "var(--card-accent)",
          }}
        >
          <CategoryGlyph category={recipe.category} className="h-5 w-5" />
        </span>
        <CategoryBadge category={recipe.category} />
      </div>

      <h3 className="font-display mt-3 text-xl font-semibold leading-tight text-[var(--foreground)]">
        {recipe.title}
      </h3>
      {recipe.styleName && (
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {recipe.styleName}
          {recipe.bjcpCategory ? (
            <span className="font-mono ml-1.5 text-[var(--border-strong)]">
              · {recipe.bjcpCategory}
            </span>
          ) : null}
        </p>
      )}

      {recipe.description && (
        <p className="mt-2.5 text-sm leading-relaxed text-[var(--muted-foreground)] line-clamp-2">
          {recipe.description}
        </p>
      )}

      <div className="mt-auto pt-4">
        <dl className="grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-3">
          <CardStat
            label="Batch"
            value={`${fmtNumber(recipe.batchSizeLiters, 1)}L`}
          />
          <CardStat
            label="ABV"
            value={
              recipe.targetAbv != null ? fmtPercent(recipe.targetAbv, 1) : "—"
            }
          />
          <CardStat
            label="OG"
            value={recipe.targetOg != null ? recipe.targetOg.toFixed(3) : "—"}
          />
        </dl>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1 text-[var(--accent)] font-semibold">
            Open recipe
            <ArrowGlyph className="h-3.5 w-3.5" />
          </span>
          {recipe.author && (
            <span className="text-[var(--muted-foreground)]">
              by {recipe.author}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label-eyebrow">{label}</dt>
      <dd className="font-mono text-base font-medium text-[var(--foreground)]">
        {value}
      </dd>
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="section text-center py-16">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--muted-foreground)]">
        <PencilGlyph className="h-7 w-7" />
      </div>
      <h2 className="font-display mt-4 text-2xl font-semibold">
        {filtered ? "Nothing matches those filters" : "No recipes yet"}
      </h2>
      <p className="mt-2 text-[var(--muted-foreground)]">
        {filtered
          ? "Try a different category or clear your search."
          : "Add your first recipe to start the library."}
      </p>
      <Link href="/recipes/new" className="btn btn-primary mt-5 no-underline">
        <PlusGlyph className="h-4 w-4" />
        New recipe
      </Link>
    </div>
  );
}
