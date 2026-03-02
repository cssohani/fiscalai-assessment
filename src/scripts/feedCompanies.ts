import { prisma } from "../lib/prisma";

async function main() {
  const companies = [
    {
      name: "Airbus",
      ticker: "AIR",
      country: "Netherlands",
      irUrl: "https://www.airbus.com/en/investors/annual-reports",
    },
    {
      name: "Siemens",
      ticker: "SIE",
      country: "Germany",
      irUrl: "https://www.siemens.com/en-us/company/investor-relations/annual-reports/"    },
    {
      name: "ASML",
      ticker: "ASML",
      country: "Netherlands",
      irUrl: "https://www.asml.com/en/investors/annual-report",
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