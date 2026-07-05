import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
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
            <nav className="text-sm text-[var(--muted-foreground)]">
              <Link href="/" className="hover:text-[var(--foreground)]">
                Browse
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-8">
          {children}
        </main>
        <footer className="border-t border-[var(--border)] bg-[var(--card)]/60">
          <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-[var(--muted-foreground)]">
            Brew Recipe Library — quantities stored in metric; toggle imperial
            on any recipe page.
          </div>
        </footer>
      </body>
    </html>
  );
}