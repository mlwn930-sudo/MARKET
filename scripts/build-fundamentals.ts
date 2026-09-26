/**
 * Builds the precomputed fundamentals file.
 *
 * For every company in the universe: pull SEC filings and a Finnhub profile,
 * run the same metric formulas the site uses, and write the result to
 * content/fundamentals/universe.json together with a median per sector.
 *
 * This runs offline for the same reason the news refresh does — one
 * companyfacts document is several megabytes, and doing forty of them inside
 * a request would take minutes. The site reads the file.
 *
 * Run with:  npm run build:fundamentals
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { getCompanyFacts, lookupTicker } from "../src/lib/sources/sec";
import { getProfile } from "../src/lib/sources/finnhub";
import { computeFundamentals } from "../src/lib/metrics/fundamentals";
import { UNIVERSE, SECTOR_LABELS, median } from "../src/lib/universe";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Safe to load after the imports: the source modules read process.env lazily,
// inside the call that needs it, not at module scope.
config({ path: resolve(ROOT, ".env.local"), quiet: true });

const OUT = resolve(ROOT, "content/fundamentals/universe.json");

/** Metrics worth comparing across companies. Absolute figures such as Free
 *  Cash Flow are left out: a median dollar amount across companies of wildly
 *  different size says nothing. */
const COMPARABLE = [
  "pe",
  "ps",
  "pb",
  "ev_ebitda",
  "ev_fcf",
  "earnings_yield",
  "gross_margin",
  "operating_margin",
  "net_margin",
  "roe",
  "roa",
  "roic",
  "rev_cagr_3",
  "rev_cagr_5",
  "op_cagr_3",
  "fcf_margin",
  "fcf_yield",
  "capex_ratio",
  "debt_equity",
  "net_debt_ebitda",
  "current_ratio",
  "interest_coverage",
  "altman_z",
];

type CompanyRow = {
  ticker: string;
  name: string;
  sector: string;
  marketCap: number | null;
  asOf: string | null;
  stale: boolean;
  metrics: Record<string, number | null>;
};

async function buildCompany(
  ticker: string,
  sector: string,
): Promise<CompanyRow | null> {
  const listing = await lookupTicker(ticker);
  if (!listing) {
    console.log(`  ${ticker}: not found in the SEC ticker map`);
    return null;
  }

  const [facts, profile] = await Promise.all([
    getCompanyFacts(listing.cik_str),
    getProfile(ticker).catch(() => null),
  ]);

  const marketCap = profile?.marketCap ?? null;
  const fundamentals = computeFundamentals(facts, marketCap);

  const metrics: Record<string, number | null> = {};
  for (const group of fundamentals.groups) {
    for (const metric of group.metrics) {
      if (COMPARABLE.includes(metric.key)) metrics[metric.key] = metric.value;
    }
  }

  const present = Object.values(metrics).filter((v) => v !== null).length;
  console.log(
    `  ${ticker.padEnd(6)} ${present}/${COMPARABLE.length} metrics` +
      (fundamentals.stale ? "  (filings are stale)" : ""),
  );

  return {
    ticker,
    name: profile?.name ?? listing.title,
    sector,
    marketCap,
    asOf: fundamentals.asOf?.end ?? null,
    stale: fundamentals.stale,
    metrics,
  };
}

async function main() {
  if (!process.env.SEC_USER_AGENT) {
    console.error("SEC_USER_AGENT is not set. Check .env.local.");
    process.exit(1);
  }

  console.log(`building fundamentals for ${UNIVERSE.length} companies\n`);

  const companies: CompanyRow[] = [];
  const failed: string[] = [];

  for (const entry of UNIVERSE) {
    try {
      const row = await buildCompany(entry.ticker, entry.sector);
      if (row) companies.push(row);
      else failed.push(entry.ticker);
    } catch (err) {
      console.log(`  ${entry.ticker}: FAILED (${(err as Error).message})`);
      failed.push(entry.ticker);
    }
  }

  // Medians per sector. median() returns null below three usable peers,
  // so a thin sector simply has no benchmark rather than a fake one.
  const sectors: Record<
    string,
    { label: string; count: number; medians: Record<string, number | null> }
  > = {};

  for (const key of Object.keys(SECTOR_LABELS)) {
    const members = companies.filter((c) => c.sector === key);
    const medians: Record<string, number | null> = {};
    for (const metric of COMPARABLE) {
      medians[metric] = median(members.map((m) => m.metrics[metric] ?? null));
    }
    sectors[key] = {
      label: SECTOR_LABELS[key as keyof typeof SECTOR_LABELS],
      count: members.length,
      medians,
    };
  }

  // A run that lost most of the universe would poison every median, so the
  // previous file is kept instead.
  if (companies.length < UNIVERSE.length / 2) {
    console.error(
      `\nonly ${companies.length}/${UNIVERSE.length} companies built - leaving the existing file untouched`,
    );
    process.exit(1);
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      { builtAt: new Date().toISOString(), companies, sectors },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`\nwrote ${OUT}`);
  console.log(`${companies.length}/${UNIVERSE.length} companies`);
  if (failed.length) console.log(`failed: ${failed.join(", ")}`);
  for (const [key, s] of Object.entries(sectors)) {
    const withMedian = Object.values(s.medians).filter((v) => v !== null).length;
    console.log(`  ${key.padEnd(12)} ${s.count} peers, ${withMedian} medians`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
