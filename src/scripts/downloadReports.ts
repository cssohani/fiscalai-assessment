import "dotenv/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { pipeline } from "stream/promises";
import { fetch } from "undici";
import { prisma } from "../lib/prisma";

const BASE_DIR = path.join(process.cwd(), "data", "pdfs");

function extractYear(title: string | null): string {
  if (!title) return "unknown";
  const match = title.match(/\b(20\d{2})\b/);
  return match ? match[1] : "unknown";
}

async function fileExists(filePath: string) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function downloadFile(url: string, dest: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      Accept: "application/pdf,*/*",
    },
  });

  if (!res.ok || !res.body) {
    throw new Error(`Download failed with status ${res.status}`);
  }

  await pipeline(res.body, fs.createWriteStream(dest));
}

async function main() {
  console.log("Starting download stage...\n");

  const documents = await prisma.document.findMany({
    include: { company: true },
  });

  if (documents.length === 0) {
    console.log("No documents found in DB.");
    return;
  }

  for (const doc of documents) {
    const ticker = doc.company.ticker;
    const year = extractYear(doc.title);
    const companyDir = path.join(BASE_DIR, ticker);

    await fs.promises.mkdir(companyDir, { recursive: true });

    const filePath = path.join(companyDir, `${year}.pdf`);

    const alreadyDownloaded =
      doc.localPath &&
      (await fileExists(doc.localPath));

    if (alreadyDownloaded) {
      console.log(`✓ Skipping ${ticker} ${year} (already downloaded)`);
      continue;
    }

    console.log(`Downloading ${ticker} ${year}...`);

    try {
      await downloadFile(doc.url, filePath);

      const stats = await fs.promises.stat(filePath);
      const hash = await sha256File(filePath);

      await prisma.document.update({
        where: { id: doc.id },
        data: {
          localPath: filePath,
          bytes: stats.size,
          sha256: hash,
          mime: "application/pdf",
        },
      });

      console.log(`✓ Saved ${ticker} ${year}`);
    } catch (err) {
      console.error(`✗ Failed ${ticker} ${year}`, err);
    }
  }

  console.log("\nDownload stage complete.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });