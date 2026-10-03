import Link from "next/link";
import { EntranceFilm } from "@/components/market/EntranceFilm";
import { ResearchDock } from "@/components/market/ResearchDock";
import { MarketNow } from "@/components/market/MarketNow";
import { ContextJourney } from "@/components/market/ContextJourney";
import { getIntradayHistory, getPriceHistory } from "@/lib/sources/prices";
import { getLiveFeed } from "@/lib/live-news";
import { getWatch } from "@/lib/watch-store";
import { getBoardQuotes } from "@/lib/sources/board-quotes";
import { WatchPanel } from "@/components/market/WatchPanel";
import { runScreen } from "@/lib/screener";
import { MarketDeck, type IndexCard, type RowSeed } from "@/components/MarketDeck";
import { MarketPulse } from "@/components/MarketPulse";
import { getMacroBoard } from "@/lib/sources/macro";
import { Disclaimer, Page } from "@/components/ui";
import { WatchlistStrip } from "@/components/WatchlistStrip";
import { marketSignal, marketStatus } from "@/lib/market-hours";
import type { LiveQuote } from "@/lib/use-live-ticks";

export const revalidate = 30;

// Finnhub's free tier does not carry index symbols, so we track the ETFs
// that follow them. The label says which index each one tracks — never
// imply the ETF *is* the index.
const INDEX_PROXIES = [
  { symbol: "SPY", label: "S&P 500", note: "SPY" },
  { symbol: "QQQ", label: "Nasdaq 100", note: "QQQ" },
  { symbol: "IWM", label: "Russell 2000", note: "IWM" },
  { symbol: "DIA", label: "Dow Jones", note: "DIA" },
];

/**
 * The companies the front page reads across.
 *
 * Eight was a screenful of megacap technology and not much else, which
 * made the opening board look like a sector page wearing the site's name.
 * Sixteen, spread across the sectors the universe actually covers, gives
 * the board something to say: on a day when semis are red and energy is
 * green, that is visible here rather than three pages in.
 *
 * Every symbol is in the research universe, so a tile always leads
 * somewhere with fundamentals behind it.
 */
const WATCHLIST: { symbol: string; name: string }[] = [
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "TTWO", name: "Take-Two" },
  { symbol: "AVGO", name: "Broadcom" },
  { symbol: "NFLX", name: "Netflix" },
  { symbol: "LLY", name: "Eli Lilly" },
  { symbol: "UNH", name: "UnitedHealth" },
  { symbol: "JPM", name: "JPMorgan" },
  { symbol: "XOM", name: "Exxon Mobil" },
  { symbol: "COST", name: "Costco" },
  { symbol: "CAT", name: "Caterpillar" },
];

/** Server-rendered seed so the page opens on real prices rather than on
 *  dashes that fill in a moment later. */
/**
 * The first paint of every price on this page.
 *
 * It read Finnhub, which covers the regular session only — so for the
 * whole of a pre-market morning the rail opened on the previous
 * afternoon.s close with the previous afternoon.s move, and the overnight
 * tape appeared nowhere. The board quotes carry pre and post prints with
 * the session attached, in one request for the lot, which is also what
 * /api/quotes now serves out of hours: the seed and the poll agree
 * because they read the same tape.
 */
async function seedQuotes(
  symbols: string[],
): Promise<Record<string, LiveQuote>> {
  try {
    const board = await getBoardQuotes(symbols);
    const seed: Record<string, LiveQuote> = {};
    for (const symbol of symbols) {
      const q = board[symbol];
      if (!q || q.price === null) continue;
      const base = q.extended ? q.regularClose : q.previousClose;
      seed[symbol] = {
        symbol,
        price: q.price,
        change: base != null && base > 0 ? q.price - base : null,
        changePercent: q.changePercent,
        high: q.dayHigh ?? undefined,
        low: q.dayLow ?? undefined,
        previousClose: base ?? undefined,
        phase: q.phase,
        extended: q.extended,
        at: q.at ?? undefined,
      };
    }
    return seed;
  } catch {
    return {};
  }
}

/** Today's session per index, so a sparkline has a shape before the first
 *  live tick arrives. A card that starts flat and grows a line looks broken
 *  for its first minute. */
async function indexCards(): Promise<IndexCard[]> {
  return Promise.all(
    INDEX_PROXIES.map(async (proxy) => {
      const history = await getIntradayHistory(proxy.symbol).catch(() => null);
      return { ...proxy, intraday: history?.candles.map((c) => c.close) ?? [] };
    }),
  );
}

/** Six months behind each row. Thirty sessions was the shape of a month,
 *  which on a board meant every line looked like noise and none of them
 *  looked like a trend — the complaint that these charts "only go back a
 *  month or two" was about exactly this. 120 sessions still fits the same
 *  22 pixels and costs nothing extra: the fetch already returns years, and
 *  this was throwing them away. */
async function watchRows(): Promise<RowSeed[]> {
  return Promise.all(
    WATCHLIST.map(async (entry) => {
      const history = await getPriceHistory(entry.symbol).catch(() => null);
      return {
        ...entry,
        trail: (history?.candles ?? []).slice(-120).map((c) => c.close),
      };
    }),
  );
}

/**
 * The status chip's colour, by what the figures on the page actually are.
 * Gold is this site's caveat colour, so a delayed feed wears it; an
 * unreachable one is not a caveat but an absence, and stays neutral.
 */
export default async function MarketPage() {
  const [seed, cards, rows, feed, screen, macro, watch] = await Promise.all([
    seedQuotes([
      ...INDEX_PROXIES.map((i) => i.symbol),
      ...WATCHLIST.map((w) => w.symbol),
    ]),
    indexCards(),
    watchRows(),
    getLiveFeed(),
    runScreen().catch(() => ({ builtAt: "", results: [] })),
    getMacroBoard().catch(() => ({ instruments: [], builtAt: "" })),
    getWatch(),
  ]);

  // The stories carrying an analysis marked high, newest first. Falls back
  // to whatever is newest when nothing has been analysed yet.
  const articles = feed.sectors.flatMap((sector) => sector.articles);
  const unique = [...new Map(articles.map((a) => [a.url, a])).values()].sort(
    (a, b) => (b.seenAt ?? "").localeCompare(a.seenAt ?? ""),
  );
  const priorityArticles = [...unique].sort((a,b)=>Number(b.analysis?.catalystKind === "catalyst")-Number(a.analysis?.catalystKind === "catalyst") || Number(b.analysis?.significance === "high")-Number(a.analysis?.significance === "high")).slice(0,6);
  /* Six rather than three. The screener ranks the whole universe and the
     front page was showing the podium; the rest of the shortlist is the
     part worth arguing with. */
  const topPicks = screen.results.slice(0, 6);

  /* The hand-kept table, read across companies. Four is the ceiling rather
     than the target — the table is short on purpose, and a page that
     padded it would be inventing catalysts to fill a grid. */
  

  /* What the numbers beside the headline ARE — live, last session, late, or
     missing. Derived from the freshest quote that actually arrived rather
     than from the clock alone: an open exchange and a feed that answered
     twenty minutes ago are different claims. */
  const quoteTimes = Object.values(seed)
    .map((quote) => (quote.at ? Date.parse(quote.at) : Number.NaN))
    .filter((time) => Number.isFinite(time));
  const signal = marketSignal({
    status: marketStatus(),
    quotedAt: quoteTimes.length > 0 ? new Date(Math.max(...quoteTimes)) : null,
  });

  return <><EntranceFilm status={signal.label} detail={signal.detail}/><Page>    {/* The editorial heading that used to open this page is gone: the film
        above is the opening now, and a greeting underneath a thirty-second
        sequence is the site introducing itself twice. Its only part that
        was not decoration — the live session status — moved into the
        corner of the film, where it is still the one sentence on the
        screen that is different every time. */}
    <MarketNow indices={cards} rows={rows} initial={seed} detail={signal.detail} articles={priorityArticles} picks={topPicks}/>
    <nav className="sector-ribbon" aria-label="לחקור לפי סקטור"><span>מעבר למניה הבודדת</span>{[["semis","שבבים"],["software","תוכנה"],["financials","פיננסים"],["energy","אנרגיה"],["healthcare","בריאות"]].map(([key,label])=><Link key={key} href={`/sectors/${key}`}>{label} ↖</Link>)}<Link href="/sectors">כל הסקטורים ←</Link></nav>
    {/* What changed while nobody was looking. It goes above the research
        dock because it is the only section on the page a returning reader
        has not already seen. */}
    <WatchPanel data={watch}/>
    <ContextJourney articles={priorityArticles} rows={rows} quotes={seed}/>
    <ResearchDock macro={<MarketPulse instruments={macro.instruments}/>} monitor={<WatchlistStrip/>}/>
    <div className="home-next-worlds"><Link href="/learn"><span>להבין יותר</span><strong>חדש בשוק? מתחילים כאן.</strong><small>מושגים, מנגנונים ומדריכים ↖</small></Link><Link href="/intel"><span>לחבר את הנקודות</span><strong>מאירוע אחד לשרשרת השפעות.</strong><small>לחדר המודיעין ↖</small></Link></div>
    <details className="depth-disclosure"><summary>לפתוח את טבלת הנתונים המלאה</summary><MarketDeck indices={cards} rows={rows} initial={seed}/></details>
    <Disclaimer/>
  </Page></>;
}
