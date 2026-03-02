
import fs from "fs";
import path from "path";
import { locateStatements, StatementType } from "../lib/pdf/locateStatements";
import { extractTextFromPages } from "../lib/pdf/extractTextFromPages";
import { extractStatementFromText } from "../lib/ai/extractStatement";

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
const STATEMENTS: StatementType[] = ["income", "balance", "cashflow"];


function pdfPathFor(ticker: string, year: number) {
  return path.join(process.cwd(), "data", "pdfs", ticker, `${year}.pdf`);
}


function outPathFor(ticker: string, year: number, statement: StatementType) {
  return path.join(process.cwd(), "data", "extracted", ticker, String(year), `${statement}.json`);
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function existsReadable(p: string) {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("Starting extraction across 3 companies × 10 years × 3 statements...\n");

  let okCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const company of COMPANIES) {
    console.log("==================================================");
    console.log(`${company.name} (${company.ticker})`);
    console.log("==================================================");

    for (const year of YEARS) {
      const pdfPath = pdfPathFor(company.ticker, year);

      if (!existsReadable(pdfPath)) {
        console.log(`- ${year}:  missing PDF (${pdfPath})`);
        failCount += STATEMENTS.length;
        continue;
      }

      console.log(`\n--- ${company.ticker} ${year} ---`);
      console.log("Locating statements...");
      const located = await locateStatements(pdfPath);

      for (const statementType of STATEMENTS) {
        const outPath = outPathFor(company.ticker, year, statementType);
        const outDir = path.dirname(outPath);
        ensureDir(outDir);

        
        if (existsReadable(outPath)) {
          console.log(`  ${statementType}: ⏭ exists (${path.relative(process.cwd(), outPath)})`);
          skipCount++;
          continue;
        }

        const pages = located.pagesForLLM[statementType];
        if (!pages || pages.length === 0) {
          console.log(`  ${statementType}: no pages found to extract`);
          failCount++;
          continue;
        }

        try {
          console.log(`  ${statementType}: extracting text from pages: [${pages.join(", ")}]`);
          const pageText = await extractTextFromPages(pdfPath, pages);

          console.log(`  ${statementType}: calling OpenAI...`);
          const json = await extractStatementFromText({
            statementType,
            pageText,
            companyName: company.name,
            year: String(year),
          });

          fs.writeFileSync(outPath, JSON.stringify(json, null, 2), "utf-8");
          console.log(`  ${statementType}: saved -> ${path.relative(process.cwd(), outPath)}`);
          okCount++;
        } catch (err: any) {
          console.log(`  ${statementType}:  failed -> ${err?.message ?? err}`);
          failCount++;
        }
      }
    }

    console.log("");
  }

  console.log("==================================================");
  console.log("Done");
  console.log("==================================================");
  console.log(`extracted: ${okCount}`);
  console.log(`⏭  skipped:  ${skipCount}`);
  console.log(` failed:   ${failCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});