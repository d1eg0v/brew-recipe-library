export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-4xl font-bold tracking-tight">Brew Recipe Library</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Browse, search, and manage home-brewing recipes — grain bills, hop
        schedules, yeast, mash steps, and target OG/FG/IBU/SRM/ABV.
      </p>
      <p className="text-sm text-zinc-500">
        Scaffolding stage: Next.js + Prisma/SQLite are set up. Recipe browsing,
        CRUD, and brewing calculations are coming next.
      </p>
    </main>
  );
}
