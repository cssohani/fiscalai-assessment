import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export type StatementType = "income" | "balance" | "cashflow";

export type LocateResult = {
  totalPages: number;
  bestWindow: number[];
  statements: Record<StatementType, number[]>;
};

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function extractDistinctYears(text: string): number {
  const matches = text.match(/\b20\d{2}\b/g) ?? [];
  return new Set(matches).size;
}

function extractNumbers(text: string): number {
  const matches = text.match(/-?\d[\d,\.]*/g) ?? [];
  return matches.length;
}

function expand(page: number, total: number, size: number) {
  const pages: number[] = [];
  for (let i = page - size; i <= page + size; i++) {
    if (i >= 1 && i <= total) pages.push(i);
  }
  return pages;
}

export async function locateStatements(
  pdfPath: string
): Promise<LocateResult> {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const totalPages = pdf.numPages;

  const pageScores: number[] = [];

  // --- 1. Score every page ---
  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = normalize(
      content.items.map((item: any) => item.str).join(" ")
    );

    const yearCount = extractDistinctYears(text);
    const numberCount = extractNumbers(text);

    const score = numberCount + yearCount * 25;

    pageScores.push(score);
  }

  // --- 2. Sliding window selection ---
  const WINDOW_SIZE = 16;
  let bestScore = 0;
  let bestStart = 1;

  for (let i = 0; i <= totalPages - WINDOW_SIZE; i++) {
    let sum = 0;
    for (let j = 0; j < WINDOW_SIZE; j++) {
      sum += pageScores[i + j];
    }

    if (sum > bestScore) {
      bestScore = sum;
      bestStart = i + 1;
    }
  }

  const bestWindow = [];
  for (let i = 0; i < WINDOW_SIZE; i++) {
    bestWindow.push(bestStart + i);
  }

  // --- 3. Classify inside best window ---
  const statements: Record<StatementType, number[]> = {
    income: [],
    balance: [],
    cashflow: [],
  };

  for (const pageNum of bestWindow) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const text = normalize(
      content.items.map((item: any) => item.str).join(" ")
    );

    if (
      text.includes("income") ||
      text.includes("profit") ||
      text.includes("operations")
    ) {
      statements.income.push(pageNum);
    }

    if (
        text.includes("financial position") ||
        text.includes("balance sheet") ||
        text.includes("assets") && text.includes("liabilities")
        ) {
      statements.balance.push(pageNum);
    }

    if (text.includes("cash flow")) {
      statements.cashflow.push(pageNum);
    }
  }

  // --- 4. Expand statement pages slightly for LLM ---
  const EXPAND_SIZE = 2;

  statements.income = Array.from(
    new Set(
      statements.income.flatMap((p) =>
        expand(p, totalPages, EXPAND_SIZE)
      )
    )
  ).sort((a, b) => a - b);

  statements.balance = Array.from(
    new Set(
      statements.balance.flatMap((p) =>
        expand(p, totalPages, EXPAND_SIZE)
      )
    )
  ).sort((a, b) => a - b);

  statements.cashflow = Array.from(
    new Set(
      statements.cashflow.flatMap((p) =>
        expand(p, totalPages, EXPAND_SIZE)
      )
    )
  ).sort((a, b) => a - b);

  return {
    totalPages,
    bestWindow,
    statements,
  };
}