import Link from "next/link";

import { normalizeTagName } from "@/lib/tags";

/**
 * Build the URL for the browse page filtered by a specific tag.
 * The query value is the normalised (lower-case) form so it round-trips
 * through the API's case-insensitive matching.
 */
export function tagBrowseHref(name: string): string {
  const norm = normalizeTagName(name);
  if (!norm) return "/";
  const params = new URLSearchParams();
  params.set("tag", norm);
  return `/?${params.toString()}`;
}

interface TagChipProps {
  name: string;
  /** When true, the chip is a link to the filtered browse page. */
  asLink?: boolean;
  /** Visual size variant. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Render a freeform recipe tag as a small rounded "chip" with a `#` prefix.
 * Use `asLink` to make it clickable, navigating to the filtered browse view.
 */
export default function TagChip({
  name,
  asLink = false,
  size = "md",
  className,
}: TagChipProps) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const sizeClass = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";
  const baseClass = `inline-flex items-center gap-0.5 rounded-full font-medium border border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)] ${sizeClass}${
    className ? ` ${className}` : ""
  }`;
  const content = (
    <>
      <span aria-hidden="true">#</span>
      <span>{trimmed}</span>
    </>
  );
  if (!asLink) {
    return <span className={baseClass}>{content}</span>;
  }
  return (
    <Link
      href={tagBrowseHref(trimmed)}
      className={`${baseClass} no-underline hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors`}
      title={`Show all recipes tagged "${trimmed}"`}
    >
      {content}
    </Link>
  );
}
