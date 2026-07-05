import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeTargets } from "@/lib/brewing";
import { presentRecipe } from "@/lib/api/present";
import {
  categoryLabel,
  fmtAbv,
  fmtGravity,
  fmtIbu,
  fmtSrm,
  fmtTempC,
  pickBatchSize,
  pickFermentableAmount,
  pickHopAmount,
} from "@/lib/display/format";
import { ScaleAndUnitsBar } from "./_components/ScaleAndUnitsBar";

export const dynamic = "force-dynamic";

const RECIPE_INCLUDE = {
  fermentables: { orderBy: { position: "asc" as const } },
  hops: { orderBy: { position: "asc" as const } },
  yeasts: { orderBy: { position: "asc" as const } },
  mashSteps: { orderBy: { position: "asc" as const } },
  processSteps: { orderBy: { position: "asc" as const } },
  additions: { orderBy: { position: "asc" as const } },
};

type FullRecipe = NonNullable<Awaited<ReturnType<typeof loadRecipe>>>;

async function loadRecipe(id: string) {
  return prisma.recipe.findUnique({
    where: { id },
    include: RECIPE_INCLUDE,
  });
}

export default async function RecipeDetailPage(
  props: PageProps<"/recipes/[id]">,
) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const units = (searchParams?.units === "imperial" ? "imperial" : "metric") as
    | "metric"
    | "imperial";
  const targetBatchSize = parseBatchSize(searchParams?.batchSize);

  const raw = await loadRecipe(id);
  if (!raw) notFound();

  // Compute style targets server-side from the (metric) ingredient list.
  // computeTargets expects FermentableInput / HopInput / YeastInput shapes;
  // the present layer leaves these metric fields alone.
  const targets = computeTargets({
    batchSizeLiters: raw.batchSizeLiters,
    efficiencyPct: raw.efficiencyPct ?? undefined,
    fermentables: raw.fermentables.map((f) => ({
      type: f.type,
      amountKg: f.amountKg ?? 0,
      colorLovibond: f.colorLovibond ?? null,
      potentialPpg: f.potentialPpg ?? null,
    })),
    hops: raw.hops.map((h) => ({
      amountGrams: h.amountGrams,
      alphaAcidPct: h.alphaAcidPct ?? null,
      timeMinutes: h.timeMinutes,
      use: h.use,
    })),
    yeasts: raw.yeasts.map((y) => ({
      attenuationPct: y.attenuationPct ?? null,
    })),
  });

  // For display, apply optional scaling + unit conversion. Targets don't move
  // with scale (they're volume-independent), so re-apply them to the presented
  // recipe explicitly.
  const displayed = presentRecipe(
    { ...raw, targetOg: targets.og, targetFg: targets.fg, targetAbv: targets.abv, targetIbu: targets.ibu, targetSrm: targets.srm },
    {
      batchSize: targetBatchSize ?? undefined,
      units,
    },
  ) as FullRecipe & {
    targetOg: number;
    targetFg: number;
    targetAbv: number;
    targetIbu: number;
    targetSrm: number;
  };

  const originalBatchSize = raw.batchSizeLiters;
  const isScaled =
    targetBatchSize != null &&
    Math.abs(targetBatchSize - originalBatchSize) > 1e-6;
  const effectiveBatchSize = targetBatchSize ?? originalBatchSize;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link
        href="/"
        className="text-sm text-amber-700 hover:underline dark:text-amber-400"
      >
        ← All recipes
      </Link>

      <header className="mt-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {categoryLabel(displayed.category)}
          </span>
          {displayed.bjcpCategory && (
            <span className="text-xs text-zinc-500">
              {displayed.bjcpCategory}
            </span>
          )}
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {displayed.title}
        </h1>
        {displayed.styleName && (
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            {displayed.styleName}
          </p>
        )}
        {displayed.author && (
          <p className="mt-1 text-sm text-zinc-500">By {displayed.author}</p>
        )}
        {displayed.description && (
          <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {displayed.description}
          </p>
        )}
      </header>

      <section className="mb-6">
        <ScaleAndUnitsBar defaultBatchSizeLiters={originalBatchSize} />
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Batch size" value={pickBatchSize(effectiveBatchSize, units)} />
        {isScaled && (
          <Stat
            label="Original batch"
            value={pickBatchSize(originalBatchSize, units)}
          />
        )}
        <Stat label="OG" value={fmtGravity(displayed.targetOg)} />
        <Stat label="FG" value={fmtGravity(displayed.targetFg)} />
        <Stat label="ABV" value={fmtAbv(displayed.targetAbv)} />
        {(displayed.category === "beer" ||
          displayed.targetIbu != null ||
          displayed.targetSrm != null) && (
          <>
            <Stat label="IBU" value={fmtIbu(displayed.targetIbu)} />
            <Stat label="SRM" value={fmtSrm(displayed.targetSrm)} />
          </>
        )}
      </section>

      <Section
        title="Fermentables"
        empty="No fermentables listed."
        isEmpty={displayed.fermentables.length === 0}
      >
        <Table
          headers={["Name", "Type", "Amount", "Details"]}
          rows={displayed.fermentables.map((f) => {
            const { value, secondary } = pickFermentableAmount(
              f as Record<string, unknown>,
              units,
            );
            return [
              f.name,
              <span key="t" className="capitalize">
                {f.type}
              </span>,
              (
                <div key="a" className="leading-tight">
                  <div>{value}</div>
                  {secondary && (
                    <div className="text-xs text-zinc-500">{secondary}</div>
                  )}
                </div>
              ),
              formatFermentableExtras(f, units),
            ];
          })}
        />
      </Section>

      {displayed.hops.length > 0 && (
        <Section title="Hops">
          <Table
            headers={["Name", "Amount", "Time", "Use", "Form", "AA%"]}
            rows={displayed.hops.map((h) => [
              h.name,
              pickHopAmount(h as Record<string, unknown>, units),
              `${h.timeMinutes} min`,
              <span key="use" className="capitalize">
                {h.use}
              </span>,
              <span key="form" className="capitalize">
                {h.form}
              </span>,
              h.alphaAcidPct != null ? `${h.alphaAcidPct}%` : "—",
            ])}
          />
        </Section>
      )}

      {displayed.yeasts.length > 0 && (
        <Section title="Yeast">
          <Table
            headers={["Name", "Lab", "Code", "Type", "Form", "Attenuation", "Temp"]}
            rows={displayed.yeasts.map((y) => [
              y.name,
              y.laboratory ?? "—",
              y.productId ?? "—",
              <span key="type" className="capitalize">
                {y.type}
              </span>,
              <span key="form" className="capitalize">
                {y.form}
              </span>,
              y.attenuationPct != null ? `${y.attenuationPct}%` : "—",
              formatTempRange(y.temperatureCMin, y.temperatureCMax, units),
            ])}
          />
        </Section>
      )}

      {displayed.mashSteps.length > 0 && (
        <Section title="Mash schedule">
          <Table
            headers={["Name", "Type", "Temp", "Time", "Infuse"]}
            rows={displayed.mashSteps.map((m) => [
              m.name,
              <span key="t" className="capitalize">
                {m.type}
              </span>,
              fmtTempC(m.stepTempC, units),
              m.stepTimeMinutes != null ? `${m.stepTimeMinutes} min` : "—",
              m.infuseAmountLiters != null
                ? pickBatchSize(m.infuseAmountLiters, units)
                : "—",
            ])}
          />
        </Section>
      )}

      {displayed.processSteps.length > 0 && (
        <Section title="Process steps">
          <Table
            headers={["Name", "Type", "Temp", "Duration"]}
            rows={displayed.processSteps.map((p) => [
              p.name,
              <span key="t" className="capitalize">
                {p.type}
              </span>,
              fmtTempC(p.tempC, units),
              p.durationDays != null
                ? `${p.durationDays} day${p.durationDays === 1 ? "" : "s"}`
                : "—",
            ])}
          />
        </Section>
      )}

      {displayed.additions.length > 0 && (
        <Section title="Additions">
          <Table
            headers={["Name", "Amount", "Purpose", "Timing"]}
            rows={displayed.additions.map((a) => [
              a.name,
              a.amount != null ? `${a.amount}${a.unit ? ` ${a.unit}` : ""}` : "—",
              a.purpose ?? "—",
              a.timing ?? "—",
            ])}
          />
        </Section>
      )}

      {displayed.notes && (
        <Section title="Notes">
          <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {displayed.notes}
          </p>
        </Section>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Section({
  title,
  empty,
  isEmpty,
  children,
}: {
  title: string;
  empty?: string;
  isEmpty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      {isEmpty ? (
        <p className="text-sm text-zinc-500">{empty ?? "None."}</p>
      ) : (
        children
      )}
    </section>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">None.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 dark:bg-zinc-900/50">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                scope="col"
                className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-t border-zinc-200 first:border-t-0 dark:border-zinc-800"
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="px-3 py-2 align-top text-zinc-800 dark:text-zinc-200"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatTempRange(
  min: number | null | undefined,
  max: number | null | undefined,
  units: "metric" | "imperial",
): string {
  if (min == null && max == null) return "—";
  if (min != null && max != null) {
    return `${fmtTempC(min, units)} – ${fmtTempC(max, units)}`;
  }
  return fmtTempC((min ?? max)!, units);
}

function formatFermentableExtras(
  f: Record<string, unknown>,
  units: "metric" | "imperial",
): React.ReactNode {
  const pieces: React.ReactNode[] = [];
  if (f.colorLovibond != null) pieces.push(`${f.colorLovibond} °L`);
  if (f.potentialPpg != null) pieces.push(`${f.potentialPpg} ppg`);
  const amtL = f.amountLiters as number | null | undefined;
  const amtKg = f.amountKg as number | null | undefined;
  if (amtL != null && amtKg == null) {
    pieces.push(units === "imperial"
      ? `${(amtL / 3.785411784).toFixed(2)} gal`
      : `${amtL.toFixed(2)} L`);
  }
  if (pieces.length === 0 && f.notes) {
    return <span className="text-xs text-zinc-500">{String(f.notes)}</span>;
  }
  if (pieces.length === 0) return "—";
  return (
    <span className="flex flex-col gap-0.5 text-xs text-zinc-500">
      {pieces.map((p, i) => (
        <span key={i}>{p}</span>
      ))}
    </span>
  );
}

function parseBatchSize(raw: string | string[] | undefined): number | null {
  if (raw == null) return null;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v == null || v === "") return null;
  const n = Number.parseFloat(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
