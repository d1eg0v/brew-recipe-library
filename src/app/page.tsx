import Link from "next/link";
import { prisma } from "@/lib/db";
import { categoryLabel, pickBatchSize, fmtAbv } from "@/lib/display/format";
import { FilterForm } from "@/app/_components/FilterForm";

export const dynamic = "force-dynamic";

interface RecipeSummary {
  id: string;
  title: string;
  category: string;
  styleName: string | null;
  bjcpCategory: string | null;
  batchSizeLiters: number;
  targetAbv: number | null;
  targetIbu: number | null;
  targetSrm: number | null;
  author: string | null;
}

export default async function HomePage(props: PageProps<"/">) {
  const searchParams = await props.searchParams;
  const category = pickString(searchParams?.category);
  const style = pickString(searchParams?.style);

  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (style) where.styleName = { contains: style };

  const recipes = (await prisma.recipe.findMany({
    where,
    orderBy: [{ title: "asc" }],
    select: {
      id: true,
      title: true,
      category: true,
      styleName: true,
      bjcpCategory: true,
      batchSizeLiters: true,
      targetAbv: true,
      targetIbu: true,
      targetSrm: true,
      author: true,
    },
  })) as RecipeSummary[];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Brew Recipe Library</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Browse {recipes.length} home-fermentation recipe
          {recipes.length === 1 ? "" : "s"}
          {category || style ? " matching your filters" : ""}.
        </p>
      </header>

      <section className="mb-6">
        <FilterForm />
      </section>

      {recipes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No recipes match your filters. Try clearing them.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => (
            <li key={r.id}>
              <Link
                href={`/recipes/${r.id}`}
                className="block h-full rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-amber-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-amber-500"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    {categoryLabel(r.category)}
                  </span>
                  {r.bjcpCategory && (
                    <span className="text-xs text-zinc-500">{r.bjcpCategory}</span>
                  )}
                </div>
                <h2 className="mt-2 text-lg font-semibold leading-tight">
                  {r.title}
                </h2>
                {r.styleName && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {r.styleName}
                  </p>
                )}
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-zinc-500">Batch</dt>
                    <dd className="font-medium">
                      {pickBatchSize(r.batchSizeLiters, "metric")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">ABV</dt>
                    <dd className="font-medium">{fmtAbv(r.targetAbv)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">
                      {r.category === "beer" ? "IBU / SRM" : "Author"}
                    </dt>
                    <dd className="font-medium">
                      {r.category === "beer"
                        ? `${r.targetIbu ?? "—"} / ${r.targetSrm ?? "—"}`
                        : (r.author ?? "—")}
                    </dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function pickString(value: string | string[] | undefined): string | null {
  if (value == null) return null;
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.trim().length > 0 ? v.trim() : null;
}
