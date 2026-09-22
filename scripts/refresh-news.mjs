/**
 * Background news refresh.
 *
 * Fetches every sector from GDELT and writes content/news/latest.json.
 * Run by GitHub Actions on a schedule; the site only ever reads the file,
 * so no page view ever waits on GDELT.
 *
 * This exists because GDELT allows roughly one request every 5 seconds and
 * punishes bursts with a cooldown far longer than that. Doing the work in a
 * request handler meant page loads of 30 to 400 seconds.
 *
 *   node scripts/refresh-news.mjs
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "content/news/latest.json");

const BASE = "https://api.gdeltproject.org/api/v2/doc/doc";
const GAP_MS = 7_000;
const RETRY_DELAYS_MS = [20_000, 60_000];

const SECTORS = [
  {
    sector: "semis",
    label: "מוליכים למחצה",
    q: '(semiconductor OR "chip export" OR lithography OR foundry) sourcelang:english',
  },
  {
    sector: "energy",
    label: "אנרגיה",
    q: '("oil price" OR OPEC OR "natural gas" OR refinery) sourcelang:english',
  },
  {
    sector: "defense",
    label: "ביטחון",
    q: '("defense spending" OR "military aid" OR "arms deal") sourcelang:english',
  },
  {
    sector: "finance",
    label: "פיננסים",
    q: '("Federal Reserve" OR "interest rate" OR inflation OR "bond yields") sourcelang:english',
  },
  {
    sector: "trade",
    label: "סחר ומכסים",
    q: '(tariff OR "trade war" OR "export controls" OR sanctions) sourcelang:english',
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseSeenDate(stamp) {
  const iso = String(stamp).replace(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
    "$1-$2-$3T$4:$5:$6Z",
  );
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function dedupe(articles) {
  const seen = new Set();
  const out = [];
  for (const a of articles) {
    const key = a.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

async function fetchSector(entry) {
  const url =
    `${BASE}?query=${encodeURIComponent(entry.q)}` +
    `&mode=ArtList&format=json&sort=DateDesc&maxrecords=60&timespan=24h`;

  for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
    let res;
    let body;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      body = await res.text();
    } catch (err) {
      // A refused connection or DNS failure must be retried like a 429,
      // not crash the run and leave the feed unwritten.
      res = { ok: false, status: 0 };
      body = String(err?.cause?.code ?? err?.message ?? err);
    }

    // Rate-limit rejections arrive as prose, sometimes with a 200.
    if (res.ok && body.trimStart().startsWith("{")) {
      try {
        const json = JSON.parse(body);
        const articles = (json.articles ?? [])
          .filter((a) => a?.url && a?.title)
          .map((a) => ({
            url: a.url,
            title: a.title,
            domain: a.domain ?? "",
            country: a.sourcecountry ?? null,
            seenAt: parseSeenDate(a.seendate),
          }));
        return { ok: true, articles: dedupe(articles).slice(0, 12) };
      } catch {
        // Fall through to a retry.
      }
    }

    const delay = RETRY_DELAYS_MS[i];
    if (delay === undefined) {
      return {
        ok: false,
        error: `${res.status}: ${body.slice(0, 60)}`,
        articles: [],
      };
    }
    console.log(`  rate limited, waiting ${delay / 1000}s...`);
    await sleep(delay);
  }
  return { ok: false, error: "exhausted retries", articles: [] };
}

async function main() {
  // Previous run, if any. A sector that fails this time keeps the articles
  // it had rather than being blanked: losing good data to a transient rate
  // limit is worse than serving a feed that is an hour old.
  let previous = { sectors: [] };
  try {
    previous = JSON.parse(await readFile(OUT, "utf8"));
  } catch {
    // First run, or the file was removed. Nothing to preserve.
  }

  const now = new Date().toISOString();
  const sectors = [];
  let failures = 0;

  for (const entry of SECTORS) {
    process.stdout.write(`${entry.sector}... `);
    const result = await fetchSector(entry);
    const prior = (previous.sectors ?? []).find(
      (s) => s.sector === entry.sector,
    );

    if (result.ok) {
      console.log(`${result.articles.length} articles`);
      sectors.push({
        sector: entry.sector,
        label: entry.label,
        ok: true,
        refreshedAt: now,
        articles: result.articles,
      });
    } else {
      failures++;
      const kept = prior?.articles?.length ?? 0;
      console.log(
        kept
          ? `FAILED (${result.error}) - keeping ${kept} earlier articles`
          : `FAILED (${result.error})`,
      );
      sectors.push({
        sector: entry.sector,
        label: entry.label,
        ok: kept > 0,
        refreshedAt: prior?.refreshedAt ?? null,
        articles: prior?.articles ?? [],
      });
    }
    await sleep(GAP_MS);
  }

  // A total wipeout means GDELT is unreachable. Writing would replace a good
  // feed with nothing, so the existing file is left exactly as it is.
  if (failures === SECTORS.length) {
    console.error(
      `\nall ${SECTORS.length} sectors failed - leaving the existing feed untouched`,
    );
    process.exit(1);
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify({ refreshedAt: now, sectors }, null, 2),
    "utf8",
  );

  const total = sectors.reduce((n, s) => n + s.articles.length, 0);
  console.log(`\nwrote ${OUT}`);
  console.log(
    `${total} articles, ${SECTORS.length - failures}/${SECTORS.length} sectors refreshed`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
