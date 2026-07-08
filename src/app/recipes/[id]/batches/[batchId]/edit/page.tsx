import Link from "next/link";
import { notFound } from "next/navigation";

import BatchForm from "@/components/batch/BatchForm";
import { prisma } from "@/lib/db";
import { fmtBrewDate } from "@/lib/ui/format";

interface RouteParams {
  params: Promise<{ id: string; batchId: string }>;
}

export const dynamic = "force-dynamic";

interface LoadedBatch {
  id: string;
  recipeId: string;
  brewDate: Date;
  measuredOg: number | null;
  measuredFg: number | null;
  volumeLiters: number | null;
  notes: string | null;
}

async function loadBatch(
  recipeId: string,
  batchId: string,
): Promise<LoadedBatch | null> {
  return prisma.batch.findFirst({
    where: { id: batchId, recipeId },
  });
}

export async function generateMetadata({
  params,
}: RouteParams) {
  const { id, batchId } = await params;
  const batch = await loadBatch(id, batchId);
  if (!batch) {
    return { title: "Edit brew — Brew Recipe Library" };
  }
  return {
    title: `Edit brew from ${fmtBrewDate(batch.brewDate.toISOString())} — Brew Recipe Library`,
    description: "Edit a logged brew.",
  };
}

export default async function EditBatchPage({ params }: RouteParams) {
  const { id, batchId } = await params;
  const batch = await loadBatch(id, batchId);
  if (!batch) notFound();

  // The form expects an ISO yyyy-mm-dd string for the date input. Stored
  // `brewDate` is a full datetime; we slice the date portion to avoid the
  // browser applying a TZ shift.
  const brewDateLocal = batch.brewDate.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link
          href={`/recipes/${id}`}
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] no-underline"
        >
          ← Back to recipe
        </Link>
      </nav>
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Edit brew log</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Update the measured values or notes for this brew. Saving replaces
          the row; deleting removes it permanently from the batch history.
        </p>
      </header>
      <BatchForm
        mode="edit"
        recipeId={id}
        batchId={batch.id}
        initial={{
          brewDate: brewDateLocal,
          measuredOg: batch.measuredOg != null ? String(batch.measuredOg) : "",
          measuredFg: batch.measuredFg != null ? String(batch.measuredFg) : "",
          volumeLiters:
            batch.volumeLiters != null ? String(batch.volumeLiters) : "",
          notes: batch.notes ?? "",
        }}
      />
    </div>
  );
}
