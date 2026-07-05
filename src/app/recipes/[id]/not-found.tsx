import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center space-y-3">
      <h1 className="text-2xl font-bold">Recipe not found</h1>
      <p className="text-[var(--muted-foreground)]">
        We couldn&apos;t find that recipe in the library.
      </p>
      <p>
        <Link href="/" className="font-medium">
          Back to all recipes
        </Link>
      </p>
    </div>
  );
}