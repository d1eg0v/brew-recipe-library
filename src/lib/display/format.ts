// Display-side formatters that take whatever units the recipe is in and
// present a consistent human-readable string. All inputs are the canonical
// metric values from the DB / API response — the imperial fields are *added*
// alongside by `presentRecipe` and are read here when present.

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const TIGHT_NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const INTEGER_FORMATTER = new Intl.NumberFormat("en-US");

function fmt(n: number, formatter: Intl.NumberFormat): string {
  if (!Number.isFinite(n)) return "—";
  return formatter.format(n);
}

export function fmtKg(kg: number | null | undefined, units: "metric" | "imperial"): string {
  if (kg == null) return "—";
  if (units === "imperial") {
    return `${fmt(kg * 2.2046226218, NUMBER_FORMATTER)} lb`;
  }
  return `${fmt(kg, NUMBER_FORMATTER)} kg`;
}

export function fmtGrams(g: number | null | undefined, units: "metric" | "imperial"): string {
  if (g == null) return "—";
  if (units === "imperial") {
    return `${fmt(g / 28.349523125, TIGHT_NUMBER_FORMATTER)} oz`;
  }
  return `${fmt(g, INTEGER_FORMATTER)} g`;
}

export function fmtLiters(l: number | null | undefined, units: "metric" | "imperial"): string {
  if (l == null) return "—";
  if (units === "imperial") {
    return `${fmt(l / 3.785411784, NUMBER_FORMATTER)} gal`;
  }
  return `${fmt(l, NUMBER_FORMATTER)} L`;
}

export function fmtTempC(c: number | null | undefined, units: "metric" | "imperial"): string {
  if (c == null) return "—";
  if (units === "imperial") {
    return `${fmt((c * 9) / 5 + 32, INTEGER_FORMATTER)} °F`;
  }
  return `${fmt(c, INTEGER_FORMATTER)} °C`;
}

export function fmtGravity(sg: number | null | undefined): string {
  if (sg == null) return "—";
  return sg.toFixed(3);
}

export function fmtAbv(abv: number | null | undefined): string {
  if (abv == null) return "—";
  return `${fmt(abv, NUMBER_FORMATTER)}%`;
}

export function fmtIbu(ibu: number | null | undefined): string {
  if (ibu == null) return "—";
  return INTEGER_FORMATTER.format(Math.round(ibu));
}

export function fmtSrm(srm: number | null | undefined): string {
  if (srm == null) return "—";
  return TIGHT_NUMBER_FORMATTER.format(srm);
}

/** Choose the best amount field for a fermentable depending on unit system. */
export function pickFermentableAmount(
  f: Record<string, unknown>,
  units: "metric" | "imperial",
): { value: string; secondary?: string } {
  const amountKg = typeof f.amountKg === "number" ? f.amountKg : null;
  const amountLiters = typeof f.amountLiters === "number" ? f.amountLiters : null;
  if (units === "imperial") {
    if (amountKg != null) {
      return {
        value: `${fmt(amountKg * 2.2046226218, NUMBER_FORMATTER)} lb`,
        secondary: amountLiters != null
          ? `${fmt(amountLiters / 3.785411784, NUMBER_FORMATTER)} gal`
          : undefined,
      };
    }
    if (amountLiters != null) {
      return {
        value: `${fmt(amountLiters / 3.785411784, NUMBER_FORMATTER)} gal`,
      };
    }
    return { value: "—" };
  }
  if (amountKg != null) {
    return {
      value: `${fmt(amountKg, NUMBER_FORMATTER)} kg`,
      secondary: amountLiters != null
        ? `${fmt(amountLiters, NUMBER_FORMATTER)} L`
        : undefined,
    };
  }
  if (amountLiters != null) {
    return {
      value: `${fmt(amountLiters, NUMBER_FORMATTER)} L`,
    };
  }
  return { value: "—" };
}

export function pickHopAmount(
  h: Record<string, unknown>,
  units: "metric" | "imperial",
): string {
  const g = typeof h.amountGrams === "number" ? h.amountGrams : null;
  if (g == null) return "—";
  if (units === "imperial") {
    return `${fmt(g / 28.349523125, TIGHT_NUMBER_FORMATTER)} oz`;
  }
  return `${fmt(g, INTEGER_FORMATTER)} g`;
}

export function pickBatchSize(
  l: number | null | undefined,
  units: "metric" | "imperial",
): string {
  if (l == null) return "—";
  if (units === "imperial") {
    return `${fmt(l / 3.785411784, NUMBER_FORMATTER)} gal`;
  }
  return `${fmt(l, NUMBER_FORMATTER)} L`;
}

export function categoryLabel(category: string): string {
  switch (category) {
    case "beer":
      return "Beer";
    case "mead":
      return "Mead";
    case "wine":
      return "Wine";
    case "cider":
      return "Cider";
    case "other":
      return "Other";
    default:
      return category;
  }
}
