// 404 page for `/share/[token]`. Surfaces the "link not found" with a path
// back to the public library browse list, instead of the bare app default.

import Link from "next/link";

export default function ShareNotFound() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-24 text-center">
      <p className="font-mono text-sm text-[var(--muted-foreground)]">404</p>
      <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight">
        Shared recipe not found
      </h1>
      <p className="mt-3 text-[var(--muted-foreground)]">
        That share link is no longer active, or the recipe was never shareable.
      </p>
      <Link href="/" className="btn btn-primary mt-6 no-underline">
        Back to all recipes
      </Link>
    </div>
  );
}
