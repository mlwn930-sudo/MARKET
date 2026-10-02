/**
 * The Tel Aviv Stock Exchange.
 *
 * Finnhub's free tier does not carry TASE at all, so this reads the same
 * Yahoo chart endpoint the US price history uses. That keeps the project
 * inside its zero-cost rule and means one less provider to keep working.
 *
 * Two things about Israeli market data are traps, and both are handled
 * here rather than in a page:
 *
 *   Prices come in agorot. Yahoo reports TASE equities with currency
 *   "ILA" — 12050 means ₪120.50. A page that prints the raw figure shows a
 *   share of Teva at twelve thousand shekels. Indices come in ILS and are
 *   left alone. The conversion happens once, at the source, and everything
 *   downstream receives shekels.
 *
 *   The symbols are not obvious. TA-125 is "^TA125.TA" with a caret and
 *   TA-35 is "TA35.TA" without one — measured, not guessed: the caret form
 *   of TA-35 returns 404. They are written down here so nobody has to
 *   rediscover that.
 *
 * The exchange trades Sunday to Thursday, which no US-market clock in this
 * project knows about. `taseSession()` answers that question separately.
 */

import { unstable_cache } from "next/cache";

const CHART = "https://query1.finance.yahoo.com/v8/finance/chart";

export type TaseQuote = {
  /** The Yahoo symbol, e.g. "TEVA.TA". */
  symbol: string;
  /** The label the site shows. Hebrew for the curated list. */
  name: string;
  /** In shekels. Agorot are converted here and nowhere else. */
  price: number | null;
  changePercent: number | null;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  volume: number | null;
  /**
   * The window's typical daily turnover, for comparing today's against.
   *
   * A volume of 1.2M on its own is the thing rule 5 of this project
   * forbids: a figure with nothing to measure it against. Against its own
   * month it becomes a sentence — a third of normal, or twice it.
   *
   * Computed from the completed sessions only. The current bar is partial
   * for most of the day, and averaging it in drags the baseline down by
   * however much of the session is still ahead.
   */
  averageVolume: number | null;
  /**
   * The daily closes in the window, oldest first, in shekels.
   *
   * Here so the page can draw the shape of the month beside the price.
   * A row that says "+1.2%" and a row that says "+1.2% after falling for
   * three weeks" are different facts, and the second one is the one a
   * medium-term reader came for.
   */
  closes: number[];
  /** First close in the window to the last, as a percentage. */
  windowChangePercent: number | null;
  /** How many sessions that change covers. Printed, never assumed. */
  windowSessions: number;
  /** True for an index: no agora conversion, and no volume worth showing. */
  isIndex: boolean;
  /** ISO string, not a Date.
   *
   *  The board is held in unstable_cache, which serialises to JSON — a
   *  Date goes in and a string comes out, and code that checks
   *  `instanceof Date` on the way out silently drops every timestamp. That
   *  is exactly what made the session fall back to the weekday rule. */
  at: string | null;
};

/* ------------------------------------------------------------------ */
/* The universe                                                        */
/* ------------------------------------------------------------------ */

export { TASE_INDICES, TASE_LEADERS } from "@/lib/tase-universe";

import { TASE_INDICES, TASE_LEADERS } from "@/lib/tase-universe";

/* ------------------------------------------------------------------ */
/* Fetching                                                            */
/* ------------------------------------------------------------------ */

type YahooMeta = {
  currency?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  chartPreviousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  regularMarketVolume?: number;
  regularMarketTime?: number;
  shortName?: string;
  longName?: string;
};

async function fetchOne(
  symbol: string,
  label: string,
  isIndex: boolean,
): Promise<TaseQuote | null> {
  try {
    const res = await fetch(
      /* A month rather than a week.
         The window used to be five days, which is enough to recover the
         day's move when the session is shut and nothing more. A month of
         daily bars costs the same single request and pays for three things
         the page could not show before: the shape of the trend beside the
         price, a change over a stated number of sessions, and a turnover
         baseline to measure today's volume against. */
      `${CHART}/${encodeURIComponent(symbol)}?range=1mo&interval=1d`,
      {
        headers: { "User-Agent": "MarketIntel/1.0 (personal research; mlwn930@gmail.com)" },
        next: { revalidate: 120 },
      },
    );
    if (!res.ok) return null;

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const meta: YahooMeta | undefined = result?.meta;
    if (!meta || meta.regularMarketPrice === undefined) return null;

    /**
     * The change, computed rather than read, when the session is shut.
     *
     * Yahoo reports regularMarketChangePercent as exactly 0 outside
     * trading hours — which on a Friday evening in Tel Aviv means every
     * row on the page reads 0.00% and the market looks frozen rather than
     * closed. The last two daily closes give the move of the session that
     * actually happened, which is what a reader on a weekend wants.
     */
    const raw: number[] = (result?.indicators?.quote?.[0]?.close ?? []).filter(
      (value: unknown): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );

    const fromMeta = meta.regularMarketChangePercent;
    const derived =
      raw.length >= 2
        ? ((raw[raw.length - 1] - raw[raw.length - 2]) / raw[raw.length - 2]) * 100
        : null;

    const changePercent =
      fromMeta !== undefined && Number.isFinite(fromMeta) && fromMeta !== 0
        ? fromMeta
        : derived;

    // ILA is agorot. Everything leaving this function is shekels.
    const divisor = meta.currency === "ILA" ? 100 : 1;
    const shekels = (value: number | undefined) =>
      value === undefined || !Number.isFinite(value) ? null : value / divisor;

    /* The closes a page may draw, in the same unit as the price beside
       them. A sparkline of agorot under a shekel figure is a chart of a
       different instrument. */
    const closes = raw.map((value) => value / divisor);

    const windowChangePercent =
      closes.length >= 2 && closes[0] !== 0
        ? ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100
        : null;

    /* Turnover, averaged over the sessions that finished.
       The volume array runs parallel to the close array, so the last entry
       belongs to the bar in progress; it is dropped rather than averaged
       in, because a half-finished session would pull the baseline below
       every full one and make an ordinary day look busy. */
    const volumes: number[] = (result?.indicators?.quote?.[0]?.volume ?? []).filter(
      (value: unknown): value is number =>
        typeof value === "number" && Number.isFinite(value) && value > 0,
    );
    const completed = volumes.slice(0, -1);
    const averageVolume =
      isIndex || completed.length === 0
        ? null
        : completed.reduce((total, value) => total + value, 0) / completed.length;

    return {
      symbol,
      name: label,
      price: shekels(meta.regularMarketPrice),
      changePercent,
      /* The previous close, taken from the window rather than from
         `chartPreviousClose`. That field means "the close before the range
         started", which with a month-long range is the close before the
         month — a month-old price under the label "previous close" is a
         wrong number, and the mistake is invisible because it is still a
         plausible one. */
      previousClose:
        closes.length >= 2
          ? closes[closes.length - 2]
          : shekels(meta.chartPreviousClose),
      dayHigh: shekels(meta.regularMarketDayHigh),
      dayLow: shekels(meta.regularMarketDayLow),
      yearHigh: shekels(meta.fiftyTwoWeekHigh),
      yearLow: shekels(meta.fiftyTwoWeekLow),
      volume: isIndex ? null : (meta.regularMarketVolume ?? null),
      averageVolume,
      closes,
      windowChangePercent,
      windowSessions: Math.max(closes.length - 1, 0),
      isIndex,
      at: meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : null,
    };
  } catch {
    // A symbol that fails comes back null and the row says so. The page
    // never invents a price for a market that did not answer.
    return null;
  }
}

/**
 * Quotes for a list of TASE symbols.
 *
 * Batched the way the Finnhub helper is, and for the same reason: Yahoo is
 * an undocumented endpoint being used politely, and fourteen simultaneous
 * requests is not polite.
 */
const BATCH = 6;

async function fetchAll(
  entries: { symbol: string; name: string; isIndex: boolean }[],
): Promise<(TaseQuote | null)[]> {
  const out: (TaseQuote | null)[] = [];

  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map((entry) => fetchOne(entry.symbol, entry.name, entry.isIndex)),
    );
    out.push(...results);
  }

  return out;
}

export type TaseBoard = {
  indices: (TaseQuote | null)[];
  leaders: (TaseQuote | null)[];
  fetchedAt: string;
};

/** The whole board, cached for two minutes and shared by every viewer. */
export const getTaseBoard = unstable_cache(
  async (): Promise<TaseBoard> => {
    /* Each half is caught on its own. They were awaited together with no
       catch at all, so one rejection took both down and the page lost the
       index strip as well as the stock list — two separate failures
       reported as one. Separately, a bad response for the shares still
       leaves the indices on screen. */
    const [indices, leaders] = await Promise.all([
      fetchAll(TASE_INDICES.map((index) => ({ ...index, isIndex: true }))).catch(
        () => TASE_INDICES.map(() => null),
      ),
      fetchAll(TASE_LEADERS.map((leader) => ({ ...leader, isIndex: false }))).catch(
        () => TASE_LEADERS.map(() => null),
      ),
    ]);

    return { indices, leaders, fetchedAt: new Date().toISOString() };
  },
  /* v2 — the quote carries a month of closes, a turnover baseline and a
     window change now. A cached v1 entry has none of those fields, and a
     page that reads `closes.length` off it would throw rather than show a
     dash, so the key moves instead of the shape being made optional. */
  ["tase-board", "v2"],
  { revalidate: 120, tags: ["quotes", "tase"] },
);

/* ------------------------------------------------------------------ */
/* The session                                                         */
/* ------------------------------------------------------------------ */

export type TaseSession = {
  state: "open" | "pre" | "closed";
  label: string;
};

/**
 * Tel Aviv's week is not the American one, and a hardcoded calendar is the
 * wrong way to describe it.
 *
 * The exchange trades Sunday through Friday with Friday a shortened
 * session, Saturday closed, and holiday closures that no rule here would
 * catch. Rather than assert hours this file cannot verify, the state is
 * taken from the data whenever the data can answer it: if the most recent
 * trade arrived minutes ago, the market is open, whatever the calendar
 * says. The weekday rule below is only the fallback for when no timestamp
 * came back, and the page marks it as approximate.
 *
 * `latestTrade` is the newest `at` among the quotes on the board.
 */
export function sessionFromData(
  latestTrade: string | null,
  now = new Date(),
): TaseSession {
  const traded = latestTrade ? Date.parse(latestTrade) : NaN;

  if (Number.isFinite(traded)) {
    const minutes = (now.getTime() - traded) / 60_000;

    if (minutes <= 20) {
      return { state: "open", label: "מסחר פעיל — עסקה התקבלה ברגעים האחרונים" };
    }
    if (minutes <= 24 * 60) {
      const hours = Math.round(minutes / 60);
      return {
        state: "closed",
        label:
          hours < 1
            ? `המסחר שקט — העסקה האחרונה לפני ${Math.round(minutes)} דק׳`
            : `המסחר הסתיים — העסקה האחרונה לפני ${hours} שע׳`,
      };
    }
    const days = Math.round(minutes / (60 * 24));
    return {
      state: "closed",
      label: `הבורסה סגורה — הנתון האחרון מלפני ${days} ימים`,
    };
  }

  return taseSession(now);
}

/**
 * The fallback, used only when no quote carried a timestamp.
 *
 * Saturday is closed, Friday is a short session, and the rest of the week
 * runs from 09:25. The closing times are approximate and the page says so
 * — continuous trading ends at different times on different days, and
 * holiday closures are not modelled.
 */
export function taseSession(now = new Date()): TaseSession {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const day = days.indexOf(get("weekday"));
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));

  if (day === 6) {
    return { state: "closed", label: "הבורסה סגורה — שבת" };
  }
  if (minutes < 9 * 60 + 25) {
    return { state: "pre", label: "לפני הפתיחה — נפתחת ב-09:25" };
  }

  // Friday is a short session. The exact bell moves, so this is stated as
  // an estimate rather than printed as a fact.
  const closeMinute = day === 5 ? 14 * 60 : 17 * 60 + 25;

  if (minutes > closeMinute) {
    return {
      state: "closed",
      label: day === 5 ? "יום מסחר קצר — המסחר הסתיים" : "המסחר הסתיים להיום",
    };
  }

  return {
    state: "open",
    label: day === 5 ? "מסחר פתוח — יום שישי, יום קצר" : "מסחר פתוח בתל אביב",
  };
}
