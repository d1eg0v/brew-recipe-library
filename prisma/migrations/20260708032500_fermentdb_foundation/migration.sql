-- FermentDB foundation: additive schema extensions for multi-beverage recipes,
-- chemistry targets, yeast strain tolerance, and flexible batch log events.

ALTER TABLE "Recipe" ADD COLUMN "beverage_type" TEXT NOT NULL DEFAULT 'beer';
UPDATE "Recipe" SET "beverage_type" = COALESCE("category", 'beer');
ALTER TABLE "Recipe" ADD COLUMN "target_ph" REAL;

ALTER TABLE "Yeast" ADD COLUMN "abvTolerancePct" REAL;

CREATE TABLE "BatchLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "batchId" TEXT,
    "logDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL DEFAULT 'note',
    "gravity" REAL,
    "ph" REAL,
    "temperatureC" REAL,
    "volumeLiters" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BatchLog_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BatchLog_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BatchLog_recipeId_idx" ON "BatchLog"("recipeId");
CREATE INDEX "BatchLog_batchId_idx" ON "BatchLog"("batchId");
CREATE INDEX "BatchLog_logDate_idx" ON "BatchLog"("logDate");
