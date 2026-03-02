import { fetch } from "undici";
import * as cheerio from "cheerio";


//discover PDFs from the given url
export type DiscoveredPdf = {
  url: string;
  title: string;
};

function toAbsoluteUrl(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

export async function discoverPdfLinks(irUrl: string): Promise<DiscoveredPdf[]> {
  const res = await fetch(irUrl)

  if (!res.ok) {
    throw new Error(`Failed to fetch IR page: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const results: DiscoveredPdf[] = [];

  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    if (!href.toLowerCase().includes(".pdf")) return;

    const absoluteUrl = toAbsoluteUrl(irUrl, href);
    const title = $(el).text().trim();

    results.push({
      url: absoluteUrl,
      title,
    });
  });

 
  const unique = Array.from(
    new Map(results.map((r) => [r.url, r])).values()
  );

  return unique;
}