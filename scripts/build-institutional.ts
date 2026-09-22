/**
 * Builds the institutional holdings file.
 *
 * For each tracked filer: pull the two most recent 13F-HR filings, diff the
 * positions, and write content/institutional/latest.json.
 *
 * Offline for the usual reason — one filing's information table is a large
 * XML document, and each filer needs two of them plus a directory listing.
 *
 * Run with:  npm run build:institutional
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import {
  get13FHoldings,
  getSubmissions,
  mergeByIssuer,
  recentFilingsOfType,
  type Holding,
} from "../src/lib/sources/sec";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(ROOT, ".env.local"), quiet: true });

const OUT = resolve(ROOT, "content/institutional/latest.json");

/** Filers worth watching. CIKs are stable; a wrong one simply fails and is
 *  reported rather than silently producing an empty filer. */
const INSTITUTIONS = [
  { cik: 1067983, name: "Berkshire Hathaway", note: "וורן באפט" },
  { cik: 1350694, name: "Bridgewater Associates", note: "ריי דליו" },
  { cik: 1697748, name: "ARK Investment Management", note: "קרנות חדשנות" },
  { cik: 1037389, name: "Renaissance Technologies", note: "קרן כמותית" },
  { cik: 1167483, name: "Tiger Global Management", note: "צמיחה וטכנולוגיה" },
  { cik: 1061768, name: "Baupost Group", note: "סת קלארמן" },
  { cik: 1336528, name: "Pershing Square", note: "ביל אקמן" },
  { cik: 1649339, name: "Scion Asset Management", note: "מייקל בורי" },
];

/** Positions differ by more than this fraction before we call it a move.
 *  Below it, the change is usually share-class reshuffling, not a decision. */
const MATERIAL_CHANGE = 0.05;

type Change = {
  issuer: string;
  kind: "new" | "exited" | "increased" | "decreased";
  value: number;
  shares: number;
  previousShares: number;
  sharesChangePercent: number | null;
};

function diff(current: Holding[], previous: Holding[]): Change[] {
  const prevByIssuer = new Map(
    previous.map((h) => [h.issuer.toUpperCase(), h]),
  );
  const currByIssuer = new Map(current.map((h) => [h.issuer.toUpperCase(), h]));
  const changes: Change[] = [];

  for (const holding of current) {
    const key = holding.issuer.toUpperCase();
    const prior = prevByIssuer.get(key);

    if (!prior) {
      changes.push({
        issuer: holding.issuer,
        kind: "new",
        value: holding.value,
        shares: holding.shares,
        previousShares: 0,
        sharesChangePercent: null,
      });
      continue;
    }

    if (prior.shares <= 0) continue;
    const delta = (holding.shares - prior.shares) / prior.shares;
    if (Math.abs(delta) < MATERIAL_CHANGE) continue;

    changes.push({
      issuer: holding.issuer,
      kind: delta > 0 ? "increased" : "decreased",
      value: holding.value,
      shares: holding.shares,
      previousShares: prior.shares,
      sharesChangePercent: delta * 100,
    });
  }

  for (const holding of previous) {
    if (currByIssuer.has(holding.issuer.toUpperCase())) continue;
    changes.push({
      issuer: holding.issuer,
      kind: "exited",
      value: 0,
      shares: 0,
      previousShares: holding.shares,
      sharesChangePercent: -100,
    });
  }

  // Rank by the size of the position involved, so the list opens with the
  // moves that actually matter to the portfolio.
  return changes.sort(
    (a, b) => Math.max(b.value, 0) - Math.max(a.value, 0),
  );
}

async function buildInstitution(inst: (typeof INSTITUTIONS)[number]) {
  const submissions = await getSubmissions(inst.cik);
  const filings = recentFilingsOfType(submissions, "13F-HR", 2);

  if (filings.length === 0) {
    throw new Error("no 13F-HR filings found");
  }

  const current = mergeByIssuer(
    await get13FHoldings(
      inst.cik,
      filings[0].accessionNumber,
      filings[0].filingDate,
    ),
  );

  const previous =
    filings.length > 1
      ? mergeByIssuer(
          await get13FHoldings(
            inst.cik,
            filings[1].accessionNumber,
            filings[1].filingDate,
          ),
        )
      : [];

  const totalValue = current.reduce((sum, h) => sum + h.value, 0);

  return {
    cik: inst.cik,
    name: submissions.name || inst.name,
    note: inst.note,
    reportDate: filings[0].reportDate,
    filedAt: filings[0].filingDate,
    previousReportDate: filings[1]?.reportDate ?? null,
    totalValue,
    positionCount: current.length,
    topHoldings: current.slice(0, 10).map((h) => ({
      issuer: h.issuer,
      value: h.value,
      shares: h.shares,
      weight: totalValue > 0 ? (h.value / totalValue) * 100 : null,
    })),
    changes: previous.length ? diff(current, previous).slice(0, 12) : [],
    hasComparison: previous.length > 0,
  };
}

async function main() {
  if (!process.env.SEC_USER_AGENT) {
    console.error("SEC_USER_AGENT is not set. Check .env.local.");
    process.exit(1);
  }

  const institutions = [];
  const failed: string[] = [];

  for (const inst of INSTITUTIONS) {
    process.stdout.write(`${inst.name}... `);
    try {
      const built = await buildInstitution(inst);
      console.log(
        `${built.positionCount} positions, ${built.changes.length} moves, Q ending ${built.reportDate}`,
      );
      institutions.push(built);
    } catch (err) {
      console.log(`FAILED (${(err as Error).message})`);
      failed.push(inst.name);
    }
  }

  if (institutions.length === 0) {
    console.error("\nno institutions built - leaving the existing file untouched");
    process.exit(1);
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      { builtAt: new Date().toISOString(), institutions },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`\nwrote ${OUT}`);
  console.log(`${institutions.length}/${INSTITUTIONS.length} institutions`);
  if (failed.length) console.log(`failed: ${failed.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
