import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractTextFromPages(
  pdfPath: string,
  pages: number[]
): Promise<string> {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  let combinedText = "";

  for (const pageNum of pages) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const text = content.items
      .map((item: any) => item.str)
      .join(" ");

    combinedText += `\n\n--- PAGE ${pageNum} ---\n\n`;
    combinedText += text;
  }

  return combinedText;
}