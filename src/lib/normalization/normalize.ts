import {
  BALANCE_ALIASES,
  CASHFLOW_ALIASES,
  INCOME_ALIASES,
  type CanonicalBalance,
  type CanonicalCashflow,
  type CanonicalIncome,
  type NormalizedStatement,
} from "./schemas";

// Normalize key: lowercase, remove punctuation/extra spaces 
function normKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_\-]/g, " ")
    .replace(/[()'".,:%]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Try to parse a number from common raw formats:
 * - number
 * - "1,234"
 * - "(1,234)" negative
 * - "1.2B" / "300M" / "45K"
 */
export function toNumber(value: unknown): number | undefined {
  if (isFiniteNumber(value)) return value;

  if (typeof value !== "string") return undefined;
  const s0 = value.trim();
  if (!s0) return undefined;

  // parentheses indicate negative
  const neg = /^\(.*\)$/.test(s0);
  const s1 = s0.replace(/[()]/g, "").replace(/,/g, "").trim();

  // suffix multipliers
  const m = s1.match(/^(-?\d+(\.\d+)?)([KMB])?$/i);
  if (m) {
    const base = Number(m[1]);
    if (!Number.isFinite(base)) return undefined;
    const suf = (m[3] ?? "").toUpperCase();
    const mult = suf === "K" ? 1e3 : suf === "M" ? 1e6 : suf === "B" ? 1e9 : 1;
    const out = base * mult;
    return neg ? -out : out;
  }

  // fallback: strip non-numeric 
  const s2 = s1.replace(/[^0-9.-]/g, "");
  if (!s2) return undefined;
  const n = Number(s2);
  if (!Number.isFinite(n)) return undefined;
  return neg ? -n : n;
}

function buildAliasIndex(raw: Record<string, unknown>) {
  const index = new Map<string, string>(); // normalized -> original raw key
  for (const k of Object.keys(raw)) index.set(normKey(k), k);
  return index;
}

function pickRawKey(
  rawIndex: Map<string, string>,
  aliases: string[]
): string | undefined {
  for (const a of aliases) {
    const hit = rawIndex.get(normKey(a));
    if (hit) return hit;
  }
  return undefined;
}

function normalizeWithAliases<T extends Record<string, any>>(
  raw: Record<string, unknown>,
  aliasMap: Record<keyof T, string[]>,
  opts?: { derive?: (canonical: T) => void }
): NormalizedStatement<T> {
  const rawIndex = buildAliasIndex(raw);

  const canonical = {} as T;
  const mapping: Record<string, string | null> = {};

  const usedRawKeys = new Set<string>();

  (Object.keys(aliasMap) as Array<keyof T>).forEach((canonKey) => {
    const rawKey = pickRawKey(rawIndex, aliasMap[canonKey]);
    mapping[String(canonKey)] = rawKey ?? null;

    if (!rawKey) return;

    usedRawKeys.add(rawKey);

    const n = toNumber(raw[rawKey]);
    if (n !== undefined) {
      (canonical as any)[canonKey] = n;
    }
  });

  // Optional derived fields 
  opts?.derive?.(canonical);

  // Build unmapped bucket
  const unmapped: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!usedRawKeys.has(k)) unmapped[k] = v;
  }

  return { canonical, mapping, raw, unmapped };
}

export function normalizeIncomeStatement(
  raw: Record<string, unknown>
): NormalizedStatement<CanonicalIncome> {
  return normalizeWithAliases<CanonicalIncome>(raw, INCOME_ALIASES);
}

export function normalizeBalanceSheet(
  raw: Record<string, unknown>
): NormalizedStatement<CanonicalBalance> {
  return normalizeWithAliases<CanonicalBalance>(raw, BALANCE_ALIASES, {
    derive: (c) => {
      // derive totalDebt if short+long present and totalDebt missing
      if (c.totalDebt == null) {
        const st = c.shortTermDebt ?? 0;
        const lt = c.longTermDebt ?? 0;
        if ((c.shortTermDebt != null || c.longTermDebt != null) && (st + lt) !== 0) {
          c.totalDebt = st + lt;
        }
      }
    },
  });
}

export function normalizeCashflowStatement(
  raw: Record<string, unknown>
): NormalizedStatement<CanonicalCashflow> {
  return normalizeWithAliases<CanonicalCashflow>(raw, CASHFLOW_ALIASES, {
    derive: (c) => {
      // Derive Free Cash Flow if possible:
      // Usually: FCF = CFO - CapEx
      // Many statements store CapEx as negative already. We'll handle both:
      if (c.freeCashFlow == null && c.netCashFromOperatingActivities != null && c.capitalExpenditures != null) {
        const capex = c.capitalExpenditures;
        // If capex is negative, CFO - (negative) = CFO + abs(capex) which is wrong.
        // So treat capex as an outflow magnitude.
        const capexOutflow = capex < 0 ? Math.abs(capex) : capex;
        c.freeCashFlow = c.netCashFromOperatingActivities - capexOutflow;
      }
    },
  });
}