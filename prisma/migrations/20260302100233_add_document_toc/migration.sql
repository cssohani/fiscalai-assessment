-- CreateTable
CREATE TABLE "DocumentTOC" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "documentId" INTEGER NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "snippetType" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    CONSTRAINT "DocumentTOC_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTOC_documentId_pageNumber_key" ON "DocumentTOC"("documentId", "pageNumber");
