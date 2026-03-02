
import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export type StatementType = "income" | "balance" | "cashflow";

export type LocateStatementsResult = {
  totalPages: number;

  
  topPages: Record<StatementType, number[]>;

  
  pagesForLLM: Record<StatementType, number[]>;
};

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function countNumbers(text: string) {
  const matches = text.match(/-?\d[\d,\.]*/g);
  return matches ? matches.length : 0;
}

function countWords(text: string) {
  const matches = text.match(/[a-zA-Z]+/g);
  return matches ? matches.length : 0;
}

function density(text: string) {
  return countNumbers(text) / Math.max(1, countWords(text));
}

function containsAny(text: string, terms: string[]) {
  return terms.some((t) => text.includes(t));
}

function uniqSorted(nums: number[]) {
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

function expandWithNeighbors(pages: number[], totalPages: number, neighbor = 1) {
  const out: number[] = [];
  for (const p of pages) {
    for (let q = p - neighbor; q <= p + neighbor; q++) {
      if (q >= 1 && q <= totalPages) out.push(q);
    }
  }
  return uniqSorted(out);
}

export async function locateStatements(pdfPath: string): Promise<LocateStatementsResult> {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const totalPages = pdf.numPages;


  const TERMS: Record<StatementType, string[]> = {
    income: [
      "income statement",
      "consolidated statement of income",
      "profit or loss",
      "statement of operations",
    
    ],
    balance: [
      "statement of financial position",
      "balance sheet",
      "consolidated balance sheet",
      "financial position",
    ],
    cashflow: [
      "statement of cash flows",
      "statement of cash flow",
      "consolidated statement of cash flow",
      "cash flow statement",
      "cash flows",
      "cash flow",
    ],
  };

  
  const candidates: Record<StatementType, { page: number; d: number }[]> = {
    income: [],
    balance: [],
    cashflow: [],
  };

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const raw = content.items.map((item: any) => item.str).join(" ");
    const text = normalize(raw);

    const d = density(text);

    
    (Object.keys(TERMS) as StatementType[]).forEach((type) => {
      if (containsAny(text, TERMS[type])) {
        candidates[type].push({ page: i, d });
      }
    });
  }

  
  const TOP_N = 5;

  const topPages: Record<StatementType, number[]> = {
    income: [],
    balance: [],
    cashflow: [],
  };

  (Object.keys(candidates) as StatementType[]).forEach((type) => {
    const ranked = candidates[type]
      .sort((a, b) => b.d - a.d)
      .slice(0, TOP_N)
      .map((x) => x.page);

    topPages[type] = uniqSorted(ranked);
  });


  const pagesForLLM: Record<StatementType, number[]> = {
    income: expandWithNeighbors(topPages.income, totalPages, 1),
    balance: expandWithNeighbors(topPages.balance, totalPages, 1),
    cashflow: expandWithNeighbors(topPages.cashflow, totalPages, 2),
  };

  return {
    totalPages,
    topPages,
    pagesForLLM,
  };
}