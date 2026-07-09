import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import UnitToggle from "@/components/UnitToggle";
import { FAVORITES_BOOT_SCRIPT } from "@/lib/favorites/bootScript";
import { THEME_BOOT_SCRIPT } from "@/lib/theme/bootScript";
import { UNIT_BOOT_SCRIPT } from "@/lib/units/bootScript";
import { HopMark } from "@/components/icons";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK"],
});

export const metadata: Metadata = {
  title: "Brew Recipe Library",
  description:
    "Browse, search, and scale home-brewing recipes for beer, mead, and wine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      data-units="metric"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: UNIT_BOOT_SCRIPT }} />
        {/* BRE-46: prime `data-favorites-count` from localStorage before paint
            so the server-rendered card grid matches the user's stored set
            on first paint. */}
        <script
          dangerouslySetInnerHTML={{ __html: FAVORITES_BOOT_SCRIPT }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_82%,transparent)] backdrop-blur-md">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex h-16 items-center justify-between gap-6">
              <Link
                href="/"
                className="group flex items-center gap-3 no-underline"
                aria-label="Brew Recipe Library — home"
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl text-[var(--accent-foreground)] shadow-sm transition-transform group-hover:-rotate-6"
                  style={{ background: "var(--accent)" }}
                >
                  <HopMark className="h-6 w-6" />
                </span>
                <span className="flex flex-col leading-none">
                  <span className="font-display text-[1.15rem] font-semibold tracking-tight text-[var(--foreground)]">
                    Brew Recipe Library
                  </span>
                  <span className="mt-1 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    beer · mead · wine · cider
                  </span>
                </span>
              </Link>
              <nav className="flex items-center gap-1.5 sm:gap-2 text-sm">
                <Link
                  href="/"
                  className="btn btn-ghost btn-sm hidden sm:inline-flex"
                >
                  Browse
                </Link>
                <Link
                  href="/priming-sugar"
                  className="btn btn-ghost btn-sm hidden sm:inline-flex"
                >
                  Priming sugar
                </Link>
                <Link
                  href="/abv"
                  className="btn btn-ghost btn-sm hidden sm:inline-flex"
                >
                  ABV
                </Link>
                <Link
                  href="/strike-water"
                  className="btn btn-ghost btn-sm hidden sm:inline-flex"
                >
                  Strike water
                </Link>
                <Link
                  href="/recipes/new"
                  className="btn btn-outline btn-sm no-underline"
                >
                  <span aria-hidden className="text-[var(--accent)]">+</span>
                  New
                </Link>
                <UnitToggle />
                <ThemeSwitcher />
              </nav>
            </div>
          </div>
        </header>
        <main className="flex-1 w-full">{children}</main>
        <footer className="mt-16 border-t border-[var(--border)] bg-[var(--surface-2)]/60">
          <div className="mx-auto max-w-6xl px-6 py-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[var(--foreground)]">
                  <span
                    aria-hidden
                    className="grid h-7 w-7 place-items-center rounded-lg text-[var(--accent-foreground)]"
                    style={{ background: "var(--accent)" }}
                  >
                    <HopMark className="h-4 w-4" />
                  </span>
                  <span className="font-display text-base font-semibold tracking-tight">
                    Brew Recipe Library
                  </span>
                </div>
                <p className="mt-2 max-w-md text-sm text-[var(--muted-foreground)]">
                  A field notebook for home fermentations. Quantities are stored
                  in metric — use the header toggle to switch between metric and
                  imperial.
                </p>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Beer colour swatches derived from each recipe&apos;s SRM.
                <br />
                Brewed, not bought.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
