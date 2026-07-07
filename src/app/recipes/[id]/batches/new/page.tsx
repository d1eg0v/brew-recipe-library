import Link from "next/link";
import { notFound } from "next/navigation";

import BatchForm from "@/components/batch/BatchForm";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

async function recipeExists(id: string): Promise<{ id: string; title: string } | null> {
  return prisma.recipe.findUnique({
    where: { id },
    select: { id: true, title: true },
  });
}

export async function generateMetadata({ params }: RouteParams) {
  const { id } = await params;
  const row = await recipeExists(id);
  if (!row) {
    return { title: "Log a brew — Brew Recipe Library" };
  }
  return {
    title: `Log a brew of ${row.title} — Brew Recipe Library`,
    description: `Record a new brew log for the recipe “${row.title}”.`,
  };
}

export default async function NewBatchPage({ params }: RouteParams) {
  const { id } = await params;
  const recipe = await recipeExists(id);
  if (!recipe) notFound();

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
        <h1 className="text-3xl font-bold tracking-tight">Log a brew</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Record the measured values for this brew of{" "}
          <span className="font-medium text-[var(--foreground)]">
            {recipe.title}
          </span>
          . The brew date is required; OG/FG/volume are optional and can be
          filled in later.
        </p>
      </header>
      <BatchForm mode="create" recipeId={id} />
    </div>
  );
}
