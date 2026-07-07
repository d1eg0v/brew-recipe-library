import Link from "next/link";

import RecipeForm from "@/components/recipe/RecipeForm";
import { ArrowGlyph, PencilGlyph } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New recipe — Brew Recipe Library",
  description: "Create a new homebrew, mead, or wine recipe.",
};

export default function NewRecipePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <nav className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--muted-foreground)] no-underline hover:text-[var(--foreground)]"
        >
          <ArrowGlyph className="h-3.5 w-3.5 rotate-180" />
          All recipes
        </Link>
      </nav>
      <header className="mb-8 max-w-2xl">
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <PencilGlyph className="h-5 w-5" />
          <span className="label-eyebrow !text-[var(--accent)]">Compose</span>
        </div>
        <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight">
          New recipe
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Saved recipes can be re-edited later. Measurements stay in metric and
          can be converted on the recipe page.
        </p>
      </header>
      <RecipeForm mode="create" />
    </div>
  );
}
