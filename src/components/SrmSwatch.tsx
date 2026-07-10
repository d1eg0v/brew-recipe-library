import { srmToHex, srmToRgb } from "@/lib/brewing/color";

interface SrmSwatchProps {
  /** SRM value to render. Renders an empty/null marker when null/undefined. */
  srm: number | null | undefined;
  /** Visual size preset. `sm` suits cards; `md` suits detail headers. */
  size?: "sm" | "md" | "lg";
  /** Optional override class for layout-specific tweaks. */
  className?: string;
  /** Whether to show the numeric SRM value next to the swatch. */
  showLabel?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<SrmSwatchProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
};

/** Pick a legible foreground (black or white) for a given background colour. */
function pickForeground(r: number, g: number, b: number): string {
  // Relative luminance per WCAG 2.x. 0.5 is a good contrast threshold.
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.5 ? "#1c1208" : "#fbf7ef";
}

/**
 * Render the actual beer colour implied by a SRM value as a small filled
 * square. Pass `null` to render an unobtrusive dash placeholder so callers
 * don't need to special-case missing targets.
 */
export default function SrmSwatch({
  srm,
  size = "sm",
  className,
  showLabel = false,
}: SrmSwatchProps) {
  const dim = SIZE_CLASSES[size];
  if (srm == null || !Number.isFinite(srm)) {
    return (
      <span
        className={`inline-flex items-center gap-1.5${className ? ` ${className}` : ""}`}
        aria-label="SRM not specified"
      >
        <span
          aria-hidden="true"
          className={`${dim} rounded border border-dashed border-[var(--border)] bg-[var(--muted)]`}
        />
        {showLabel && (
          <span className="text-xs text-[var(--muted-foreground)]">SRM —</span>
        )}
      </span>
    );
  }
  const { r, g, b } = srmToRgb(srm);
  const hex = srmToHex(srm);
  const fg = pickForeground(r, g, b);
  return (
    <span
      className={`inline-flex items-center gap-1.5${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={`SRM ${srm.toFixed(1)}`}
      title={`SRM ${srm.toFixed(1)} (${hex})`}
    >
      <span
        aria-hidden="true"
        className={`${dim} rounded border border-[var(--border)] shrink-0`}
        style={{ backgroundColor: hex }}
      />
      {showLabel && (
        <span
          className="text-xs font-mono px-1.5 py-0.5 rounded"
          style={{ backgroundColor: hex, color: fg }}
        >
          {srm.toFixed(1)}
        </span>
      )}
    </span>
  );
}
