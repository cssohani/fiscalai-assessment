
import fs from "fs";
import path from "path";
import { locateStatements } from "../lib/pdf/locateStatements";

type Company = {
  name: string;
  ticker: string;
};

const COMPANIES: Company[] = [
  { name: "Siemens", ticker: "SIE" },
  { name: "Mercedes-Benz Group", ticker: "MBG" },
  { name: "TotalEnergies", ticker: "TTE" },
];


const END_YEAR = 2024;
const YEARS = Array.from({ length: 10 }, (_, i) => END_YEAR - i); 

function pdfPathFor(ticker: string, year: number) {
  return path.join(process.cwd(), "data", "pdfs", ticker, `${year}.pdf`);
}

function exists(p: string) {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("Starting locate across 3 companies × 10 years...\n");

  const summary: {
    ticker: string;
    year: number;
    ok: boolean;
    missing?: boolean;
    incomeCount?: number;
    balanceCount?: number;
    cashflowCount?: number;
  }[] = [];

  for (const company of COMPANIES) {
    console.log("==================================================");
    console.log(`${company.name} (${company.ticker})`);
    console.log("==================================================");

    for (const year of YEARS) {
      const pdfPath = pdfPathFor(company.ticker, year);

      if (!exists(pdfPath)) {
        console.log(`- ${year}:  missing PDF at ${pdfPath}`);
        summary.push({ ticker: company.ticker, year, ok: false, missing: true });
        continue;
      }

      try {
        const result = await locateStatements(pdfPath);

        const incomeTop = result.topPages.income;
        const balanceTop = result.topPages.balance;
        const cashTop = result.topPages.cashflow;

        const incomeLLM = result.pagesForLLM.income;
        const balanceLLM = result.pagesForLLM.balance;
        const cashLLM = result.pagesForLLM.cashflow;

        const ok =
          incomeTop.length > 0 && balanceTop.length > 0 && cashTop.length > 0;

        console.log(
          `- ${year}: ${ok ? "OK" : "not okay"} ` +
            `incomeTop=${incomeTop.join(",") || "[]"} ` +
            `balanceTop=${balanceTop.join(",") || "[]"} ` +
            `cashTop=${cashTop.join(",") || "[]"}`
        );

       

        summary.push({
          ticker: company.ticker,
          year,
          ok,
          incomeCount: incomeLLM.length,
          balanceCount: balanceLLM.length,
          cashflowCount: cashLLM.length,
        });
      } catch (e: any) {
        console.log(`- ${year}: error locating (${e?.message ?? e})`);
        summary.push({ ticker: company.ticker, year, ok: false });
      }
    }

    console.log("");
  }

  
  console.log("==================================================");
  console.log("Summary");
  console.log("==================================================");

  const total = summary.length;
  const missing = summary.filter((s) => s.missing).length;
  const ok = summary.filter((s) => s.ok).length;
  const warnOrFail = total - ok - missing;

  console.log(`Total PDFs expected: ${total}`);
  console.log(`Missing PDFs:        ${missing}`);
  console.log(`All 3 statements OK: ${ok}`);
  console.log(`Needs attention:     ${warnOrFail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});