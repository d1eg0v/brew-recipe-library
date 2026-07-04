-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "description" TEXT,
    "notes" TEXT,
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

-- CreateTable
CREATE TABLE "Fermentable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'grain',
    "amountKg" REAL NOT NULL,
    "colorLovibond" REAL,
    "potentialPpg" REAL,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Fermentable_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Hop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountGrams" REAL NOT NULL,
    "alphaAcidPct" REAL,
    "timeMinutes" INTEGER NOT NULL DEFAULT 60,
    "use" TEXT NOT NULL DEFAULT 'boil',
    "form" TEXT NOT NULL DEFAULT 'pellet',
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Hop_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Yeast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "laboratory" TEXT,
    "productId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'ale',
    "form" TEXT NOT NULL DEFAULT 'dry',
    "attenuationPct" REAL,
    "temperatureCMin" REAL,
    "temperatureCMax" REAL,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Yeast_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MashStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'infusion',
    "stepTempC" REAL NOT NULL,
    "stepTimeMinutes" INTEGER NOT NULL DEFAULT 60,
    "infuseAmountLiters" REAL,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MashStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Recipe_styleName_idx" ON "Recipe"("styleName");

-- CreateIndex
CREATE INDEX "Recipe_bjcpCategory_idx" ON "Recipe"("bjcpCategory");

-- CreateIndex
CREATE INDEX "Fermentable_recipeId_idx" ON "Fermentable"("recipeId");

-- CreateIndex
CREATE INDEX "Hop_recipeId_idx" ON "Hop"("recipeId");

-- CreateIndex
CREATE INDEX "Yeast_recipeId_idx" ON "Yeast"("recipeId");

-- CreateIndex
CREATE INDEX "MashStep_recipeId_idx" ON "MashStep"("recipeId");
