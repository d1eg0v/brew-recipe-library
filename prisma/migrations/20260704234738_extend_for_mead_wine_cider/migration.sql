-- CreateTable
CREATE TABLE "ProcessStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "tempC" REAL,
    "durationDays" REAL,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProcessStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Addition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" REAL,
    "unit" TEXT,
    "purpose" TEXT,
    "timing" TEXT,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Addition_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Fermentable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'grain',
    "amountKg" REAL,
    "amountLiters" REAL,
    "colorLovibond" REAL,
    "potentialPpg" REAL,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Fermentable_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Fermentable" ("amountKg", "colorLovibond", "id", "name", "notes", "position", "potentialPpg", "recipeId", "type") SELECT "amountKg", "colorLovibond", "id", "name", "notes", "position", "potentialPpg", "recipeId", "type" FROM "Fermentable";
DROP TABLE "Fermentable";
ALTER TABLE "new_Fermentable" RENAME TO "Fermentable";
CREATE INDEX "Fermentable_recipeId_idx" ON "Fermentable"("recipeId");
CREATE TABLE "new_Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "category" TEXT NOT NULL DEFAULT 'beer',
    "styleName" TEXT,
    "bjcpCategory" TEXT,
    "batchSizeLiters" REAL NOT NULL DEFAULT 20,
    "boilTimeMinutes" INTEGER NOT NULL DEFAULT 60,
    "efficiencyPct" REAL NOT NULL DEFAULT 75,
    "targetOg" REAL,
    "targetFg" REAL,
    "targetAbv" REAL,
    "targetIbu" REAL,
    "targetSrm" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Recipe" ("author", "batchSizeLiters", "bjcpCategory", "boilTimeMinutes", "createdAt", "description", "efficiencyPct", "id", "notes", "styleName", "targetAbv", "targetFg", "targetIbu", "targetOg", "targetSrm", "title", "updatedAt") SELECT "author", "batchSizeLiters", "bjcpCategory", "boilTimeMinutes", "createdAt", "description", "efficiencyPct", "id", "notes", "styleName", "targetAbv", "targetFg", "targetIbu", "targetOg", "targetSrm", "title", "updatedAt" FROM "Recipe";
DROP TABLE "Recipe";
ALTER TABLE "new_Recipe" RENAME TO "Recipe";
CREATE INDEX "Recipe_styleName_idx" ON "Recipe"("styleName");
CREATE INDEX "Recipe_bjcpCategory_idx" ON "Recipe"("bjcpCategory");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProcessStep_recipeId_idx" ON "ProcessStep"("recipeId");

-- CreateIndex
CREATE INDEX "Addition_recipeId_idx" ON "Addition"("recipeId");
