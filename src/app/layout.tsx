import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import UnitToggle from "@/components/UnitToggle";
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
      </head>
      <body className="min-h-full flex flex-col">
        <header className="site-header sticky top-0 z-30">
          <div className="site-header-inner mx-auto max-w-7xl px-5 sm:px-6">
            <div className="flex min-h-[4.6rem] items-center justify-between gap-4 py-3">
              <Link
                href="/"
                className="site-brand group flex min-w-0 items-center gap-3 no-underline"
                aria-label="Brew Recipe Library — home"
              >
                <span
                  className="brand-mark grid h-10 w-10 shrink-0 place-items-center text-[var(--accent-foreground)] transition-transform group-hover:-rotate-6"
                  style={{ background: "var(--accent)" }}
                >
                  <HopMark className="h-6 w-6" />
                </span>
                <span className="flex min-w-0 flex-col leading-none">
                  <span className="font-display truncate text-[1.15rem] font-semibold tracking-tight text-[var(--foreground)]">
                    The Brew Ledger
                  </span>
                  <span className="mt-1 hidden text-[0.63rem] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)] sm:block">
                    recipes &amp; brew notes
                  </span>
                </span>
              </Link>
              <nav className="site-nav flex items-center gap-1.5 sm:gap-2 text-sm" aria-label="Primary navigation">
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
                  className="btn btn-primary btn-sm no-underline"
                >
                  <span aria-hidden>+</span>
                  <span className="hidden md:inline">New recipe</span>
                  <span className="md:hidden">New</span>
                </Link>
                <span className="hidden lg:contents"><UnitToggle /></span>
                <ThemeSwitcher compact />
              </nav>
            </div>
          </div>
        </header>
        <main className="flex-1 w-full">{children}</main>
        <footer className="site-footer mt-16">
          <div className="mx-auto max-w-7xl px-5 py-9 sm:px-6">
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
                    The Brew Ledger
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
