/**
 * Background news refresh.
 *
 * Pulls market news from Finnhub, sorts it into sectors, and writes
 * content/news/latest.json. The site only ever reads that file, so no page
 * view waits on a news API.
 *
 * Finnhub replaced GDELT here after GDELT rate-limited every sector on a
 * scheduled run and failed the whole job. Beyond reliability, each Finnhub
 * item carries a summary, an image and related tickers — so the analysis
 * step never has to fetch the article page, which is what used to lose a
 * third of stories to paywalls.
 *
 *   node scripts/refresh-news.mjs
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SECTORS, classify, isRelevant, tickersIn } from "../src/lib/news-sectors.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "content/news/latest.json");

const API_KEY = process.env.FINNHUB_API_KEY;
const PER_SECTOR = 10;

/** Extra pulls so thin sectors are not left empty. Company news is tagged to
 *  one ticker, which reliably lands it in that company's sector. */
const COMPANY_PULLS = [
  "NVDA",
  "XOM",
  "NEE",
  "LMT",
  "LLY",
  "WMT",
  "JPM",
  "TSM",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadEnvFile() {
  // Local runs read .env.local; CI passes the key in the environment.
  if (API_KEY) return API_KEY;
  try {
    const raw = readFileSync(resolve(ROOT, ".env.local"), "utf8");
    return raw.match(/^FINNHUB_API_KEY=(.+)$/m)?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

async function finnhub(path, key) {
  const url = `https://finnhub.io/api/v1${path}${path.includes("?") ? "&" : "?"}token=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Finnhub ${res.status} for ${path}`);
  return res.json();
}

/**
 * Rejects publisher fallback logos.
 *
 * When a story has no artwork, Finnhub hands back the outlet's default
 * house image — Yahoo's is a 354x50 logo strip. Stretched into a card it
 * looks like a rendering bug, so it is better to show no image than that.
 */
const PLACEHOLDER_IMAGE = [
  /yahoo_finance_en-US/i,
  //rz/stage//i,
  /default[-_]?(image|thumb|logo)/i,
  /placeholder/i,
  /logo/i,
  /og[-_]image[-_]default/i,
];

function usableImage(url) {
  if (typeof url !== "string" || !url.startsWith("http")) return null;
  if (PLACEHOLDER_IMAGE.some((pattern) => pattern.test(url))) return null;
  return url;
}

function normalise(item) {
  return {
    url: item.url,
    title: item.headline,
    // Finnhub's own one-line summary. Kept so the analysis step has text to
    // work from even when the publisher blocks automated readers.
    excerpt: typeof item.summary === "string" ? item.summary.slice(0, 900) : "",
    image: usableImage(item.image),
    domain: item.source ?? "",
    country: null,
    seenAt: item.datetime
      ? new Date(item.datetime * 1000).toISOString()
      : null,
    tickers: tickersIn(item),
  };
}

/** The same wire story appears under several outlets; keep one per headline. */
function dedupe(articles) {
  const seen = new Set();
  const out = [];
  for (const article of articles) {
    const key = article.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .slice(0, 70);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(article);
  }
  return out;
}

async function main() {
  const key = loadEnvFile();
  if (!key) {
    console.error("FINNHUB_API_KEY is not set.");
    process.exit(1);
  }

  let previous = { sectors: [] };
  try {
    previous = JSON.parse(await readFile(OUT, "utf8"));
  } catch {
    // First run. Nothing to preserve.
  }

  const pool = new Map();
  let requests = 0;

  process.stdout.write("market news... ");
  try {
    const general = await finnhub("/news?category=general", key);
    requests++;
    for (const item of general) {
      if (!item?.url || !item?.headline || !isRelevant(item)) continue;
      pool.set(item.url, item);
    }
    console.log(`${general.length} items`);
  } catch (err) {
    console.log(`FAILED (${err.message})`);
  }

  // Finnhub's free tier allows 60 calls a minute; this loop uses nine.
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);

  for (const ticker of COMPANY_PULLS) {
    await sleep(1200);
    try {
      const items = await finnhub(
        `/company-news?symbol=${ticker}&from=${from}&to=${to}`,
        key,
      );
      requests++;
      let added = 0;
      for (const item of items.slice(0, 15)) {
        if (!item?.url || !item?.headline || !isRelevant(item)) continue;
        if (pool.has(item.url)) continue;
        // Company news is not always tagged, so pin the ticker we asked for.
        pool.set(item.url, { ...item, related: item.related || ticker });
        added++;
      }
      process.stdout.write(`${ticker}:${added} `);
    } catch {
      process.stdout.write(`${ticker}:fail `);
    }
  }
  console.log(`\n\n${pool.size} unique articles from ${requests} requests\n`);

  if (pool.size === 0) {
    console.error("no articles fetched - leaving the existing feed untouched");
    process.exit(1);
  }

  const now = new Date().toISOString();
  const buckets = new Map(SECTORS.map((s) => [s.sector, []]));

  for (const item of pool.values()) {
    for (const sector of classify(item)) {
      buckets.get(sector)?.push(normalise(item));
    }
  }

  const sectors = SECTORS.map((definition) => {
    const found = dedupe(buckets.get(definition.sector) ?? [])
      .sort((a, b) => (b.seenAt ?? "").localeCompare(a.seenAt ?? ""))
      .slice(0, PER_SECTOR);

    const prior = (previous.sectors ?? []).find(
      (s) => s.sector === definition.sector,
    );

    // A sector with nothing new keeps what it had rather than going blank:
    // a quiet hour is not the same as no coverage.
    const articles = found.length > 0 ? found : (prior?.articles ?? []);

    return {
      sector: definition.sector,
      label: definition.label,
      blurb: definition.blurb,
      accent: definition.accent,
      ok: true,
      refreshedAt: found.length > 0 ? now : (prior?.refreshedAt ?? null),
      articles,
    };
  });

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify({ refreshedAt: now, sectors }, null, 2) + "\n",
    "utf8",
  );

  console.log(`wrote ${OUT}`);
  for (const sector of sectors) {
    console.log(`  ${sector.sector.padEnd(10)} ${sector.articles.length}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
