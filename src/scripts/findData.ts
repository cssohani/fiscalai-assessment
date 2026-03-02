import "dotenv/config";
import { prisma } from "../lib/prisma";
import { discoverPdfLinks } from "../lib/investor_relations/discover";

async function main() {
  console.log("Starting PDF discovery...\n");

  const companies = await prisma.company.findMany();

  if (companies.length === 0) {
    console.log("No companies found in DB.");
    return;
  }

  for (const company of companies) {
    console.log(`---`);
    console.log(`Discovering PDFs for ${company.name} (${company.ticker})`);
    console.log(`IR URL: ${company.irUrl}\n`);

    try {
      const pdfs = await discoverPdfLinks(company.irUrl);

      console.log(`Found ${pdfs.length} PDFs`);

      let inserted = 0;

      for (const pdf of pdfs) {
        await prisma.document.upsert({
          where: {
            companyId_url: {
              companyId: company.id,
              url: pdf.url,
            },
          },
          update: {
            title: pdf.title,
          },
          create: {
            companyId: company.id,
            url: pdf.url,
            title: pdf.title,
          },
        });

        inserted++;
      }

      console.log(`Upserted ${inserted} documents\n`);
    } catch (error) {
      console.error(`Error processing ${company.name}:`, error);
    }
  }

  console.log("PDF discovery complete.");
}

main()
  .catch((err) => {
    console.error("Fatal error during discovery:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });