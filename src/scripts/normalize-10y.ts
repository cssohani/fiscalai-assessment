import fs from "node:fs";
import path from "node:path";

type StatementType = "income_statement" | "balance_sheet" | "cash_flow";
const STATEMENT_TYPES: StatementType[] = ["income_statement", "balance_sheet", "cash_flow"];
const COMPANIES = ["SIE", "MBG", "TTE"] as const;

const ROOT = process.cwd();
const COMPILED_ROOT = path.join(ROOT, "data", "compiled");
const NORMALIZED_ROOT = path.join(ROOT, "data", "normalized");

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function readJson(p: string): any {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function writeJson(p: string, obj: any) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf-8");
}

/**
 * Label normalization (NOT concept mapping):
 * - trim
 * - collapse whitespace
 * - remove footnote-like suffixes (optional but recommended)
 * - lowercase for stable matching
 */
function normalizeLabel(label: string): string {
  let s = label.trim().replace(/\s+/g, " ");

  // Optional cleanup: remove trailing note markers like " (note 3)" or " - Note 12"
  s = s.replace(/\s*\((note|notes?)\s*\d+[a-z]?\)\s*$/i, "");
  s = s.replace(/\s*[-–—]\s*(note|notes?)\s*\d+[a-z]?\s*$/i, "");

  // Optional cleanup: remove trailing superscripts like "Revenue¹" if your extractor includes them
  s = s.replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]+$/g, "").trim();

  return s.toLowerCase();
}

/**
 * Parse strings like:
 * "75,636" -> 75636
 * "(53,789)" -> -53789
 * "—" or "" -> undefined
 */
function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;

  const s0 = value.trim();
  if (!s0 || s0 === "—" || s0 === "-" || s0.toLowerCase() === "n/a") return undefined;

  const neg = /^\(.*\)$/.test(s0);
  const s1 = s0.replace(/[()]/g, "").replace(/,/g, "").trim();
  const n = Number(s1);
  if (!Number.isFinite(n)) return undefined;
  return neg ? -n : n;
}

/**
 * Flatten a statement table into a per-year map:
 * { rowKey: number | undefined }
 *
 * Your table object looks like:
 * { currency, units, years: [2024, 2023], rows: [{label, values: [...]}, ...] }
 */
function flattenTableForYear(tableObj: any, year: number): { flat: Record<string, number | undefined>, labels: Record<string, string> } {
  const yearsArr: number[] = Array.isArray(tableObj?.years) ? tableObj.years : [];
  const yearIdx = yearsArr.findIndex((y) => Number(y) === Number(year));
  const rows = Array.isArray(tableObj?.rows) ? tableObj.rows : [];

  const flat: Record<string, number | undefined> = {};
  const labels: Record<string, string> = {};

  for (const r of rows) {
    const label = typeof r?.label === "string" ? r.label : "";
    if (!label) continue;

    const key = normalizeLabel(label);
    if (!key) continue;

    labels[key] = labels[key] ?? label.trim(); // keep the first-seen display label

    const values: unknown[] = Array.isArray(r?.values) ? r.values : [];
    const cell = yearIdx >= 0 ? values[yearIdx] : undefined;
    flat[key] = toNumber(cell);
  }

  return { flat, labels };
}

function main() {
  for (const company of COMPANIES) {
    const compiledPath = path.join(COMPILED_ROOT, company, "compiled_10y.json");
    if (!fs.existsSync(compiledPath)) {
      console.warn(`[warn] missing compiled file: ${compiledPath}`);
      continue;
    }

    const compiled = readJson(compiledPath);

    const out: any = {
      company,
      normalizedAt: new Date().toISOString(),
      years: [] as number[],

      // Values keyed by normalized label per year
      statements_by_year: {
        income_statement: {},
        balance_sheet: {},
        cash_flow: {},
      },

      // Map of normalized label -> display label (for UI row names)
      row_labels: {
        income_statement: {},
        balance_sheet: {},
        cash_flow: {},
      },

      // Helpful for display
      meta: {
        income_statement: { currency: null as string | null, units: null as string | null },
        balance_sheet: { currency: null as string | null, units: null as string | null },
        cash_flow: { currency: null as string | null, units: null as string | null },
      },
    };

    for (const st of STATEMENT_TYPES) {
      const byYear: Record<string, any> = compiled?.statements?.[st] ?? {};

      for (const [yearStr, tableObj] of Object.entries(byYear)) {
        const year = Number(yearStr);
        if (!Number.isFinite(year)) continue;

        // capture meta
        if (tableObj && typeof tableObj === "object") {
          if (out.meta[st].currency == null && typeof tableObj.currency === "string") out.meta[st].currency = tableObj.currency;
          if (out.meta[st].units == null && typeof tableObj.units === "string") out.meta[st].units = tableObj.units;
        }

        // flatten
        const { flat, labels } = flattenTableForYear(tableObj, year);

        out.statements_by_year[st][yearStr] = flat;

        // merge row labels
        for (const [k, display] of Object.entries(labels)) {
          if (!out.row_labels[st][k]) out.row_labels[st][k] = display;
        }

        out.years.push(year);
      }
    }

    out.years = Array.from(new Set<number>(out.years)).sort((a, b) => a - b);

    const outDir = path.join(NORMALIZED_ROOT, company);
    ensureDir(outDir);

    const outPath = path.join(outDir, "normalized_10y.json");
    writeJson(outPath, out);

    console.log(`[normalized-labels] ${company} -> ${outPath}`);
  }
}

main();