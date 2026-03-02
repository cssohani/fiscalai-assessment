import path from "path";
import { locateStatements } from "../lib/pdf/locateStatements";

async function main() {
  const tests = [
    { ticker: "SIE", year: "2024" },
    { ticker: "MBG", year: "2024" },
    { ticker: "TTE", year: "2024" },
  ];

  for (const t of tests) {
    const pdfPath = path.join(
      process.cwd(),
      "data",
      "pdfs",
      t.ticker,
      `${t.year}.pdf`
    );

    console.log("\n========================================");
    console.log(`PDF: ${t.ticker} ${t.year}`);

    const result = await locateStatements(pdfPath);

    console.log(`Total pages: ${result.totalPages}`);
    console.log("Detected best pages:", result.topPages);

    console.log("Income pagesForLLM:", result.pagesForLLM.income);
    console.log("Balance pagesForLLM:", result.pagesForLLM.balance);
    console.log("Cashflow pagesForLLM:", result.pagesForLLM.cashflow);
  }
}

main().catch(console.error);