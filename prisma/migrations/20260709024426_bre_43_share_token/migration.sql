-- BRE-43: Shareable read-only recipe links.
-- A nullable, unique opaque token that turns a recipe into a public,
-- unguessable /share/[token] URL. Null = not shareable; setting it issues a
-- link; clearing it revokes it.

ALTER TABLE "Recipe" ADD COLUMN "shareToken" TEXT;

CREATE UNIQUE INDEX "Recipe_shareToken_key" ON "Recipe"("shareToken");
