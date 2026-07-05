"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "beer", label: "Beer" },
  { value: "mead", label: "Mead" },
  { value: "wine", label: "Wine" },
  { value: "cider", label: "Cider" },
  { value: "other", label: "Other" },
];

export function FilterForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const initialCategory = searchParams.get("category") ?? "";
  const initialStyle = searchParams.get("style") ?? "";

  const [category, setCategory] = useState(initialCategory);
  const [style, setStyle] = useState(initialStyle);

  const onSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const next = new URLSearchParams(searchParams.toString());
      if (category) next.set("category", category);
      else next.delete("category");
      if (style.trim()) next.set("style", style.trim());
      else next.delete("style");
      const qs = next.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [category, style, pathname, router, searchParams],
  );

  const onReset = useCallback(() => {
    setCategory("");
    setStyle("");
    startTransition(() => {
      router.replace(pathname);
    });
  }, [pathname, router]);

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="filter-category"
          className="text-xs font-medium uppercase tracking-wide text-zinc-500"
        >
          Category
        </label>
        <select
          id="filter-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value || "all"} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-1 flex-col gap-1 min-w-[12rem]">
        <label
          htmlFor="filter-style"
          className="text-xs font-medium uppercase tracking-wide text-zinc-500"
        >
          Style contains
        </label>
        <input
          id="filter-style"
          type="text"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          placeholder="e.g. IPA, Mead, Stout"
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:opacity-60"
        >
          {pending ? "Applying…" : "Apply"}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={pending}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Reset
        </button>
      </div>
    </form>
  );
}
