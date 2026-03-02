import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const companies = await prisma.company.findMany();
  console.log(companies);
}

main().finally(() => prisma.$disconnect());