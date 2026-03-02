import fs from "node:fs";
import path from "node:path";

type StatementType = "income_statement" | "balance_sheet" | "cash_flow";

type Candidate = {
  company: string;
  fiscalYear: number;
  statementType: StatementType;
  sourcePath: string;
  filingDate?: string;     // YYYY-MM-DD if present
  isRestated?: boolean;    // if present
  data: Record<string, unknown>;
};

type LineageEntry = {
  pickedFrom: string;
  reason: string;
  candidates: Array<{
    sourcePath: string;
    filingDate?: string;
    isRestated?: boolean;
    completeness: number;
  }>;
};

type CompiledOutput = {
  company: string;
  compiledAt: string;
  statements: Record<StatementType, Record<string, Record<string, unknown>>>;
  lineage: Record<StatementType, Record<string, LineageEntry>>;
};

const ROOT = process.cwd();
const EXTRACTED_ROOT = path.join(ROOT, "data", "extracted");
const COMPILED_ROOT = path.join(ROOT, "data", "compiled");

const COMPANIES = ["SIE", "MBG", "TTE"] as const;

const FILE_MAP: Record<string, StatementType> = {
  "income.json": "income_statement",
  "balance.json": "balance_sheet",
  "cashflow.json": "cash_flow",
};

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function safeReadJson(filePath: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    console.warn(`[warn] failed to parse JSON: ${filePath}`);
    return null;
  }
}

function countNonNullFlat(obj: unknown): number {
  if (!obj || typeof obj !== "object") return 0;
  let count = 0;
  for (const v of Object.values(obj as Record<string, unknown>)) {
    if (v !== null && v !== undefined && v !== "") count++;
  }
  return count;
}

function normalizeDateYYYYMMDD(d: string): string | undefined {
  const t = Date.parse(d);
  if (!Number.isFinite(t)) return undefined;
  return new Date(t).toISOString().slice(0, 10);
}

function detectFilingDate(raw: any, filePath: string): string | undefined {
  const candidates: unknown[] = [
    raw?.filingDate,
    raw?.filing_date,
    raw?.metadata?.filingDate,
    raw?.metadata?.filing_date,
    raw?.reportDate,
    raw?.report_date,
    raw?.documentDate,
    raw?.document_date,
  ].filter(Boolean);

  for (const c of candidates) {
    if (typeof c === "string") {
      const n = normalizeDateYYYYMMDD(c);
      if (n) return n;
    }
  }

  // fallback: try parse date from filename if it contains one
  const base = path.basename(filePath);
  const m1 = base.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;

  const m2 = base.match(/(20\d{2})(\d{2})(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;

  return undefined;
}

function detectIsRestated(raw: any): boolean | undefined {
  const v =
    raw?.isRestated ??
    raw?.is_restated ??
    raw?.metadata?.isRestated ??
    raw?.metadata?.is_restated;

  if (typeof v === "boolean") return v;

  const label =
    raw?.restatementType ??
    raw?.restatement_type ??
    raw?.metadata?.restatementType ??
    raw?.metadata?.restatement_type;

  if (typeof label === "string" && label.toLowerCase().includes("restat")) return true;

  return undefined;
}

function listYearDirs(companyDir: string): string[] {
  if (!fs.existsSync(companyDir)) return [];
  return fs
    .readdirSync(companyDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}$/.test(d.name))
    .map((d) => d.name)
    .sort(); // ascending years
}

function pickWinner(candidates: Candidate[]): { winner: Candidate; reason: string } {
  const scored = candidates.map((c) => ({
    c,
    restated: c.isRestated ? 1 : 0,
    filingSort: c.filingDate ? Date.parse(c.filingDate) : -1,
    completeness: countNonNullFlat(c.data),
  }));

  scored.sort((a, b) => {
    if (b.restated !== a.restated) return b.restated - a.restated;
    if (b.filingSort !== a.filingSort) return b.filingSort - a.filingSort;
    if (b.completeness !== a.completeness) return b.completeness - a.completeness;
    return a.c.sourcePath.localeCompare(b.c.sourcePath);
  });

  const winner = scored[0].c;
  const reason = winner.isRestated
    ? "restated_precedence > filingDate > completeness > path"
    : "filingDate > completeness > path";

  return { winner, reason };
}

function compileCompany(company: string) {
  const companyDir = path.join(EXTRACTED_ROOT, company);
  const years = listYearDirs(companyDir);

  if (years.length === 0) {
    console.warn(`[warn] no year folders found for ${company} in ${companyDir}`);
    return;
  }

  const candidatesByKey = new Map<string, Candidate[]>(); // key = statementType::year

  for (const yearStr of years) {
    const year = Number(yearStr);
    const yearDir = path.join(companyDir, yearStr);

    for (const [fileName, statementType] of Object.entries(FILE_MAP)) {
      const filePath = path.join(yearDir, fileName);
      if (!fs.existsSync(filePath)) {
        console.warn(`[warn] missing file ${filePath}`);
        continue;
      }

      const raw = safeReadJson(filePath);
      if (!raw || typeof raw !== "object") continue;

      const candidate: Candidate = {
        company,
        fiscalYear: year,
        statementType,
        sourcePath: filePath,
        filingDate: detectFilingDate(raw, filePath),
        isRestated: detectIsRestated(raw),
        // If your JSON wraps the actual statement in a field like { data: {...} }, support that:
        data: (raw.data && typeof raw.data === "object" ? raw.data : raw) as Record<string, unknown>,
      };

      const key = `${statementType}::${year}`;
      candidatesByKey.set(key, [...(candidatesByKey.get(key) ?? []), candidate]);
    }
  }

  const output: CompiledOutput = {
    company,
    compiledAt: new Date().toISOString(),
    statements: {
      income_statement: {},
      balance_sheet: {},
      cash_flow: {},
    },
    lineage: {
      income_statement: {},
      balance_sheet: {},
      cash_flow: {},
    },
  };

  for (const [key, candidates] of candidatesByKey.entries()) {
    const [statementTypeStr, yearStr] = key.split("::");
    const statementType = statementTypeStr as StatementType;
    const year = yearStr;

    const { winner, reason } = pickWinner(candidates);

    output.statements[statementType][year] = winner.data;

    output.lineage[statementType][year] = {
      pickedFrom: winner.sourcePath,
      reason,
      candidates: candidates.map((c) => ({
        sourcePath: c.sourcePath,
        filingDate: c.filingDate,
        isRestated: c.isRestated,
        completeness: countNonNullFlat(c.data),
      })),
    };
  }

  const outDir = path.join(COMPILED_ROOT, company);
  ensureDir(outDir);

  const outPath = path.join(outDir, "compiled_10y.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");

  console.log(
    `[compiled] ${company}: ` +
      `${Object.keys(output.statements.income_statement).length} IS years, ` +
      `${Object.keys(output.statements.balance_sheet).length} BS years, ` +
      `${Object.keys(output.statements.cash_flow).length} CF years -> ${outPath}`
  );
}

function main() {
  for (const c of COMPANIES) compileCompany(c);
}

main();