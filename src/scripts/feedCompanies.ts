import { prisma } from "../lib/prisma";

async function main() {
  const companies = [
    {
      name: "Mercedez Benz Group AG",
      ticker: "MBG",
      country: "Germany",
      irUrl: "https://group.mercedes-benz.com/investors/reports-news/annual-reports/download/",
    },
    {
      name: "Siemens",
      ticker: "SIE",
      country: "Germany",
      irUrl: "https://www.siemens.com/en-us/company/investor-relations/annual-reports/"    },
    {
      name: "TotalEnergies",
      ticker: "TTE",
      country: "France",
      irUrl: "https://totalenergies.com/investors/publications-and-regulated-information/regulated-information/annual-financial-reports",
    },
  ];

  for (const company of companies) {
    await prisma.company.upsert({
      where: { ticker: company.ticker },
      update: {
        name: company.name.trim(),
        country: company.country,
        irUrl: company.irUrl,
      },
      create: {
        name: company.name.trim(),
        ticker: company.ticker,
        country: company.country,
        irUrl: company.irUrl,
      },
    });
  }

  console.log("Companies seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });