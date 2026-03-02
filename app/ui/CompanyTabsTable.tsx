"use client";

import { useMemo, useState } from "react";
import type { Normalized10Y, Company, StatementType } from "../../src/lib/normalization/loadNormalized";
import StatementChart from "./Chart";

//tabs for different reports
const STATEMENTS: { key: StatementType; label: string }[] = [
  { key: "income_statement", label: "Income" },
  { key: "balance_sheet", label: "Balance Sheet" },
  { key: "cash_flow", label: "Cash Flow" },
];

//basic company information
const COMPANY_META: Record<string, { name: string; ticker: string; country: string }> = {
  SIE: { name: "Siemens AG", ticker: "SIE", country: "Germany" },
  MBG: { name: "Mercedes-Benz Group AG", ticker: "MBG", country: "Germany" },
  TTE: { name: "TotalEnergies SE", ticker: "TTE", country: "France" },
};

//check to see if value is a percentage
function isPercentUnits(units?: string | null) {
  if (!units) return false;
  const u = units.trim().toLowerCase();
  return u === "%" || u.includes("percent");
}

//format number with currency symbol and ticks if null
function formatCell(v: any, units?: string | null) {
  if (v === undefined || v === null || !Number.isFinite(Number(v))) return "—";
  const n = Number(v);

  if (isPercentUnits(units)) {
    return Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 }).format(n > 1 ? n / 100 : n);
  }

  return Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

//build the actual table with accurate row labels and years
function buildTable(company: any | undefined, st: StatementType) {
  const years: number[] = [...(company?.years ?? [])].sort((a: number, b: number) => a - b);

  const byYear: Record<string, Record<string, number | undefined>> =
    company?.statements_by_year?.[st] ?? {};

  const labels: Record<string, string> =
    company?.row_labels?.[st] ?? {};

  const keySet = new Set<string>();
  for (const y of years) {
    const rowMap = byYear[String(y)] ?? {};
    Object.keys(rowMap).forEach((k) => keySet.add(k));
  }

  const keys = [...keySet].sort((a, b) => {
    const la = (labels[a] ?? a).toLowerCase();
    const lb = (labels[b] ?? b).toLowerCase();
    return la.localeCompare(lb);
  });

  const rows = keys.map((k) => ({
    key: k,
    label: labels[k] ?? k,
    values: years.map((y) => (byYear[String(y)] ?? {})[k]),
  }));

  return { years, rows };
}


export default function CompanyTabsTable({ data }: { data: Normalized10Y[] }) {
  const byCompany = useMemo(() => {
    const map = new Map<Company, Normalized10Y>();
    for (const d of data) map.set(d.company, d as any);
    return map;
  }, [data]);

  const companies = useMemo(() => data.map((d) => d.company), [data]);

  const [company, setCompany] = useState<Company>(() => (companies[0] as Company) ?? ("SIE" as Company));
  const [statement, setStatement] = useState<StatementType>("income_statement");

  const current = byCompany.get(company);

  const table = useMemo(() => buildTable(current, statement), [current, statement]);

  if (!current) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-600">No data loaded.</p>
      </div>
    );
  }

  const meta = COMPANY_META[company] ?? { name: company, ticker: company, country: "—" };
  const units = (current as any).meta?.[statement]?.units ?? null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-zinc-200 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-900">{meta.name}</h2>
              <span className="text-sm text-zinc-500">({meta.ticker})</span>
            </div>
            <div className="mt-0.5 text-sm text-zinc-500">{meta.country}</div>
          </div>

          {/* Statement tabs */}
          <div className="inline-flex rounded-xl bg-zinc-100 p-1">
            {STATEMENTS.map((s) => {
              const active = s.key === statement;
              return (
                <button
                  key={s.key}
                  onClick={() => setStatement(s.key)}
                  className={[
                    "px-4 py-2 text-sm font-medium rounded-lg transition",
                    active ? "bg-white shadow-sm text-zinc-900" : "text-zinc-600 hover:text-zinc-900",
                  ].join(" ")}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Company tabs */}
        <div className="mt-3 inline-flex rounded-xl bg-zinc-100 p-1">
          {companies.map((c) => {
            const active = c === company;
            return (
              <button
                key={c}
                onClick={() => setCompany(c as Company)}
                className={[
                  "px-4 py-2 text-sm font-medium rounded-lg transition",
                  active ? "bg-white shadow-sm text-zinc-900" : "text-zinc-600 hover:text-zinc-900",
                ].join(" ")}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <StatementChart company={current as any} statement={statement} units={units} />
      </div>

      {/* Table */}
      <div className="px-4 pb-4">
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="min-w-[900px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-50">
                
                <th
                  className="sticky left-0 z-20 border-b border-zinc-200 px-4 py-3 text-left font-semibold text-zinc-700 bg-zinc-50"
                  style={{ minWidth: 260 }}
                >
                  
                </th>

                {table.years.map((y) => (
                  <th
                    key={y}
                    className="border-b border-zinc-200 px-4 py-3 text-right font-semibold text-zinc-700 whitespace-nowrap"
                  >
                    {y}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {table.rows.map((r, idx) => (
                <tr key={r.key} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/40"}>
                  
                  <td
                    className="sticky left-0 z-10 border-b border-zinc-100 px-4 py-3 text-zinc-800 bg-inherit"
                    style={{ minWidth: 260 }}
                  >
                    {r.label}
                  </td>

                  {r.values.map((v, i) => (
                    <td key={i} className="border-b border-zinc-100 px-4 py-3 text-right tabular-nums text-zinc-700">
                      {formatCell(v, units)}
                    </td>
                  ))}
                </tr>
              ))}

              {table.rows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-zinc-500" colSpan={1 + table.years.length}>
                    No rows found for this statement.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-zinc-500">
          Showing {company} · {STATEMENTS.find((s) => s.key === statement)?.label} · {table.years.length} years
        </div>
      </div>
    </div>
  );
}