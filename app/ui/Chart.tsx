"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

export type StatementType = "income_statement" | "balance_sheet" | "cash_flow";

type Props = {
  company: any; // Normalized10Y-like object
  statement: StatementType;
  units?: string | null; // from normalized meta[statement].units
};

type MetricDef = {
  id: string;
  label: string;
  synonyms: string[]; // normalized row keys
};

type CompanyTicker = "SIE" | "MBG" | "TTE";

const METRICS_BY_COMPANY: Record<
  CompanyTicker,
  Partial<Record<Exclude<StatementType, "cash_flow">, MetricDef[]>>
> = {
  SIE: {
    income_statement: [
      { id: "revenue", label: "Revenue", synonyms: ["revenue", "revenues", "net sales", "sales"] },
      { id: "grossProfit", label: "Gross Profit", synonyms: ["gross profit"] },
    ],
    balance_sheet: [
      { id: "totalAssets", label: "Total Assets", synonyms: ["total assets", "total assests"] },
      { id: "totalLiabilities", label: "Total Liabilities", synonyms: ["total liabilities"] },
    ],
  },
  MBG: {
    income_statement: [
      { id: "revenue", label: "Revenue", synonyms: ["revenue", "revenues", "net sales", "sales"] },
      { id: "grossProfit", label: "Gross Profit", synonyms: ["gross profit"] },
    ],
    balance_sheet: [
      { id: "totalAssets", label: "Total Assets", synonyms: ["total assets", "total assests"] },
      {
        id: "equityAndLiabilities",
        label: "Total Equity and Liabilities",
        synonyms: [
          "total equity and liabilities",
          "total equity & liabilities",
          "total equity and total liabilities",
          "equity and liabilities",
        ],
      },
    ],
  },
  TTE: {
    income_statement: [
      {
        id: "netIncome",
        label: "Consolidated Net Income",
        synonyms: ["consolidated net income", "net income", "profit for the year", "profit for the period"],
      },
      {
        id: "revenueFromSales",
        label: "Revenues from sales",
        synonyms: ["revenues from sales", "revenue from sales", "sales", "revenue", "revenues"],
      },
    ],
    balance_sheet: [
      { id: "totalAssets", label: "Total Assets", synonyms: ["total assets", "total assests"] },
      { id: "totalLiabilities", label: "Total Liabilities", synonyms: ["total liabilities"] },
      {
        id: "shareholdersEquity",
        label: "Shareholders’ equities",
        synonyms: [
          "shareholders equities",
          "shareholders' equities",
          "shareholders’ equities",
          "shareholders equity",
          "shareholders' equity",
          "equity attributable to shareholders",
          "total equity",
          "equity",
        ],
      },
    ],
  },
};

// format units accordingly based on percent, null values and currency

function isPercentUnits(units?: string | null) {
  if (!units) return false;
  const u = units.trim().toLowerCase();
  return u === "%" || u.includes("percent");
}

function formatValue(v: any, units?: string | null) {
  if (v === undefined || v === null || !Number.isFinite(Number(v))) return "—";
  const n = Number(v);

  if (isPercentUnits(units)) {
    return Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 }).format(n > 1 ? n / 100 : n);
  }

  return Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}
// for undefined and null values use ticks
function formatTick(v: any, units?: string | null) {
  if (v === undefined || v === null || !Number.isFinite(Number(v))) return "";
  const n = Number(v);

  if (isPercentUnits(units)) {
    const pct = n > 1 ? n : n * 100;
    return `${Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(pct)}%`;
  }

  // keep axis compact
  return Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

// metric resolution

function findRowKeyForMetric(
  byYear: Record<string, Record<string, number | undefined>>,
  years: number[],
  synonyms: string[]
) {
  for (const syn of synonyms) {
    for (const y of years) {
      const v = byYear[String(y)]?.[syn];
      if (v !== undefined && v !== null) return syn;
    }
  }
  return null;
}

export default function StatementChart({ company, statement, units }: Props) {
  // No cashflow charts
  if (statement === "cash_flow") return null;

  const ticker = (company?.company ?? "") as CompanyTicker;
  const metricDefs = METRICS_BY_COMPANY?.[ticker]?.[statement] ?? [];
  if (metricDefs.length === 0) return null;

  const years: number[] = useMemo(
    () => [...(company?.years ?? [])].sort((a: number, b: number) => a - b),
    [company]
  );

  const byYear: Record<string, Record<string, number | undefined>> = useMemo(
    () => company?.statements_by_year?.[statement] ?? {},
    [company, statement]
  );

  const labelsMap: Record<string, string> = useMemo(
    () => company?.row_labels?.[statement] ?? {},
    [company, statement]
  );

  const resolved = useMemo(() => {
    const resolvedKeyById: Record<string, string | null> = {};
    const displayNameById: Record<string, string> = {};

    for (const m of metricDefs) {
      const found = findRowKeyForMetric(byYear, years, m.synonyms);
      resolvedKeyById[m.id] = found;
      displayNameById[m.id] = found ? (labelsMap[found] ?? m.label) : m.label;
    }

    const data = years.map((y) => {
      const row: any = { year: y };
      for (const m of metricDefs) {
        const k = resolvedKeyById[m.id];
        row[m.id] = k ? byYear[String(y)]?.[k] : undefined;
      }
      return row;
    });

    const available: Record<string, boolean> = {};
    for (const m of metricDefs) {
      available[m.id] = data.some((d) => typeof d[m.id] === "number");
    }

    return { data, available, displayNameById };
  }, [metricDefs, byYear, years, labelsMap]);

  const hasAnySeries = metricDefs.some((m) => resolved.available[m.id]);
  if (!hasAnySeries) return null;

  const title = statement === "income_statement" ? "Income Trends (10Y)" : "Balance Sheet Trends (10Y)";
  const badge = isPercentUnits(units) ? "%" : units ? `€ · ${units}` : "€";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-zinc-900">{title}</div>
          <div className="mt-0.5 text-xs text-zinc-500">
            {ticker} · {metricDefs.filter((m) => resolved.available[m.id]).length} metrics
          </div>
        </div>

        <div className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700">
          {badge}
        </div>
      </div>

      <div className="mt-3 h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={resolved.data} margin={{ top: 10, right: 18, left: 6, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => formatTick(v, units)} tick={{ fontSize: 12 }} width={84} />
            <Tooltip
              formatter={(value: any, name: any) => [formatValue(value, units), name]}
              labelFormatter={(label) => `Year: ${label}`}
            />
            <Legend />

            {metricDefs.map((m, idx) => {
              if (!resolved.available[m.id]) return null;

              const COLORS = [
                "#111827", // slate-900
                "#2563EB", // blue-600
                "#16A34A", // green-600
              ];

              const stroke = COLORS[idx % COLORS.length];

              return (
                <Line
                  key={m.id}
                  type="monotone"
                  dataKey={m.id}
                  name={resolved.displayNameById[m.id]}
                  dot={false}
                  strokeWidth={3}
                  stroke={stroke}
                  activeDot={{ r: 5 }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}