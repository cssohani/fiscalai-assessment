// src/scripts/findData.ts
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { discoverPdfLinks } from "../lib/investor_relations/discover";

type PdfWithYear = {
  url: string;
  title: string;
  year: number | null;
  score: number;
};

function extractYear(text: string): number | null {
  const m = text.match(/\b(20\d{2})\b/);
  if (!m) return null;
  const y = Number(m[1]);
  return Number.isFinite(y) ? y : null;
}

function normalizeTitle(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

function scoreCandidate(titleLower: string, urlLower: string, keywords: string[]): number {
  // Simple scoring so we pick the “best” doc when multiple PDFs exist for the same year.
  // Higher is better.
  let score = 0;

  for (const kw of keywords) {
    if (titleLower.includes(kw)) score += 10;
    if (urlLower.includes(kw.replace(/\s+/g, "-"))) score += 4;
  }

  // Prefer PDFs that look like primary reports
  if (titleLower.includes("full")) score += 2;
  if (titleLower.includes("report")) score += 2;
  if (titleLower.includes("financial")) score += 2;

  // Slightly penalize obvious non-core docs
  if (titleLower.includes("presentation")) score -= 6;
  if (titleLower.includes("factsheet") || titleLower.includes("fact sheet")) score -= 6;
  if (titleLower.includes("taxonomy")) score -= 6;

  return score;
}

async function main() {
  console.log("Starting Annual Report discovery...\n");

  const companies = await prisma.company.findMany();
  if (companies.length === 0) {
    console.log("No companies found in DB.");
    return;
  }

  const currentYear = 2024;
  const minYear = currentYear - 9; // last 10 years

  // Company-specific filing terminology
  // NOTE: These are discovery filters only — extraction stage still validates the statements inside.
  const keywordMap: Record<string, string[]> = {
    // Mercedes-Benz Group AG (commonly “Annual Report”, sometimes “Integrated Report”)
    MBG: ["annual report", "annual", "integrated report", "integrated"],
    // Siemens (annual report / annual financial statements)
    SIE: ["annual report", "annual", "annual financial statements", "financial statements"],
    // TotalEnergies (French-style “(Universal) Registration Document” = annual financial report)
    TTE: ["universal registration document", "registration document", "annual financial report"],
  };

  for (const company of companies) {
    console.log("--------------------------------------------------");
    console.log(`Discovering Annual Reports for ${company.name} (${company.ticker})`);
    console.log(`IR URL: ${company.irUrl}\n`);

    try {
      const pdfs = await discoverPdfLinks(company.irUrl);

      console.log(`Discovered ${pdfs.length} PDFs total`);

      const keywords =
        keywordMap[company.ticker] ??
        // safe default if you add a new company and forget the map
        ["annual report", "annual", "registration document", "universal registration document", "financial report"];

      const candidates: PdfWithYear[] = pdfs.map((p) => {
        const title = normalizeTitle(p.title);
        const titleLower = title.toLowerCase();
        const urlLower = p.url.toLowerCase();

        const year = extractYear(title) ?? extractYear(p.url);
        const score = scoreCandidate(titleLower, urlLower, keywords);

        return { url: p.url, title, year, score };
      });

      // 1) keep only within target year range
      const inRange = candidates.filter((c) => c.year && c.year >= minYear && c.year <= currentYear);

      // 2) keep only things that look like the company’s “annual filing terminology”
      //    (for TotalEnergies this is “registration document”; for Siemens/Mercedes it’s “annual/integrated”)
      const matchesTerminology = inRange.filter((c) => {
        const t = c.title.toLowerCase();
        const u = c.url.toLowerCase();
        return keywords.some((kw) => t.includes(kw) || u.includes(kw.replace(/\s+/g, "-")));
      });

      // 3) pick ONE best PDF per year
      const bestByYear = new Map<number, PdfWithYear>();
      for (const c of matchesTerminology) {
        const y = c.year!;
        const existing = bestByYear.get(y);
        if (!existing || c.score > existing.score) {
          bestByYear.set(y, c);
        }
      }

      // 4) ensure we only keep the last 10 years (in case more slip in)
      const finalReports = Array.from(bestByYear.values())
        .sort((a, b) => (b.year! - a.year!))
        .slice(0, 10)
        .sort((a, b) => (b.year! - a.year!)); // keep newest-first logging

      console.log(`Filtered to ${finalReports.length} Annual Reports (last 10 years)`);

      for (const r of finalReports) {
        await prisma.document.upsert({
          where: {
            companyId_url: {
              companyId: company.id,
              url: r.url,
            },
          },
          update: {
            title: r.title,
          },
          create: {
            companyId: company.id,
            url: r.url,
            title: r.title,
          },
        });

        console.log(`✓ Saved ${r.year} - ${r.title || "(no title)"}`);
      }

      console.log("");
    } catch (err) {
      console.error(`Error processing ${company.name}:`, err);
      console.log("");
    }
  }

  console.log("Annual Report discovery complete.");
}

main()
  .catch((err) => console.error("Fatal error during discovery:", err))
  .finally(async () => {
    await prisma.$disconnect();
  });