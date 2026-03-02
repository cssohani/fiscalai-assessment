import OpenAI from "openai";
import "dotenv/config";


//use LLM to extract table data for different tables

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ExtractInput = {
  statementType: "income" | "balance" | "cashflow";
  pageText: string;
  companyName: string;
  year: string;
};

//prompt
export async function extractStatementFromText({
  statementType,
  pageText,
  companyName,
  year,
}: ExtractInput) {
  const systemPrompt = `
You are a financial statement extraction engine.

Your task:
Extract ONLY the primary consolidated ${statementType} statement table
from the provided PDF text.

Rules:
- Extract ONLY tabular financial rows.
- Ignore KPIs, highlights, compensation, narrative text.
- Ignore footnotes unless they are part of table rows.
- Preserve row labels exactly as written.
- Preserve numeric formatting (including commas and negatives).
- Detect currency symbol if present.
- Detect units (thousand, million, billion).
- Identify year columns in correct order.
- Return STRICT JSON only.
- No commentary.
`;

  const userPrompt = `
Company: ${companyName}
Year of report: ${year}
Statement type: ${statementType}

Below is extracted PDF text from the relevant pages.

-------------------------
${pageText}
-------------------------

Return JSON in this exact format:

{
  "statementType": "${statementType}",
  "currency": "string or null",
  "units": "string or null",
  "years": ["YYYY", "..."],
  "rows": [
    {
      "label": "Row name",
      "values": ["value1", "value2", "..."]
    }
  ]
}

Only return valid JSON.
`;

  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0,
  });

  let output = response.output_text.trim();


  //format json to avoid errors
if (output.startsWith("```")) {
  output = output.replace(/```json/g, "")
                 .replace(/```/g, "")
                 .trim();
}

try {
  return JSON.parse(output);
} catch {
    console.error("LLM returned invalid JSON:");
    console.log(output);
    throw new Error("Invalid JSON from LLM");
  }
}