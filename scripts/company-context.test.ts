import test from "node:test";
import assert from "node:assert/strict";
import {
  searchCalendar,
  calendarWasTruncated,
  type CalendarReader,
  type EarningsDate,
} from "../src/lib/sources/finnhub";
import { isAbout } from "../src/lib/watchlist-news";
import { callsItSuccess, tooLong } from "../src/lib/analysis/chart-evidence";
import type { WatchArticle } from "../src/lib/watchlist-news";

/**
 * The two ways the company context used to lie, pinned.
 *
 * Both were measured on live data before they were fixed, and both were
 * silent: the site printed a confident sentence and nothing anywhere
 * reported a failure. That is the category of bug a test exists for.
 *
 *   1. The earnings calendar caps its reply at 1,500 rows and does not
 *      say so. A window wide enough to be useful loses its tail, and the
 *      search walked past it — TTWO's next report was 23 days out and
 *      the site said 112, because the nearer date had been cut from a
 *      window the search then considered answered.
 *
 *   2. A company's wire carries other companies' stories. Of 47
 *      analysed, non-noise stories reaching four companies' feeds,
 *      25 were about somebody else — and once that list started feeding
 *      the chart reader, another company's dated catalyst was being
 *      printed as this company's reason to move.
 */

/* ------------------------------------------------------------------ */
/* The calendar: a cut reply is not an answer                          */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000;
const START = Date.UTC(2026, 9, 11); // 2026-10-11

function entry(symbol: string, date: string): EarningsDate {
  return { symbol, date, hour: "amc", epsEstimate: null, revenueEstimate: null };
}

/**
 * A calendar that holds one date and cuts any window wider than
 * `capAbove` days — which is how the real endpoint behaves, and the only
 * part of it worth staging.
 */
function staged(
  symbol: string,
  date: string,
  capAbove: number,
): { read: CalendarReader; calls: string[] } {
  const calls: string[] = [];
  const read: CalendarReader = async (from, to) => {
    calls.push(`${from}..${to}`);
    const days = (Date.parse(to) - Date.parse(from)) / DAY;
    const truncated = days > capAbove;
    const inside = date >= from && date <= to;
    const bySymbol = new Map<string, EarningsDate>();
    /* The cap removes the tail, so a date inside a cut window is only
       returned when the window was narrow enough to survive. */
    if (inside && !truncated) bySymbol.set(symbol, entry(symbol, date));
    return { bySymbol, truncated, failed: false };
  };
  return { read, calls };
}

test("a date inside a window that came back whole is returned", async () => {
  const { read } = staged("TTWO", "2026-11-04", 40);
  const hit = await searchCalendar("TTWO", START, START + 40 * DAY, [10, 3], read);
  assert.equal(hit?.date, "2026-11-04");
});

test("a date cut from a capped window is still found by narrowing", async () => {
  /* The measured failure: the 40-day window is capped and loses the date,
     and the old code concluded the company does not report in it. */
  const { read, calls } = staged("TTWO", "2026-11-04", 14);
  const hit = await searchCalendar("TTWO", START, START + 40 * DAY, [10, 3], read);
  assert.equal(hit?.date, "2026-11-04");
  assert.ok(calls.length > 1, "a capped window must be narrowed, not accepted");
});

test("narrowing goes two rungs deep when the first rung is still capped", async () => {
  const { read } = staged("NVDA", "2026-11-17", 5);
  const hit = await searchCalendar("NVDA", START, START + 40 * DAY, [10, 3], read);
  assert.equal(hit?.date, "2026-11-17");
});

test("narrowing returns the nearest date, not the first one found", async () => {
  /* Two reports inside one window. Walking the slices in order is what
     makes the answer the next report rather than a later one, and a
     reversed walk would pass every other test in this file. */
  const calls: string[] = [];
  const read: CalendarReader = async (from, to) => {
    calls.push(`${from}..${to}`);
    const days = (Date.parse(to) - Date.parse(from)) / DAY;
    const truncated = days > 14;
    const bySymbol = new Map<string, EarningsDate>();
    if (!truncated) {
      /* Whichever of the two falls in this slice; the earlier one wins
         when both do, which is what getEarningsCalendar does. */
      for (const date of ["2026-11-04", "2026-11-20"]) {
        if (date >= from && date <= to) {
          bySymbol.set("TTWO", entry("TTWO", date));
          break;
        }
      }
    }
    return { bySymbol, truncated, failed: false };
  };

  const hit = await searchCalendar("TTWO", START, START + 40 * DAY, [10, 3], read);
  assert.equal(hit?.date, "2026-11-04");
});

test("a window that came back whole and empty is an answer, and is not narrowed", async () => {
  const calls: string[] = [];
  const read: CalendarReader = async (from, to) => {
    calls.push(`${from}..${to}`);
    return { bySymbol: new Map(), truncated: false, failed: false };
  };
  const hit = await searchCalendar("TTWO", START, START + 40 * DAY, [10, 3], read);
  assert.equal(hit, null);
  assert.equal(calls.length, 1, "a complete reply must not be re-asked in slices");
});

test("a failed request is abandoned rather than narrowed", async () => {
  /* Narrowing an outage turns one failing request into twenty failing
     the same way. The caller gets no date, which is already how every
     call site reads an absence. */
  const calls: string[] = [];
  const read: CalendarReader = async (from, to) => {
    calls.push(`${from}..${to}`);
    return { bySymbol: new Map(), truncated: false, failed: true };
  };
  const hit = await searchCalendar("TTWO", START, START + 40 * DAY, [10, 3], read);
  assert.equal(hit, null);
  assert.equal(calls.length, 1);
});

test("the cap is recognised at exactly the cap", async () => {
  assert.equal(calendarWasTruncated(1499), false);
  assert.equal(calendarWasTruncated(1500), true);
  assert.equal(calendarWasTruncated(1501), true);
});

/* ------------------------------------------------------------------ */
/* The wire: a story on a company's feed is not a story about it        */
/* ------------------------------------------------------------------ */

function article(
  title: string,
  summary: string,
  tickers: string[] | null,
): WatchArticle {
  return {
    url: `https://example.com/${encodeURIComponent(title)}`,
    title,
    source: "test",
    summary,
    at: "2026-10-11T00:00:00.000Z",
    analysis:
      tickers === null
        ? null
        : {
            summary: "",
            impact: "",
            tickers,
            significance: "medium",
          },
  } as WatchArticle;
}

test("the model naming the company is enough on its own", async () => {
  /* The reading was produced by reading the article, and that IS the
     corroboration — the words of a headline need not repeat it. */
  const a = article("Why This Gaming Giant Just Popped", "No name here.", ["TTWO"]);
  assert.equal(isAbout("TTWO", a), true);
});

test("the company's own name in the words is enough on its own", async () => {
  const a = article("Is Now a Good Time to Buy Take-Two Stock?", "", null);
  assert.equal(isAbout("TTWO", a), true);
});

test("another company's story on this company's wire is dropped", async () => {
  /* The measured case. This arrived on TTWO's feed with its catalyst
     written about Fastly, and reached the chart reader as what was
     happening at Take-Two. */
  const a = article(
    "How AI Agent Traffic Is Driving Fastly's Next Growth Wave",
    "An analyst upgrade on Fastly points to a new growth engine.",
    ["FSLY"],
  );
  assert.equal(isAbout("TTWO", a), false);
});

test("a macro story with no company named is dropped", async () => {
  const a = article(
    "10 Words From the Fed Chair That Could Reshape Market Expectations",
    "Rates, and what the chair said about them.",
    [],
  );
  assert.equal(isAbout("TTWO", a), false);
});

test("a story covering two companies reaches both of them", async () => {
  /* Deliberately kept. The reading is written per article and holds both
     catalysts in one paragraph, which cannot be split in the data — so
     the story stays and the panel and the prompt both say the headline
     is the way to tell whose it was. */
  const a = article(
    "GameStop Rises 4% but Stays Far Below Its Warrant Strike; Take-Two Interactive Eyes GTA VI",
    "",
    ["GME", "TTWO"],
  );
  assert.equal(isAbout("TTWO", a), true);
  assert.equal(isAbout("GME", a), true);
  assert.equal(isAbout("NVDA", a), false);
});

/* ------------------------------------------------------------------ */
/* A base rate is not a success rate                                   */
/* ------------------------------------------------------------------ */

test("an answer calling a base rate a success rate is rejected", () => {
  /* Measured: the prompt forbade the exact phrase "שיעור הצלחה" and the
     model answered "70% הצלחה" — obeying the letter and breaking the
     point. The figure counts sessions that closed higher; there was no
     entry, no exit and no position, so nobody succeeded at anything. */
  assert.ok(callsItSuccess("הרשומה מראה 70% הצלחה מול בסיס של 55%"));
  assert.ok(callsItSuccess("שיעור הצלחה של 70%"));
  assert.ok(callsItSuccess("אחוז הצלחה גבוה"));
  assert.ok(callsItSuccess("הצלחה ב-70% מהמקרים"));
});

test("the accepted phrasing passes, and so does ordinary prose", () => {
  assert.equal(
    callsItSuccess("70% סגרו גבוה יותר מול בסיס 55%, על 54 מופעים"),
    null,
  );
  /* A launch succeeding is a fact about a company, not a mislabelled
     rate. The digit has to be near the word for the guard to fire, so
     prose like this is left alone — a blanket ban on the word would be
     wrong in eight of this project's nine prompts. */
  assert.equal(
    callsItSuccess("ההשקה של המשחק נחשבת הצלחה גדולה לחברה בשנה שעברה"),
    null,
  );
  assert.equal(callsItSuccess("אין כאן תנאי נמדד שפעל"), null);
});

test("a runaway answer is rejected, a normal one is not", () => {
  /* The backstop under the five-sentence ceiling. It fires at ten, not
     six: spending a retry on a borderline answer risks the whole reply
     on a model that keeps landing one sentence over. Measured drift
     without it — 80 words when the rule landed, 115 two block sections
     later, with the rule unchanged. */
  const normal =
    "הנייר נוטה למעלה. התנאי פעל בנר האחרון, 70% סגרו גבוה יותר מול בסיס 55%. " +
    "הירידה החציונית בדרך הייתה 5.8%. המסקנה תופרך בתום האופק.";
  assert.equal(tooLong(normal), null);

  const runaway = Array.from(
    { length: 12 },
    (_, i) => `משפט מספר ${i + 1} שמסכם עוד שורה מהבלוק.`,
  ).join(" ");
  assert.ok(tooLong(runaway));
});

test("a decimal is not a sentence boundary", () => {
  /* "5.8%" would otherwise count as two sentences, and an answer full of
     measured figures would be rejected for being measured. */
  const decimals =
    "הסטופ ב-187.42 והירידה החציונית 5.8%. היעד החציוני 206.20 מול בסיס 2.1%.";
  assert.equal(tooLong(decimals), null);
});
