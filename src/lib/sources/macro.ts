/**
 * The world outside the company page.
 *
 * Real indices, rates, commodities and currencies — not ETF proxies. The
 * dashboard has always shown SPY and called it the S&P 500 in a footnote,
 * because Finnhub's free tier carries no index symbols. Yahoo carries the
 * indices themselves, so this reads them directly and the footnote goes
 * away.
 *
 * FRED sits alongside rather than underneath: it publishes the official
 * series for inflation, unemployment and the policy rate, which no market
 * quote contains, and it needs a key this project may not have. What FRED
 * cannot answer is reported as missing rather than substituted — a market
 * yield is not a CPI print, and showing one where the other belongs would
 * be the kind of quiet lie this site is built to avoid.
 *
 * Every instrument here is a market price with a delay, and the page says
 * so. None of it is real time.
 */

import { unstable_cache } from "next/cache";

const CHART = "https://query1.finance.yahoo.com/v8/finance/chart";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0 Safari/537.36",
};

export type MacroKind = "index" | "rate" | "commodity" | "currency" | "vol";

export type Instrument = {
  symbol: string;
  name: string;
  kind: MacroKind;
  /** What a move in this actually tells the reader. Shown beside it. */
  note: string;
  /** Percent for a rate, dollars for oil, points for an index. */
  unit: "%" | "$" | "pt" | "₪";
  value: number | null;
  changePercent: number | null;
  /** Absolute move, which is what matters for a yield: "+0.12" on a rate
   *  is the sentence, not "+2.4%". */
  change: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  at: string | null;
};

export const INSTRUMENTS: {
  symbol: string;
  name: string;
  kind: MacroKind;
  unit: Instrument["unit"];
  note: string;
}[] = [
  /* ---- The indices themselves, not their ETFs ---- */
  { symbol: "^GSPC", name: "S&P 500", kind: "index", unit: "pt", note: "500 החברות הגדולות בארה״ב. הרוב המוחלט של התיקים נמדד מולו." },
  { symbol: "^IXIC", name: "Nasdaq Composite", kind: "index", unit: "pt", note: "מוטה טכנולוגיה וצמיחה, ולכן רגיש יותר לריבית." },
  { symbol: "^DJI", name: "Dow Jones", kind: "index", unit: "pt", note: "שלושים חברות, משוקלל לפי מחיר ולא לפי שווי — מדד ותיק וצר." },
  { symbol: "^RUT", name: "Russell 2000", kind: "index", unit: "pt", note: "חברות קטנות. כשהוא מפגר אחרי S&P, העלייה מרוכזת בגדולות." },
  { symbol: "^GDAXI", name: "DAX", kind: "index", unit: "pt", note: "גרמניה — התעשייה והיצוא של אירופה." },
  { symbol: "^FTSE", name: "FTSE 100", kind: "index", unit: "pt", note: "לונדון, עם משקל כבד לאנרגיה ולכרייה." },
  { symbol: "^N225", name: "Nikkei 225", kind: "index", unit: "pt", note: "יפן. נסחר בזמן שוול סטריט סגורה, ולכן לרוב מגיב ראשון." },
  { symbol: "TA35.TA", name: "ת״א 35", kind: "index", unit: "pt", note: "מדד הדגל של תל אביב." },

  /* ---- Fear ---- */
  { symbol: "^VIX", name: "VIX", kind: "vol", unit: "pt", note: "התנודתיות הגלומה באופציות על S&P לחודש הקרוב. מתחת ל-15 נחשב רגוע, מעל 25 מתוח." },

  /* ---- The price of money ---- */
  { symbol: "^TNX", name: "תשואת 10 שנים", kind: "rate", unit: "%", note: "הריבית חסרת הסיכון שכל היוון מניה נשען עליה. עלייה כאן מוזילה כל תזרים עתידי." },
  { symbol: "^FVX", name: "תשואת 5 שנים", kind: "rate", unit: "%", note: "הציפיות לריבית בטווח הבינוני." },
  { symbol: "^TYX", name: "תשואת 30 שנה", kind: "rate", unit: "%", note: "הקצה הארוך — משקף ציפיות אינפלציה לטווח ארוך." },

  /* ---- Things that get dug up ---- */
  { symbol: "GC=F", name: "זהב", kind: "commodity", unit: "$", note: "נכס מקלט. עלייה חדה בזהב יחד עם ירידה במניות היא בריחה מסיכון." },
  { symbol: "CL=F", name: "נפט WTI", kind: "commodity", unit: "$", note: "נכנס לאינפלציה ולעלויות של כמעט כל יצרן." },
  { symbol: "SI=F", name: "כסף", kind: "commodity", unit: "$", note: "חציו מקלט וחציו מתכת תעשייתית." },
  { symbol: "NG=F", name: "גז טבעי", kind: "commodity", unit: "$", note: "חשמל וחימום — תנודתי הרבה יותר מנפט." },

  /* ---- Currencies ---- */
  { symbol: "DX-Y.NYB", name: "מדד הדולר", kind: "currency", unit: "pt", note: "הדולר מול סל מטבעות. דולר חזק פוגע ברווחי חברות אמריקאיות שמוכרות בחו״ל." },
  { symbol: "ILS=X", name: "דולר / שקל", kind: "currency", unit: "₪", note: "הכי רלוונטי למשקיע ישראלי: תשואה דולרית נמדדת אחרי השינוי כאן." },
  { symbol: "EURUSD=X", name: "אירו / דולר", kind: "currency", unit: "$", note: "הצמד הנסחר ביותר בעולם." },
];

type YahooMeta = {
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  chartPreviousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  regularMarketTime?: number;
};

async function fetchInstrument(
  spec: (typeof INSTRUMENTS)[number],
): Promise<Instrument> {
  const empty: Instrument = {
    ...spec,
    value: null,
    changePercent: null,
    change: null,
    yearHigh: null,
    yearLow: null,
    at: null,
  };

  try {
    const res = await fetch(
      `${CHART}/${encodeURIComponent(spec.symbol)}?range=5d&interval=1d`,
      { headers: HEADERS, signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return empty;

    const result = (await res.json())?.chart?.result?.[0];
    const meta: YahooMeta | undefined = result?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") return empty;

    // Outside a session Yahoo reports the change as exactly zero, so the
    // last two closes are used instead — the same correction the Tel Aviv
    // source makes, for the same reason.
    const closes: number[] = (result?.indicators?.quote?.[0]?.close ?? []).filter(
      (v: unknown): v is number => typeof v === "number" && Number.isFinite(v),
    );

    const previous =
      closes.length >= 2 ? closes[closes.length - 2] : (meta.chartPreviousClose ?? null);

    const fromMeta = meta.regularMarketChangePercent;
    const changePercent =
      fromMeta !== undefined && Number.isFinite(fromMeta) && fromMeta !== 0
        ? fromMeta
        : previous
          ? ((meta.regularMarketPrice - previous) / previous) * 100
          : null;

    return {
      ...spec,
      value: meta.regularMarketPrice,
      changePercent,
      change: previous ? meta.regularMarketPrice - previous : null,
      yearHigh: meta.fiftyTwoWeekHigh ?? null,
      yearLow: meta.fiftyTwoWeekLow ?? null,
      at: meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : null,
    };
  } catch {
    return empty;
  }
}

/** Batched, like every other polite use of this endpoint in the project. */
export const getMacroBoard = unstable_cache(
  async (): Promise<{ instruments: Instrument[]; builtAt: string }> => {
    const out: Instrument[] = [];

    for (let i = 0; i < INSTRUMENTS.length; i += 6) {
      const slice = INSTRUMENTS.slice(i, i + 6);
      out.push(...(await Promise.all(slice.map(fetchInstrument))));
    }

    return { instruments: out, builtAt: new Date().toISOString() };
  },
  ["macro-board", "v1"],
  { revalidate: 300, tags: ["quotes", "macro"] },
);

export function instrumentsOfKind(
  instruments: Instrument[],
  kind: MacroKind,
): Instrument[] {
  return instruments.filter((instrument) => instrument.kind === kind);
}
