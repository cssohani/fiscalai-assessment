export type CanonicalIncome = {
  revenue?: number;
  costOfRevenue?: number;
  grossProfit?: number;
  operatingExpenses?: number;
  operatingIncome?: number;
  ebit?: number;
  ebt?: number;
  incomeTaxExpense?: number;
  netIncome?: number;
  epsBasic?: number;
  epsDiluted?: number;
};

export type CanonicalBalance = {
  cashAndCashEquivalents?: number;
  totalCurrentAssets?: number;
  totalAssets?: number;

  totalCurrentLiabilities?: number;
  totalLiabilities?: number;

  totalEquity?: number;

  shortTermDebt?: number;
  longTermDebt?: number;
  totalDebt?: number;
};

export type CanonicalCashflow = {
  netCashFromOperatingActivities?: number; // CFO
  capitalExpenditures?: number;            // CapEx (usually negative)
  netCashFromInvestingActivities?: number;
  netCashFromFinancingActivities?: number;

  freeCashFlow?: number;                  // derived: CFO - CapEx (if CapEx is negative, handle)
  netChangeInCash?: number;
};

export type NormalizedStatement<T> = {
  canonical: T;
  mapping: Record<string, string | null>; // canonicalKey -> rawKey used (or null if missing)
  raw: Record<string, unknown>;           // original statement
  unmapped: Record<string, unknown>;      // raw keys we did not map into canonical
};

export type StatementType = "income_statement" | "balance_sheet" | "cash_flow";

export const INCOME_ALIASES: Record<keyof CanonicalIncome, string[]> = {
  revenue: [
    "revenue", "revenues", "net revenue", "net revenues", "sales", "net sales",
    "total revenue", "total revenues", "turnover"
  ],
  costOfRevenue: [
    "cost of revenue", "cost of revenues", "cost of sales", "cogs",
    "cost of goods sold", "cost of goods and services sold"
  ],
  grossProfit: ["gross profit", "gross income"],
  operatingExpenses: [
    "operating expenses", "total operating expenses", "opex"
  ],
  operatingIncome: [
    "operating income", "operating profit", "income from operations", "profit from operations"
  ],
  ebit: ["ebit", "earnings before interest and taxes"],
  ebt: ["ebt", "earnings before tax", "profit before tax", "income before tax"],
  incomeTaxExpense: [
    "income tax", "income taxes", "income tax expense", "tax expense", "taxes"
  ],
  netIncome: [
    "net income", "net earnings", "profit", "profit for the period", "profit attributable to owners",
    "net profit", "net income attributable to shareholders"
  ],
  epsBasic: ["basic eps", "eps basic", "earnings per share basic"],
  epsDiluted: ["diluted eps", "eps diluted", "earnings per share diluted"],
};

export const BALANCE_ALIASES: Record<keyof CanonicalBalance, string[]> = {
  cashAndCashEquivalents: [
    "cash and cash equivalents", "cash & cash equivalents", "cash and equivalents",
    "cash", "cash and cash"
  ],
  totalCurrentAssets: ["total current assets", "current assets"],
  totalAssets: ["total assets", "assets"],
  totalCurrentLiabilities: ["total current liabilities", "current liabilities"],
  totalLiabilities: ["total liabilities", "liabilities"],
  totalEquity: [
    "total equity", "equity", "total shareholders' equity", "shareholders' equity",
    "total equity attributable to owners"
  ],
  shortTermDebt: [
    "short-term debt", "short term debt", "current debt", "short term borrowings",
    "short-term borrowings"
  ],
  longTermDebt: [
    "long-term debt", "long term debt", "non-current debt", "long term borrowings",
    "long-term borrowings"
  ],
  totalDebt: ["total debt", "borrowings", "total borrowings", "debt"],
};

export const CASHFLOW_ALIASES: Record<keyof CanonicalCashflow, string[]> = {
  netCashFromOperatingActivities: [
    "net cash from operating activities", "net cash provided by operating activities",
    "cash flow from operating activities", "cash provided by operations", "cfo"
  ],
  capitalExpenditures: [
    "capital expenditures", "capex", "purchase of property plant and equipment",
    "acquisition of property plant and equipment", "payments for ppe", "investments in ppe"
  ],
  netCashFromInvestingActivities: [
    "net cash from investing activities", "cash flow from investing activities"
  ],
  netCashFromFinancingActivities: [
    "net cash from financing activities", "cash flow from financing activities"
  ],
  freeCashFlow: [
    "free cash flow", "fcf" // usually not present; derived
  ],
  netChangeInCash: [
    "net change in cash", "increase (decrease) in cash", "net increase in cash",
    "net (decrease) increase in cash"
  ],
};