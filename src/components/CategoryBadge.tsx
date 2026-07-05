import { categoryLabel } from "@/lib/ui/format";

const BADGE_CLASSES: Record<string, string> = {
  beer: "bg-[var(--badge-beer-bg)] text-[var(--badge-beer-fg)]",
  mead: "bg-[var(--badge-mead-bg)] text-[var(--badge-mead-fg)]",
  wine: "bg-[var(--badge-wine-bg)] text-[var(--badge-wine-fg)]",
  cider: "bg-[var(--badge-cider-bg)] text-[var(--badge-cider-fg)]",
  other: "bg-[var(--badge-other-bg)] text-[var(--badge-other-fg)]",
};

interface CategoryBadgeProps {
  category: string;
  className?: string;
}

export default function CategoryBadge({
  category,
  className,
}: CategoryBadgeProps) {
  const tone = BADGE_CLASSES[category] ?? BADGE_CLASSES.other;
  return (
    <span
      className={`inline-flex shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${tone}${
        className ? ` ${className}` : ""
      }`}
    >
      {categoryLabel(category)}
    </span>
  );
}