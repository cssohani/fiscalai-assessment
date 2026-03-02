import fs from "node:fs";
import path from "node:path";

type StatementType = "income_statement" | "balance_sheet" | "cash_flow";
const COMPANIES = ["SIE", "MBG", "TTE"] as const;
const STS: StatementType[] = ["income_statement", "balance_sheet", "cash_flow"];

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function main() {
  for (const c of COMPANIES) {
    const p = path.join(process.cwd(), "data", "normalized", c, "normalized_10y.json");
    const j = readJson(p);

    const year = String(j.years?.[0]); // first year
    console.log(`\n=== ${c} (sample year ${year}) ===`);

    for (const st of STS) {
      const raw = j.statements_raw?.[st]?.[year] ?? {};
      console.log(`\n[${st}] keys:`);
      console.log(Object.keys(raw));
    }
  }
}

main();