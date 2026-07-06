import Link from "next/link";

import RecipeForm from "@/components/recipe/RecipeForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New recipe — Brew Recipe Library",
  description: "Create a new homebrew, mead, or wine recipe.",
};

export default function NewRecipePage() {
  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link
          href="/"
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] no-underline"
        >
          ← All recipes
        </Link>
      </nav>
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">New recipe</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Saved recipes can be re-edited later. Measurements stay in metric and
          can be converted on the recipe page.
        </p>
      </header>
      <RecipeForm mode="create" />
    </div>
  );
}
