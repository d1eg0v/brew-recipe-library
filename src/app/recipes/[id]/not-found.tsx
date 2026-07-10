import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-24 text-center">
      <p className="font-mono text-sm text-[var(--muted-foreground)]">404</p>
      <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight">
        Recipe not found
      </h1>
      <p className="mt-3 text-[var(--muted-foreground)]">
        We couldn&apos;t find that recipe in the library.
      </p>
      <Link href="/" className="btn btn-primary mt-6 no-underline">
        Back to all recipes
      </Link>
    </div>
  );
}
