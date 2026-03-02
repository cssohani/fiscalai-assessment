import fs from "node:fs/promises";
import path from "node:path";

export type Company = "SIE" | "MBG" | "TTE";
export type StatementType = "income_statement" | "balance_sheet" | "cash_flow";

export type Normalized10Y = {
  company: Company;
  normalizedAt: string;
  years: number[];
  statements: Record<StatementType, Record<string, Record<string, number | undefined>>>;
  coverage?: unknown;
};

export async function loadNormalized(company: Company): Promise<Normalized10Y> {
  const p = path.join(process.cwd(), "data", "normalized", company, "normalized_10y.json");
  const raw = await fs.readFile(p, "utf-8");
  return JSON.parse(raw) as Normalized10Y;
}

export const COMPANIES: Company[] = ["SIE", "MBG", "TTE"];