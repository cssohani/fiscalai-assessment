import path from "path";
import { locateStatements } from "../lib/pdf/locateStatements";
import { extractStatementFromText } from "../lib/ai/extractStatement";
import { extractTextFromPages } from "../lib/pdf/extractTextFromPages";

async function main() {
  const ticker = "SIE";
  const year = "2024";

  const pdfPath = path.join(
    process.cwd(),
    "data",
    "pdfs",
    ticker,
    `${year}.pdf`
  );

  console.log("Locating statements...");
  const result = await locateStatements(pdfPath);

  console.log("Top pages:", result.topPages);
  console.log("Pages for LLM:", result.pagesForLLM);


  const statementType = "income"; 

  const pages = result.pagesForLLM[statementType];

  if (!pages || pages.length === 0) {
    console.error("No pages found for statement.");
    return;
  }

  console.log("Extracting text from pages:", pages);

  const text = await extractTextFromPages(pdfPath, pages);

  console.log("Calling OpenAI...");

  const output = await extractStatementFromText({
  statementType,
  pageText: text,
  companyName: "Siemens",
  year: "2024",
});

  console.log("\n--- RAW LLM OUTPUT ---\n");
  console.log(JSON.stringify(output, null, 2));
}

main().catch(console.error);