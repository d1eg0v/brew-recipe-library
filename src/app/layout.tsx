import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import UnitToggle from "@/components/UnitToggle";
import { THEME_BOOT_SCRIPT } from "@/lib/theme/bootScript";
import { UNIT_BOOT_SCRIPT } from "@/lib/units/bootScript";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: UNIT_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-6">
            <Link
              href="/"
              className="flex items-baseline gap-3 text-[var(--foreground)] no-underline"
            >
              <span className="text-xl font-semibold tracking-tight">
                Brew Recipe Library
              </span>
              <span className="hidden sm:inline text-sm text-[var(--muted-foreground)]">
                beer · mead · wine
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-[var(--muted-foreground)]">
              <Link href="/" className="hover:text-[var(--foreground)]">
                Browse
              </Link>
              <UnitToggle />
              <ThemeSwitcher />
            </nav>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-8">
          {children}
        </main>
        <footer className="border-t border-[var(--border)] bg-[var(--card)]/60">
          <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-[var(--muted-foreground)]">
            Brew Recipe Library — quantities stored in metric; use the header
            toggle to switch between metric and imperial.
          </div>
        </footer>
      </body>
    </html>
  );
}