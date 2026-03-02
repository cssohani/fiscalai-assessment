import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const companies = await prisma.company.findMany({
    include: { documents: true },
  });

  for (const c of companies) {
    console.log(`${c.name}: ${c.documents.length} documents`);
  }
}

main().finally(() => prisma.$disconnect());