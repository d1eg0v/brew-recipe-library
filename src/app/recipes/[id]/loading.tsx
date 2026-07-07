import { HopMark } from "@/components/icons";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center px-6 py-24 text-[var(--muted-foreground)]">
      <span
        aria-hidden
        className="grid h-12 w-12 animate-pulse place-items-center rounded-xl text-[var(--accent-foreground)]"
        style={{ background: "var(--accent)" }}
      >
        <HopMark className="h-7 w-7" />
      </span>
      <p className="mt-4 text-sm">Pouring the recipe…</p>
    </div>
  );
}
