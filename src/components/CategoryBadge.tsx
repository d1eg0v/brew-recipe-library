import { categoryLabel } from "@/lib/ui/format";
import { CategoryGlyph } from "@/components/icons";

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
  withIcon?: boolean;
}

export default function CategoryBadge({
  category,
  className,
  withIcon = false,
}: CategoryBadgeProps) {
  const tone = BADGE_CLASSES[category] ?? BADGE_CLASSES.other;
  return (
    <span
      className={`inline-flex items-center gap-1.5 shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${tone}${
        className ? ` ${className}` : ""
      }`}
    >
      {withIcon ? (
        <CategoryGlyph category={category} className="h-3.5 w-3.5" />
      ) : null}
      {categoryLabel(category)}
    </span>
  );
}
