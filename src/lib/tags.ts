// Pure helpers for working with recipe tags (BRE-29).
//
// Tag names are user-supplied freeform strings ("session", "competition",
// "summer"). On write we normalise them to:
//   - trim surrounding whitespace
//   - collapse internal runs of whitespace
//   - lower-case (so equality is case-insensitive)
// The DB unique index on `Tag.name` then prevents duplicates. The UI surfaces
// the original casing on first add, but the canonical stored form is the
// normalised one.

const MAX_TAG_LENGTH = 50;

/** Normalise a single tag name to its canonical form. Returns null for empty/invalid input. */
export function normalizeTagName(input: string): string | null {
  if (typeof input !== "string") return null;
  const collapsed = input.replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) return null;
  if (collapsed.length > MAX_TAG_LENGTH) {
    return collapsed.slice(0, MAX_TAG_LENGTH).trim();
  }
  return collapsed.toLowerCase();
}

/**
 * Normalise + dedupe an array of tag inputs while preserving first-seen order.
 *   normalizeTagNames(["Summer", "summer", "  Session "]) -> ["summer", "session"]
 * Empty / unparseable entries are dropped.
 */
export function normalizeTagNames(inputs: readonly string[] | undefined | null): string[] {
  if (!inputs || inputs.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of inputs) {
    const norm = normalizeTagName(raw);
    if (norm == null) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out;
}
