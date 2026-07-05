import Link from "next/link";

export default function RecipeNotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-20 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Recipe not found</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        The recipe you were looking for doesn&apos;t exist or has been removed.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
      >
        Back to all recipes
      </Link>
    </main>
  );
}
