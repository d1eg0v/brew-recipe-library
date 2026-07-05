import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center space-y-3">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-[var(--muted-foreground)]">
        That URL didn&apos;t match any recipe.
      </p>
      <p>
        <Link href="/" className="font-medium">
          Browse all recipes
        </Link>
      </p>
    </div>
  );
}