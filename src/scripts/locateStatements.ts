import "dotenv/config";
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  require("pdfjs-dist/legacy/build/pdf.worker.js");

const TOC_PAGES = 15;

const KEYWORDS = [
  "income statement",
  "statement of profit",
  "profit or loss",
  "statement of financial position",
  "balance sheet",
  "cash flow",
  "statement of cash",
];

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ");
}

async function extractPageText(pdfPath: string, pageNumber: number) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();

  return content.items.map((item: any) => item.str).join(" ");
}

async function main() {
  console.log("Starting lightweight statement locator...\n");

  const documents = await prisma.document.findMany({
    where: { localPath: { not: null } },
  });

  for (const doc of documents) {
    const already = await prisma.documentSnippet.findFirst({
      where: { documentId: doc.id },
    });

    if (already) {
      console.log(`✓ Skipping doc ${doc.id} (already processed)`);
      continue;
    }

    if (!doc.localPath) continue;

    console.log(`Processing doc ${doc.id}...`);

    const data = new Uint8Array(fs.readFileSync(doc.localPath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    const totalPages = pdf.numPages;

    const pagesToStore = new Set<number>();

    // 1️⃣ Store TOC window
    for (let i = 1; i <= Math.min(TOC_PAGES, totalPages); i++) {
      pagesToStore.add(i);
    }

    // 2️⃣ Keyword scan
    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item: any) => item.str).join(" ");
      const normalized = normalize(text);

      if (KEYWORDS.some((kw) => normalized.includes(kw))) {
        pagesToStore.add(i);
        if (i > 1) pagesToStore.add(i - 1);
        if (i < totalPages) pagesToStore.add(i + 1);
      }
    }

    // 3️⃣ Save selected pages
    for (const pageNumber of pagesToStore) {
      const text = await extractPageText(doc.localPath, pageNumber);

      const snippetType =
        pageNumber <= TOC_PAGES ? "toc" : "keyword";

      await prisma.documentSnippet.create({
        data: {
          documentId: doc.id,
          pageNumber,
          snippetType,
          text,
        },
      });
    }

    console.log(
      `✓ Stored ${pagesToStore.size} snippet pages (out of ${totalPages})`
    );
  }

  console.log("\nStatement locator complete.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });