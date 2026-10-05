/**
 * The watcher.
 *
 * It runs on a schedule and asks one question: what is worth knowing that
 * was not worth knowing last time it ran. The answer goes to
 * content/watch/latest.json, which the site reads — so the site has
 * something new to show whether or not anybody was looking when it
 * happened.
 *
 * WHAT IT IS NOT. It is not a continuous process. Nothing here runs 24/7,
 * because nothing in this project is allowed to cost money and a process
 * that never sleeps is a server. What exists instead is a scheduled run:
 * GitHub Actions every half hour during market hours, twice a day
 * otherwise. The practical difference is latency, and it is stated on the
 * page rather than hidden — a watcher that implies it is always awake is
 * lying about how fresh its findings are.
 *
 * WHAT IT DOES NOT DO. It does not score, rank by attractiveness, or
 * recommend. Every finding is an observation with the figure that produced
 * it attached, and the reader decides what it means (CLAUDE.md rule 8).
 * Nothing here calls a model either: every finding below is arithmetic
 * over data the project already holds, which is what makes it free to run
 * as often as the schedule allows.
 *
 * Run with:  npm run watch
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { UNIVERSE } from "../src/lib/universe";
import { upcomingEvents } from "../src/lib/analysis/known-events";
import { runScreen } from "../src/lib/screener";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(ROOT, ".env.local"), quiet: true });

const OUT = resolve(ROOT, "content/watch/latest.json");
const NEWS = resolve(ROOT, "content/news/latest.json");
const SUMMARIES = resolve(ROOT, "content/news/summaries.json");

const SPARK = "https://query1.finance.yahoo.com/v7/finance/spark";
const HEADERS = {
  "User-Agent": "MarketIntel/1.0 (personal research; mlwn930@gmail.com)",
};

/** Sixteen per request — measured against the live endpoint, where twenty
 *  answer 200 and twenty-five answer 400. */
const CHUNK = 16;

export type Finding = {
  kind: "move" | "range" | "event" | "story" | "opportunity";
  ticker: string | null;
  headline: string;
  /** The figure that produced the finding, already formatted. Nothing here
   *  is asserted without the number it came from. */
  detail: string;
  /** How far outside normal, where that is measurable. Used for ordering
   *  only — it is never shown as a score. */
  weight: number;
  href: string | null;
  at: string;
};

type Bar = { t: number; c: number };

/**
 * One chunk of symbols, retried.
 *
 * This ran once and threw, and the workflow step that calls it is marked
 * `continue-on-error` so that a scan which cannot reach Yahoo does not
 * fail the whole news job. Both decisions are defensible and together
 * they hid a real outage: the scanner has never once written from CI
 * since the day it shipped, the step went green every half hour, and the
 * site served a three-day-old scan under a line reading "scanned 72 hours
 * ago".
 *
 * Yahoo throttles datacentre addresses far harder than home ones, which
 * is exactly the difference between a laptop where this always works and
 * a GitHub runner where it does not. A 429 is also the most recoverable
 * error there is, so the thing to do with it is wait rather than give up
 * on the whole scan.
 */
async function sparkChunk(symbols: string[]) {
  const url =
    `${SPARK}?symbols=${symbols.map(encodeURIComponent).join(",")}` +
    `&range=3mo&interval=1d&includePrePost=false`;

  let res: Response | null = null;
  let lastError = "";

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      /* 1s, 4s, 9s. A throttle lifts on its own; hammering it does not
         help and a fixed short retry is the same request three times. */
      await new Promise((r) => setTimeout(r, attempt * attempt * 1000));
    }
    try {
      res = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(25_000),
      });
      if (res.ok) break;
      lastError = `spark ${res.status}`;
      /* Anything that is not a throttle or a gateway hiccup will return
         the same answer however long we wait. */
      if (res.status !== 429 && res.status < 500) throw new Error(lastError);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt === 3) throw new Error(lastError);
    }
  }

  if (!res || !res.ok) throw new Error(lastError || "spark failed");
  const rows = (await res.json())?.spark?.result ?? [];
  const out: Record<string, { bars: Bar[]; last: number; prev: number | null }> =
    {};
  for (const row of rows) {
    const r = row.response?.[0];
    const meta = r?.meta;
    const symbol = (row.symbol ?? meta?.symbol ?? "").toUpperCase();
    if (!symbol || typeof meta?.regularMarketPrice !== "number") continue;
    const ts: number[] = r.timestamp ?? [];
    const cl: (number | null)[] = r.indicators?.quote?.[0]?.close ?? [];
    const bars: Bar[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = cl[i];
      if (c != null && Number.isFinite(c)) bars.push({ t: ts[i], c });
    }
    out[symbol] = {
      bars,
      last: meta.regularMarketPrice,
      prev: meta.chartPreviousClose ?? null,
    };
  }
  return out;
}

/**
 * A day's move, measured against how much this company normally moves.
 *
 * A flat 5% rule flags a biotech every week and a utility never. What
 * matters is whether today is unusual *for this name*, so the move is
 * divided by the standard deviation of its own daily moves over the
 * quarter. Two is the line: by the ordinary definition of a tail, a move
 * that size happens on about one day in twenty.
 */
function unusualMove(bars: Bar[]): { pct: number; sigmas: number } | null {
  if (bars.length < 12) return null;
  const rets: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].c;
    if (prev > 0) rets.push((bars[i].c - prev) / prev);
  }
  if (rets.length < 10) return null;
  const today = rets[rets.length - 1];
  const history = rets.slice(0, -1);
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const variance =
    history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length;
  const sd = Math.sqrt(variance);
  if (!Number.isFinite(sd) || sd <= 0) return null;
  const sigmas = Math.abs(today - mean) / sd;
  return { pct: today * 100, sigmas };
}

/** Where the last close sits inside its own range. Only the ends are
 *  reported: the middle of a range is not news.
 *
 *  Three months, not one. At one month this fired for 46 of 123 companies
 *  in a rallying market, which is not a finding — it is a description of
 *  the market, and a watcher that reports it 46 times has stopped
 *  distinguishing anything. A quarter is long enough that the edge means
 *  something happened. */
function atRangeEdge(bars: Bar[]): { where: "high" | "low"; pct: number } | null {
  if (bars.length < 15) return null;
  const closes = bars.map((b) => b.c);
  const hi = Math.max(...closes);
  const lo = Math.min(...closes);
  if (hi <= lo) return null;
  const last = closes[closes.length - 1];
  const position = (last - lo) / (hi - lo);
  if (position >= 0.99) return { where: "high", pct: position * 100 };
  if (position <= 0.01) return { where: "low", pct: position * 100 };
  return null;
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function main() {
  const stamp = new Date().toISOString();
  const findings: Finding[] = [];

  /* ---- What the tape did ---- */
  const symbols = UNIVERSE.map((c) => c.ticker);
  const data: Record<string, { bars: Bar[]; last: number; prev: number | null }> =
    {};
  for (let i = 0; i < symbols.length; i += CHUNK) {
    try {
      Object.assign(data, await sparkChunk(symbols.slice(i, i + CHUNK)));
    } catch (err) {
      console.log(`  chunk ${i / CHUNK}: ${(err as Error).message}`);
    }
  }
  console.log(`prices: ${Object.keys(data).length}/${symbols.length}`);

  for (const [ticker, row] of Object.entries(data)) {
    const move = unusualMove(row.bars);
    if (move && move.sigmas >= 2) {
      findings.push({
        kind: "move",
        ticker,
        headline: `${ticker} זזה ${move.pct >= 0 ? "למעלה" : "למטה"} הרבה מעבר לרגיל שלה`,
        detail:
          `${move.pct.toFixed(2)}% ביום — פי ${move.sigmas.toFixed(1)} ` +
          `מסטיית התקן היומית שלה ברבעון האחרון`,
        weight: move.sigmas,
        href: `/company/${ticker}`,
        at: stamp,
      });
    }
    const edge = atRangeEdge(row.bars);
    if (edge) {
      findings.push({
        kind: "range",
        ticker,
        headline: `${ticker} ב${edge.where === "high" ? "שיא" : "שפל"} של רבעון`,
        detail:
          `הסגירה האחרונה ${row.last.toFixed(2)} היא ה${edge.where === "high" ? "גבוהה" : "נמוכה"} ` +
          `ביותר מתוך ${row.bars.length} ימי מסחר ברבעון`,
        weight: 1.8,
        href: `/company/${ticker}`,
        at: stamp,
      });
    }
  }

  /* ---- Where quality met a dislocation ----
   *
   * "Opportunity" is the word that most invites a site like this to start
   * recommending, so it is defined narrowly and mechanically: a company
   * that passes most of the screener's tests AND has just moved unusually
   * against itself or sits at the bottom of its own quarter. Neither half
   * is interesting alone — a good business at an ordinary price is not
   * news, and a falling price with nothing behind it is just a falling
   * price. The conjunction is rare, which is the point: it fires a handful
   * of times a month rather than every day.
   *
   * It still asserts nothing about what to do. The finding names the score,
   * the move and where to check them, and stops there (rule 8). */
  try {
    const { results } = await runScreen();
    const byTicker = new Map(results.map((r) => [r.company.ticker, r]));

    for (const [ticker, row] of Object.entries(data)) {
      const screened = byTicker.get(ticker);
      if (!screened || screened.evaluatedCount < 6) continue;
      /* Most of what could be computed, not most of ten: a company whose
         filings only support six tests is judged on its six. */
      if (screened.score / screened.evaluatedCount < 0.75) continue;

      const move = unusualMove(row.bars);
      const edge = atRangeEdge(row.bars);
      const fell = move && move.sigmas >= 2 && move.pct < 0;
      const low = edge?.where === "low";
      if (!fell && !low) continue;

      findings.push({
        kind: "opportunity",
        ticker,
        headline: `${ticker} עוברת ${screened.score} מתוך ${screened.evaluatedCount} המבחנים, ו${fell ? "ירדה חזק" : "בשפל של רבעון"}`,
        detail: fell
          ? `${move!.pct.toFixed(2)}% ביום — פי ${move!.sigmas.toFixed(1)} מסטיית התקן הרבעונית שלה, על חברה שעוברת רוב המבחנים שניתן היה לחשב`
          : `הסגירה ${row.last.toFixed(2)} היא הנמוכה ביותר ברבעון, על חברה שעוברת ${screened.score} מתוך ${screened.evaluatedCount} המבחנים`,
        weight: 2.6 + (fell ? move!.sigmas / 10 : 0),
        href: `/company/${ticker}`,
        at: stamp,
      });
    }
  } catch (err) {
    /* The screener reads a committed file; if it is missing this run simply
       has no opportunity findings, which is different from having none. */
    console.log(`  screener unavailable: ${(err as Error).message}`);
  }

  /* ---- What is already on the calendar ---- */
  const soon = upcomingEvents().filter((e) => {
    if (!e.date) return false;
    const days = (new Date(e.date).getTime() - Date.now()) / 86_400_000;
    return days >= 0 && days <= 21;
  });
  for (const event of soon) {
    const days = Math.ceil(
      (new Date(event.date!).getTime() - Date.now()) / 86_400_000,
    );
    findings.push({
      kind: "event",
      ticker: event.ticker,
      headline: `${event.title} — בעוד ${days} ימים`,
      detail:
        event.status === "confirmed"
          ? `תאריך שהחברה אישרה: ${event.date}`
          : `מועד שהחברה ציינה: ${event.window ?? event.date}`,
      weight: 2.4 - days / 40,
      href: `/company/${event.ticker}`,
      at: stamp,
    });
  }

  /* ---- What was written, that the reading called consequential ---- */
  const feed = await readJson<{ sectors?: { articles?: Record<string, unknown>[] }[] }>(
    NEWS,
    {},
  );
  const summaries = await readJson<{ summaries?: Record<string, { significance?: string; catalystKind?: string; summary?: string; tickers?: string[] }> }>(
    SUMMARIES,
    {},
  );
  const written = summaries.summaries ?? {};
  const DAY = 24 * 3600 * 1000;
  for (const sector of feed.sectors ?? []) {
    for (const article of sector.articles ?? []) {
      const url = String((article as { url?: string }).url ?? "");
      const seenAt = String((article as { seenAt?: string }).seenAt ?? "");
      const title = String((article as { title?: string }).title ?? "");
      if (!url || !seenAt) continue;
      if (Date.now() - new Date(seenAt).getTime() > DAY) continue;
      const read = written[url];
      if (!read || read.significance !== "high") continue;
      findings.push({
        kind: "story",
        ticker: read.tickers?.[0] ?? null,
        headline: title.slice(0, 140),
        detail: (read.summary ?? "").slice(0, 190),
        weight: 2.2,
        href: url,
        at: seenAt,
      });
    }
  }

  findings.sort((a, b) => b.weight - a.weight);

  /* Everything found is kept in the file; the page decides how much to
     show. A watcher that truncates at the source cannot be asked later
     what it saw and chose not to print. */
  const payload = {
    builtAt: stamp,
    universe: symbols.length,
    priced: Object.keys(data).length,
    counts: {
      move: findings.filter((f) => f.kind === "move").length,
      opportunity: findings.filter((f) => f.kind === "opportunity").length,
      range: findings.filter((f) => f.kind === "range").length,
      event: findings.filter((f) => f.kind === "event").length,
      story: findings.filter((f) => f.kind === "story").length,
    },
    findings,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 2), "utf8");

  console.log(`wrote ${OUT}`);
  console.log(
    `${findings.length} findings — ` +
      Object.entries(payload.counts)
        .map(([k, v]) => `${k}:${v}`)
        .join(" "),
  );
}

main();
