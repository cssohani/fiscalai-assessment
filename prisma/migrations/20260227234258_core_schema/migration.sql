-- CreateTable
CREATE TABLE "Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "irUrl" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Document" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "localPath" TEXT,
    "sha256" TEXT,
    "bytes" INTEGER,
    "mime" TEXT,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" INTEGER NOT NULL,
    CONSTRAINT "Document_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Filing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "reason" TEXT,
    "fiscalYear" INTEGER,
    "publishedAt" DATETIME,
    "companyId" INTEGER NOT NULL,
    "documentId" INTEGER NOT NULL,
    CONSTRAINT "Filing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Filing_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatementRaw" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "statementType" TEXT NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "columnsJson" TEXT NOT NULL,
    "rowsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filingId" INTEGER NOT NULL,
    CONSTRAINT "StatementRaw_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "Filing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_irUrl_key" ON "Company"("irUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Document_companyId_url_key" ON "Document"("companyId", "url");
