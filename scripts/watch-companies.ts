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
import { readLevels } from "../src/lib/metrics/levels";
import { readTape, CHARACTER_LABELS } from "../src/lib/metrics/tape";
import { getTickerCoverage } from "../src/lib/news-store";
import { baseRatesFor } from "../src/lib/metrics/base-rate-store";
import { MIN_SAMPLE } from "../src/lib/metrics/base-rates";
import type { Candle } from "../src/lib/sources/prices";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(ROOT, ".env.local"), quiet: true });

const OUT = resolve(ROOT, "content/watch/companies.json");

export type CompanyFinding = {
  kind: "thesis" | "catalyst" | "level" | "tape" | "news";
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

/* ------------------------------------------------------------------ */
/* The chart, the levels and the wire — for followed companies only    */
/* ------------------------------------------------------------------ */

/**
 * Two years of daily candles, for one company.
 *
 * Only companies somebody actually follows get pulled, which is the whole
 * economy of this script: a watchlist is a handful of names, not the
 * universe, so this costs a handful of requests rather than a hundred and
 * twenty-three. The nightly ranking already walks the universe and has no
 * need of this.
 */
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
};

async function candlesFor(symbol: string): Promise<Candle[] | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d`,
      { headers: HEADERS, signal: AbortSignal.timeout(30_000) },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const stamps: number[] = result?.timestamp ?? [];
    const quote = result?.indicators?.quote?.[0];
    if (!quote || stamps.length === 0) return null;
    const rows: Candle[] = [];
    for (let i = 0; i < stamps.length; i++) {
      const [o, h, l, c] = [quote.open?.[i], quote.high?.[i], quote.low?.[i], quote.close?.[i]];
      if (![o, h, l, c].every((v) => Number.isFinite(v))) continue;
      rows.push({
        date: new Date(stamps[i] * 1000).toISOString().slice(0, 10),
        open: o, high: h, low: l, close: c,
        volume: Number.isFinite(quote.volume?.[i]) ? quote.volume[i] : 0,
      });
    }
    return rows;
  } catch {
    return null;
  }
}

/** How close price has to sit to a level before it is worth saying so. A
 *  level three per cent away is not being tested; it is just nearby. */
const NEAR_LEVEL = 1.8;

/** A band price has turned at twice is a coincidence worth noting on a
 *  chart and not worth an email. Three is the floor for a message. */
const MIN_TOUCHES = 3;

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

  /* ---- The chart, per followed company ----

     The three things a person watching a handful of names actually checks
     every day, and which this agent did not report: where the price sits
     against the levels it has turned at before, what the last session's
     volume looked like, and whether anything was written about them.

     Only the followed names are pulled. That is the whole economy here —
     a watchlist is a handful of symbols, so this is a handful of requests,
     and the nightly ranking already walks the universe for everything
     else. */
  for (const ticker of [...followed].sort()) {
    const candles = await candlesFor(ticker);
    if (!candles || candles.length < 120) {
      console.log(`  ${ticker}: no usable history`);
      continue;
    }
    const close = candles[candles.length - 1].close;

    /* ---- Support and resistance ---- */
    for (const level of readLevels(candles, 8)) {
      if (level.touches < MIN_TOUCHES) continue;
      const distance = Math.abs(level.distancePercent);
      if (distance > NEAR_LEVEL) continue;

      const side = level.kind === "support" ? "תמיכה" : "התנגדות";
      findings.push({
        kind: "level",
        ticker,
        company: ticker,
        headline: `${ticker} ${distance < 0.5 ? "על" : "קרובה ל"}${side} שהחזיקה ${level.held} מתוך ${level.held + level.broke} פעמים`,
        detail:
          `המחיר ${close.toFixed(2)} מול הרמה ${level.price.toFixed(2)} ` +
          `(${level.distancePercent >= 0 ? "+" : ""}${level.distancePercent.toFixed(1)}%). ` +
          `${level.touches} תפניות נפרדות בתוך הרצועה, האחרונה ב-${level.lastTouch}. ` +
          `זו ספירה של מה שקרה, לא תחזית שהרמה תחזיק שוב.`,
        /* Above a catalyst, below a thesis change. A level being tested is
           happening now; a thesis that stopped holding already happened. */
        weight: 2.0 + Math.min(level.touches, 6) / 10,
        grade: null,
        at: stamp,
        href: `/company/${ticker}`,
      });
    }

    /* ---- The tape ---- */
    const tape = readTape(candles);
    const bar = tape.latest;
    if (bar && bar.character !== "quiet") {
      /* What that kind of session has been followed by on this instrument.
         A shape with no track record is still worth reporting; a shape
         whose track record says it meant nothing must say that too. */
      const rates = await baseRatesFor(ticker).catch(() => null);
      const condition = rates?.conditions.find((c) =>
        c.key === `${bar.character}-bar`,
      );
      const outcome = condition?.outcomes.find((o) => o.days === 21);
      const record =
        outcome && outcome.n >= MIN_SAMPLE
          ? ` בעשר שנים זה קרה ${condition!.occurrences} פעמים, ואחרי חודש המחיר היה גבוה יותר ב-${Math.round(outcome.up * 100)}% מהן מול בסיס של ${Math.round(outcome.baselineUp * 100)}%${Math.abs(outcome.liftPp) < 10 ? " — כלומר התנאי לא הוסיף מידע." : "."}`
          : " אין מדגם מספיק כדי לומר מה זה היה שווה כאן.";

      findings.push({
        kind: "tape",
        ticker,
        company: ticker,
        headline: `${ticker}: ${CHARACTER_LABELS[bar.character]}`,
        detail:
          `${bar.date} · מחזור ×${bar.volumeRatio.toFixed(1)}` +
          (bar.volumePercentile !== null
            ? ` (אחוזון ${Math.round(bar.volumePercentile * 100)} בשנה האחרונה)`
            : "") +
          `, טווח ${bar.rangePercent.toFixed(1)}%, סגירה ב-${Math.round(bar.closePosition * 100)}% מהטווח.` +
          record,
        weight: 2.3,
        grade: null,
        at: stamp,
        href: `/company/${ticker}`,
      });
    }

    /* ---- The wire ----

       Only stories the feed screened as being ABOUT the company, which is
       what `getTickerCoverage` is for: a provider's "related" field is
       generous, and an alert that fires because a round-up mentioned the
       ticker in passing is the fastest way to teach somebody to filter
       these messages into a folder. */
    const coverage = await getTickerCoverage(ticker, 4).catch(() => null);
    const recent = (coverage?.articles ?? []).filter((a) => {
      const published = Date.parse(a.seenAt ?? "");
      return Number.isFinite(published) && Date.now() - published < 36 * 3600 * 1000;
    });
    for (const article of recent.slice(0, 2)) {
      findings.push({
        kind: "news",
        ticker,
        company: ticker,
        headline: `${ticker}: ${article.title}`,
        detail:
          /* The model's reading where the queue has already produced one,
             the publisher's own words otherwise. Never a summary this
             script invented out of the headline. */
          (article.analysis?.summary?.slice(0, 220) ||
            article.excerpt?.slice(0, 220) ||
            "") + ` · ${article.domain}`,
        weight: 2.25,
        grade: null,
        at: stamp,
        href: `/company/${ticker}`,
      });
    }
  }

  findings.sort((a, b) => b.weight - a.weight);

  await write({ builtAt: stamp, followed: followed.size, findings });

  console.log(`followed companies : ${followed.size}`);
  const byKind = (k: string) => findings.filter((f) => f.kind === k).length;
  console.log(
    `findings           : ${findings.length} ` +
      `(thesis ${byKind("thesis")}, catalyst ${byKind("catalyst")}, ` +
      `level ${byKind("level")}, tape ${byKind("tape")}, news ${byKind("news")})`,
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
