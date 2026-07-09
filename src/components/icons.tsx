// Inline SVG icon set for the Brew Recipe Library.
//
// Single source so glyphs stay consistent, inherit `currentColor`, and add
// zero runtime dependencies. Keep strokes at 1.6 for the warm-paper aesthetic.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Hop cone — the library mark. */
export function HopMark({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <path d="M12 2c-1.4 1.6-2.2 3.4-2.4 5.2C8 6.4 6.2 6 4.2 6.3c.4 2 .9 3.7 2.2 5.1-1.6.4-3 1.3-4 2.8 1.4 1 2.9 1.5 4.5 1.5-.3 1.6 0 3.2.9 4.7 1.6-.7 2.9-1.7 3.7-3.1.8 1.4 2.1 2.4 3.7 3.1.9-1.5 1.2-3.1.9-4.7 1.6 0 3.1-.5 4.5-1.5-1-1.5-2.4-2.4-4-2.8 1.3-1.4 1.8-3.1 2.2-5.1-2-.3-3.8.1-5.4.9C14.2 5.4 13.4 3.6 12 2Z" />
      <path d="M12 7.4c0 4 .4 8.4 0 13" />
      <path d="M9 9.2c1 .5 2 .8 3 .8s2-.3 3-.8" />
      <path d="M8.2 12.4c1.2.6 2.5.9 3.8.9s2.6-.3 3.8-.9" />
    </svg>
  );
}

export function BeerGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <path d="M7 8v9.5A2.5 2.5 0 0 0 9.5 20h4A2.5 2.5 0 0 0 16 17.5V8Z" />
      <path d="M16 10h2.4A1.6 1.6 0 0 1 20 11.6v3.8A1.6 1.6 0 0 1 18.4 17H16" />
      <path d="M9 5.2c-.5.6-.5 1.4 0 2M12 4.6c-.6.7-.6 1.6 0 2.4M15 5.2c-.5.6-.5 1.4 0 2" />
    </svg>
  );
}

export function MeadGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <path d="M8 3h8l-1 5a4 4 0 0 1-2 2.8V19" />
      <path d="M16 3 15 8a4 4 0 0 1-2 2.8" />
      <path d="M13 19v2h-2v-2" />
      <path d="M8 19h8" />
    </svg>
  );
}

export function WineGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <path d="M7 3h10v4a5 5 0 0 1-10 0Z" />
      <path d="M7 6c1.6.9 3.4 1.4 5 1.4S15.4 6.9 17 6" />
      <path d="M12 12v6" />
      <path d="M8 21h8" />
      <path d="M9 18h6" />
    </svg>
  );
}

export function CiderGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <path d="M12 7c-2.5 2-4 3.8-4 6.2A4 4 0 0 0 12 17a4 4 0 0 0 4-3.8C16 10.8 14.5 9 12 7Z" />
      <path d="M12 6.6V4" />
      <path d="M10.2 4.6c.4.8 1.2 1.2 1.8 1.2s1.4-.4 1.8-1.2" />
    </svg>
  );
}

export function OtherGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <path d="M5 7h14l-1.4 11.2A2 2 0 0 1 15.6 20H8.4a2 2 0 0 1-2-1.8Z" />
      <path d="M9 7c0-1.6 1.3-3 3-3s3 1.4 3 3" />
    </svg>
  );
}

export function ScaleGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <path d="M4 7h11" />
      <path d="M9.5 7 7 13a3 3 0 0 0 5 0L9.5 7Z" />
      <path d="M15 7v10a3 3 0 0 0 3 3" />
      <path d="M4 20h16" />
    </svg>
  );
}

export function GrainGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <path d="M12 3v18" />
      <path d="M12 6c-2 0-4 .8-4 2.5C8 7 10 6.5 12 6.5" />
      <path d="M12 9.5c-2 0-4 .8-4 2.5 0-1.5 2-2 4-2" />
      <path d="M12 13c-2 0-4 .8-4 2.5 0-1.5 2-2 4-2" />
      <path d="M12 6c2 0 4 .8 4 2.5C16 7 14 6.5 12 6.5" />
      <path d="M12 9.5c2 0 4 .8 4 2.5 0-1.5-2-2-4-2" />
      <path d="M12 13c2 0 4 .8 4 2.5 0-1.5-2-2-4-2" />
    </svg>
  );
}

export function HopGlyph({ className, ...rest }: IconProps) {
  return <HopMark className={className} {...rest} />;
}

export function YeastGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <circle cx="9" cy="9" r="2.4" />
      <circle cx="15" cy="10" r="1.8" />
      <circle cx="12" cy="15" r="2.6" />
      <circle cx="7.5" cy="14" r="1.3" />
      <circle cx="16.5" cy="15" r="1.1" />
    </svg>
  );
}

export function MashGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <path d="M5 10h14l-1 7a3 3 0 0 1-3 2.6H9A3 3 0 0 1 6 17Z" />
      <path d="M8 10c0-2 1.8-3 4-3s4 1 4 3" />
      <path d="M5 13c1.2.6 2.6.9 4 .9" />
    </svg>
  );
}

export function FlaskGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <path d="M9 3h6" />
      <path d="M10 3v6L5.4 17.2A2 2 0 0 0 7.2 20h9.6a2 2 0 0 0 1.8-2.8L14 9V3" />
      <path d="M7.8 14h8.4" />
    </svg>
  );
}

export function ClockGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

export function SearchGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

export function BasketGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <path d="M3.5 9h17l-1.6 8.5A2 2 0 0 1 17 19H7a2 2 0 0 1-2-1.5L3.5 9Z" />
      <path d="M8 9 11 3" />
      <path d="M16 9 13 3" />
      <path d="M9 13v3" />
      <path d="M15 13v3" />
    </svg>
  );
}

export function NoteGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <path d="M5 4h11l3 3v13H5Z" />
      <path d="M16 4v3h3" />
      <path d="M8 12h8" />
      <path d="M8 15.5h6" />
    </svg>
  );
}

export function PencilGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <path d="M5 19l1-4L16 5l3 3L9 18l-4 1Z" />
      <path d="M14 7l3 3" />
    </svg>
  );
}

export function ArrowGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function PlusGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function PrintGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <path d="M7 9V3h10v6" />
      <path d="M5 9h14a1 1 0 0 1 1 1v6h-4v4H8v-4H4v-6a1 1 0 0 1 1-1Z" />
      <path d="M9 14h6v4H9z" />
    </svg>
  );
}

/**
 * Outline star (BRE-46) — the unfavorited state. Inherits `currentColor`,
 * matching the rest of the icon set, so theme colours come along for free.
 */
export function StarGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} {...rest}>
      <path d="M12 3.6 14.7 9l5.9.6-4.4 4 1.3 5.8L12 16.6 6.5 19.4 7.8 13.6 3.4 9.6 9.3 9Z" />
    </svg>
  );
}

/**
 * Filled star (BRE-46) — the favorited state. Same outline as `StarGlyph`
 * but rendered solid so the two states read clearly at a glance on cards.
 */
export function StarFillGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...rest}>
      <path
        d="M12 3.6 14.7 9l5.9.6-4.4 4 1.3 5.8L12 16.6 6.5 19.4 7.8 13.6 3.4 9.6 9.3 9Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Map a recipe category to its glyph. */
export function categoryGlyph(category: string | null | undefined) {
  switch (category) {
    case "beer":
      return BeerGlyph;
    case "mead":
      return MeadGlyph;
    case "wine":
      return WineGlyph;
    case "cider":
      return CiderGlyph;
    default:
      return OtherGlyph;
  }
}

/**
 * Render the correct category glyph from a `category` prop.
 *
 * Declared at module scope (rather than `const Glyph = categoryGlyph(c)`
 * inside a parent) so it satisfies `react-hooks/static-components`.
 */
export function CategoryGlyph({
  category,
  className,
  ...rest
}: IconProps & { category: string | null | undefined }) {
  switch (category) {
    case "beer":
      return <BeerGlyph className={className} {...rest} />;
    case "mead":
      return <MeadGlyph className={className} {...rest} />;
    case "wine":
      return <WineGlyph className={className} {...rest} />;
    case "cider":
      return <CiderGlyph className={className} {...rest} />;
    default:
      return <OtherGlyph className={className} {...rest} />;
  }
}
