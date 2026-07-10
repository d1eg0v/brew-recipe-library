-- CreateTable
CREATE TABLE "BjcpStyle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'beer',
    "ogMin" REAL,
    "ogMax" REAL,
    "fgMin" REAL,
    "fgMax" REAL,
    "ibuMin" REAL,
    "ibuMax" REAL,
    "srmMin" REAL,
    "srmMax" REAL,
    "abvMin" REAL,
    "abvMax" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BjcpStyle_code_key" ON "BjcpStyle"("code");
