import { prisma } from "../lib/prisma";

async function main() {
  const companies = [
    {
      name: "ASML",
      ticker: "ASML",
      country: "Netherlands",
      irUrl: "PASTE_IR_URL_HERE",
    },
    {
      name: "SAP",
      ticker: "SAP",
      country: "Germany",
      irUrl: "PASTE_IR_URL_HERE",
    },
    {
      name: "Siemens",
      ticker: "SIE",
      country: "Germany",
      irUrl: "PASTE_IR_URL_HERE",
    },
  ];

  for (const company of companies) {
    await prisma.company.upsert({
      where: { irUrl: company.irUrl },
      update: {},
      create: company,
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