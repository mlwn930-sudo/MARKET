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
import { readSetup } from "../src/lib/analysis/setup";
import { generateJson } from "../src/lib/sources/gemini";
import { SETUP_SYSTEM } from "../src/lib/analysis/prompts";
import { getRanks } from "../src/lib/metrics/rank-store";
import type { SetupRead } from "../src/lib/analysis/setup";
import { getTickerCoverage } from "../src/lib/news-store";
import { baseRatesFor } from "../src/lib/metrics/base-rate-store";
import { analyseArticle } from "../src/lib/analysis/article";
import { readRelevance, type Relevance } from "../src/lib/alerts/relevance";
import type { Candle } from "../src/lib/sources/prices";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(ROOT, ".env.local"), quiet: true });

const OUT = resolve(ROOT, "content/watch/companies.json");

export type CompanyFinding = {
  kind: "thesis" | "catalyst" | "setup" | "news";
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
  /** How much this is worth the reader looking at, and why. Earned from
   *  what was measured — see lib/alerts/relevance.ts. */
  relevance: Relevance;
  relevanceWhy: string;
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

/** The volume percentile behind whichever tape observation the setup
 *  found, when it found one. Pulled out because the relevance tier wants
 *  it and the observation carries it only as prose. */
function tapeOf(setup: SetupRead): number | null {
  const bar = [...setup.observations, ...setup.tension].find((o) =>
    o.key.startsWith("tape-"),
  );
  if (!bar) return null;
  const match = bar.detail.match(/אחוזון (d+)/);
  return match ? Number(match[1]) / 100 : null;
}

/** Cut at a word, never through one. A headline that ends mid-word
 *  reads as a bug in the mail client rather than as an abbreviation. */
function trim(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return (space > limit * 0.6 ? cut.slice(0, space) : cut).trimEnd() + "…";
}

/* The thresholds that used to live here — how near a level counts as
   being at it, and how many turns a band needs before it is worth a
   message — moved into analysis/setup.ts with the logic that applies
   them. Two copies of one idea is how a panel and an email start
   describing different charts. */

/**
 * Charts only, for the frequent job.
 *
 * The expensive half of this script is reading articles: up to two model
 * calls per followed company, and the model budget is 600 a day shared
 * with everything else on the site. The chart half costs almost nothing —
 * the scan and the setup read are pure arithmetic over prices, and only a
 * company that actually converges spends a single call on the paragraph
 * that explains it.
 *
 * So the two halves can run at different speeds, which is the whole point:
 * the charts can be watched every quarter of an hour for free while the
 * wire keeps its slower cadence. See .github/workflows/watch-charts.yml.
 */
const CHARTS_ONLY = process.argv.includes("--charts-only");

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

  /* The nightly ranking, read once. A company page reads it per request;
     this reads it per run, because every followed company wants the same
     file. */
  const ranks = await getRanks().catch(() => null);

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
      /* A thesis that stopped holding is the most consequential thing this
         site can say about a company, and the grade the diff assigned is
         the honest ceiling on it: a change graded "possible" must not
         arrive wearing the badge of one graded "confirmed". */
      relevance:
        change.claim.grade === "confirmed" || change.claim.grade === "likely"
          ? "high"
          : "medium",
      relevanceWhy:
        change.claim.grade === "confirmed" || change.claim.grade === "likely"
          ? `שינוי בתזה בדרגת טענה ${change.claim.grade === "confirmed" ? "מאושרת" : "סבירה"} · מהותיות ${Math.round(change.materiality)}`
          : `שינוי בתזה, אבל דרגת הטענה היא ${change.claim.grade ?? "לא מדורגת"} — לא עובדה`,
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
      /* A date that has not happened is a thing to prepare for, never a
         thing that happened. Reported, and not claiming a tier the
         calendar cannot support. */
      relevance: "medium",
      relevanceWhy: "מועד מתוזמן שטרם התרחש — תזכורת, לא ממצא",
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

    /* ---- Is this chart doing anything, and what ----

       One read instead of two loose triggers. The agent used to fire on
       any session that was not ordinary and any price near any level,
       which on a two-company watchlist is a handful of messages a week
       about nothing in particular — and the honest description of that is
       noise. The reader stops opening them, and the one that mattered
       arrives into an inbox that has learned to ignore it.

       `readSetup` counts how many INDEPENDENT measured families are true
       at once — trend, level, volume, rank, contraction — and reports the
       ones pointing the other way separately. Below three families this
       stays silent, because what is on the chart is a fact rather than a
       situation. */
    const rates = await baseRatesFor(ticker).catch(() => null);
    const setup = readSetup(ticker, candles, rates, ranks?.reads[ticker] ?? null);

    if (setup.worthWatching) {
      /* The facts are assembled in code; the model is asked only to join
         them into something a person reads in ten seconds. It cannot
         invent a level or a percentage because it is computing none of
         them — the same division of labour the daily brief uses, and the
         only arrangement under which a model belongs near an alert.

         When it is unavailable the finding still goes out, carrying the
         observations as a list. A reading nobody wrote is better than no
         alert about a chart four measured conditions just converged on. */
      const lines = [...setup.observations, ...setup.tension]
        .map((o) => {
          const record = o.record
            ? ` · בעשר שנים ${o.record.occurrences} מופעים, חודש אחרי ${Math.round(o.record.upRate * 100)}% מול בסיס ${Math.round(o.record.baselineRate * 100)}%${Math.abs(o.record.liftPp) < 10 ? " — התנאי לא הוסיף מידע" : ""}`
            : "";
          return `- ${o.label} (${o.detail})${record}`;
        })
        .join("\n");

      const written = await generateJson<{
        headline?: string;
        body?: string;
        watch?: string;
      }>({
        system: SETUP_SYSTEM,
        prompt: `נייר: ${ticker}\nנכון ל: ${setup.asOf}\nתצפיות שהתכנסו (${setup.convergence} משפחות: ${setup.families.join(", ")}):\n${lines}`,
        temperature: 0.3,
        maxOutputTokens: 700,
      }).catch(() => null);

      const measured = [...setup.observations, ...setup.tension].filter(
        (o) => o.record !== null,
      );
      const best = measured.sort(
        (a, b) => Math.abs(b.record!.liftPp) - Math.abs(a.record!.liftPp),
      )[0];

      const rated = readRelevance({
        occurrences: best?.record?.occurrences ?? null,
        sessions: rates?.sessions ?? null,
        liftPp: best?.record?.liftPp ?? null,
        sampleSize: best?.record?.sample ?? null,
        volumePercentile: tapeOf(setup) ?? null,
      });

      findings.push({
        kind: "setup",
        ticker,
        company: ticker,
        headline: `${ticker}: ${written?.headline ?? `${setup.convergence} תנאים נמדדים נכונים בו-זמנית`}`,
        detail:
          (written?.body ? `${written.body}\n\n` : "") +
          lines +
          (setup.tension.length
            ? `\n\nמה שמושך לכיוון השני: ${setup.tension.map((o) => o.label).join(" · ")}`
            : "") +
          (written?.watch ? `\n\nמה אפשר לראות בהמשך: ${written.watch}` : ""),
        weight: 2.4 + setup.convergence / 10,
        grade: null,
        relevance: rated.level,
        relevanceWhy:
          `${setup.convergence} משפחות נמדדות נכונות בו-זמנית (${setup.families.join(", ")})` +
          (rated.why ? ` · ${rated.why}` : ""),
        at: stamp,
        href: `/company/${ticker}`,
      });
    } else {
      /* Two different silences, and they must not read the same. Below
         the family threshold is "there is nothing here"; at the threshold
         with no measured record is "there is something here and the site
         has never counted what it was worth" — which is a gap in the
         measurement, not a quiet chart. */
      const measured = [...setup.observations, ...setup.tension].some(
        (o) => o.record !== null,
      );
      console.log(
        `  ${ticker}: ${setup.convergence} משפחות` +
          (setup.convergence < 3
            ? " — מתחת לסף ההתכנסות, לא נשלח"
            : measured
              ? " — לא נשלח"
              : " — התכנסו, אבל אף תצפית לא נמדדה על הנייר הזה, לא נשלח"),
      );
    }


    if (CHARTS_ONLY) continue;

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
      /* THE STORY IS READ BEFORE IT IS SENT, NOT AFTER.
       *
       * An English headline and a domain is not an alert, it is a
       * forwarded link — and it leaves the reader to do the one piece of
       * work the site exists to do for them. So where the queue has not
       * already read this article, the agent reads it now, in Hebrew,
       * through the same three lenses and the same prompt the site uses.
       * Two readings of one story that disagree would be worse than one
       * late reading, which is why this calls the shared analyser rather
       * than writing its own.
       *
       * It is allowed to fail. A paywall, a bot wall or a model that is
       * out of quota leaves the story unread, and an unread story is not
       * mailed at all — a headline with nothing under it is exactly what
       * this block exists to stop sending. */
      let reading = article.analysis ?? null;
      if (!reading) {
        reading = await analyseArticle(article.url, article.title).catch(
          () => null,
        );
      }
      if (!reading) {
        console.log(`  ${ticker}: skipped an unreadable story`);
        continue;
      }

      /* The relevance comes from that reading rather than from a weight
         this script chose: `catalystKind` is the model saying whether the
         story changes anything, and `significance` is how far it reaches.
         Using them means the tier in the inbox and the badge on the site
         cannot disagree about the same article. */
      const rated = readRelevance({
        catalystKind: reading.catalystKind ?? null,
        significance: reading.significance ?? null,
        catalystNote: reading.catalyst ?? null,
      });

      findings.push({
        kind: "news",
        ticker,
        company: ticker,
        /* Hebrew leads. The original headline is kept after it, because a
           reader following a link wants to recognise what they are
           opening. */
        headline: `${ticker}: ${trim(reading.summary, 120)}`,
        detail:
          `${reading.impact}` +
          (reading.reaction ? `\n\nתגובת מחיר: ${reading.reaction}` : "") +
          (reading.chain ? `\n\nשרשרת הערך: ${reading.chain}` : "") +
          `\n\nהכותרת במקור: ${article.title} · ${article.domain}`,
        weight: 2.25,
        grade: null,
        relevance: rated.level,
        relevanceWhy: rated.why,
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
