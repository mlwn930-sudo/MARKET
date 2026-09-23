/**
 * Applies the relevance rules to an existing feed, offline.
 *
 * Exists because the rules changed after the feed was fetched, and GDELT's
 * rate limit makes re-fetching expensive. Filtering what is already on disk
 * costs nothing and produces the same result the next scheduled refresh
 * would have.
 *
 *   node scripts/filter-news.mjs
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isRelevant, tickersIn } from "../src/lib/news-sectors.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = resolve(ROOT, "content/news/latest.json");

const feed = JSON.parse(await readFile(FILE, "utf8"));

let kept = 0;
let dropped = 0;

feed.sectors = feed.sectors.map((sector) => {
  const filtered = sector.articles
    .map((article) => ({ ...article, tickers: tickersIn(article.title) }))
    .filter((article) => {
      const ok = isRelevant(article);
      if (ok) kept++;
      else dropped++;
      return ok;
    })
    .slice(0, 8);

  return { ...sector, articles: filtered };
});

await writeFile(FILE, JSON.stringify(feed, null, 2), "utf8");

console.log(`kept ${kept}, dropped ${dropped}`);
for (const sector of feed.sectors) {
  console.log(`\n[${sector.label}] ${sector.articles.length}`);
  for (const article of sector.articles) {
    const tags = article.tickers.length ? `  {${article.tickers.join(",")}}` : "";
    console.log(`  ${article.title.slice(0, 88)}${tags}`);
  }
}
