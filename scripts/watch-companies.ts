/**
 * The per-company agent.
 *
 * The market scan in watch-market.ts asks one question of a hundred and
 * twenty-three companies: did anything move out of character. That is the
 * right question for a universe and the wrong one for a company somebody
 * is actually following, where the interesting changes are slower and have
 * nothing to do with today's candle — a thesis that stopped holding, a
 * test the business used to pass, a date arriving.
 *
 * So this runs only over the companies on somebody's watchlist, and it
 * reads the record rather than recomputing it. The nightly job already
 * fingerprints every company and stores what changed between filings;
 * `recentChanges` and `upcomingCatalysts` are that work, finished. Running
 * the agent pipeline again here would cost minutes and produce the same
 * answer.
 *
 * NOTHING HERE IS A RECOMMENDATION. Every finding is a change with the
 * figures that moved and the grade the claim already carries, and the
 * ordering is by the materiality the diff computed — a statement about how
 * much moved, not about what to do with it.
 *
 * Run with:  npm run watch:companies
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import {
  recentChanges,
  upcomingCatalysts,
  historyIsEmpty,
} from "../src/lib/intel/history-store";
import { approvedWithWatchlists } from "../src/lib/alerts/subscribers";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(ROOT, ".env.local"), quiet: true });

const OUT = resolve(ROOT, "content/watch/companies.json");

export type CompanyFinding = {
  kind: "thesis" | "catalyst";
  ticker: string;
  company: string;
  headline: string;
  detail: string;
  /** What the record says it is worth, not what this script thinks. */
  weight: number;
  /** How far the claim can be pushed, carried through from the diff rather
   *  than restated — a change graded "possible" must not arrive in an
   *  inbox reading like a fact. */
  grade: string | null;
  at: string;
  href: string;
};

/** A change older than this is not news to anybody, and the nightly job
 *  keeps a fortnight of them. */
const WINDOW_DAYS = 14;

/** Dated events further out than this are a calendar, not an alert.
 *
 *  Sixty, not twenty-one. The record carries earnings dates six weeks out
 *  and a quarterly report is the single most anticipated thing about a
 *  company somebody follows — at twenty-one days the first run found a
 *  November date for NVDA and said nothing, which is the opposite of what
 *  a watchlist is for. */
const CATALYST_DAYS = 60;

async function main() {
  const stamp = new Date().toISOString();

  if (await historyIsEmpty()) {
    console.log(
      "thesis history is empty — run `npm run build:thesis` first; nothing to compare against",
    );
    return;
  }

  /* Only the companies somebody follows. The universe is scanned by the
     other job; this one exists precisely because reading a hundred and
     twenty-three thesis records would bury the six that matter. */
  const readers = await approvedWithWatchlists();
  const followed = new Set(readers.flatMap((r) => r.tickers));

  if (followed.size === 0) {
    console.log("nobody follows anything yet — nothing to check");
    await write({ builtAt: stamp, followed: 0, findings: [] });
    return;
  }

  const findings: CompanyFinding[] = [];

  /* ---- Theses that moved ---- */
  const changes = await recentChanges(WINDOW_DAYS);
  for (const change of changes) {
    if (!followed.has(change.ticker)) continue;

    /* The reasons the diff recorded, not a summary of them. Three is what
       fits in an inbox; the page carries the rest. */
    const why = change.why.slice(0, 3).join(" · ");

    /* `from` and `to` are the two fingerprint TIMESTAMPS, not the two
       positions — a headline built from them reads as a pair of ISO
       strings and tells nobody anything. The sentence a reader needs is
       the one the diff already wrote. */
    findings.push({
      kind: "thesis",
      ticker: change.ticker,
      company: change.companyName,
      headline: `${change.ticker}: ${change.newView}`,
      detail: why || change.oldView,
      weight: change.materiality,
      grade: change.claim.grade,
      at: stamp,
      href: `/company/${change.ticker}`,
    });
  }

  /* ---- Dates arriving ---- */
  const catalysts = await upcomingCatalysts(CATALYST_DAYS);
  for (const catalyst of catalysts) {
    if (!followed.has(catalyst.ticker)) continue;
    findings.push({
      kind: "catalyst",
      ticker: catalyst.ticker,
      company: catalyst.companyName,
      headline: `${catalyst.ticker}: ${catalyst.title}`,
      detail: `${catalyst.when} — ${catalyst.why}`,
      /* Below a thesis change on purpose. A date that has not happened yet
         is a thing to prepare for; a thesis that stopped holding is a thing
         that already happened. */
      weight: 1.5,
      grade: null,
      at: stamp,
      href: `/company/${catalyst.ticker}`,
    });
  }

  findings.sort((a, b) => b.weight - a.weight);

  await write({ builtAt: stamp, followed: followed.size, findings });

  console.log(`followed companies : ${followed.size}`);
  console.log(
    `findings           : ${findings.length} ` +
      `(${findings.filter((f) => f.kind === "thesis").length} thesis, ` +
      `${findings.filter((f) => f.kind === "catalyst").length} catalyst)`,
  );
  for (const f of findings.slice(0, 6)) {
    console.log(`  [${f.kind}] ${f.headline.slice(0, 70)}`);
  }
}

async function write(payload: unknown) {
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 2), "utf8");
}

main();
