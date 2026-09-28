import Link from "next/link";
import { ResearchDock } from "@/components/market/ResearchDock";
import { MarketNow } from "@/components/market/MarketNow";
import { ContextJourney } from "@/components/market/ContextJourney";
import { getQuotes } from "@/lib/sources/finnhub";
import { getIntradayHistory, getPriceHistory } from "@/lib/sources/prices";
import { getLiveFeed } from "@/lib/live-news";
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

const WATCHLIST: { symbol: string; name: string }[] = [
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "TTWO", name: "Take-Two" },
];

/** Server-rendered seed so the page opens on real prices rather than on
 *  dashes that fill in a moment later. */
async function seedQuotes(
  symbols: string[],
): Promise<Record<string, LiveQuote>> {
  try {
    const quotes = await getQuotes(symbols);
    const seed: Record<string, LiveQuote> = {};
    symbols.forEach((symbol, i) => {
      const quote = quotes[i];
      if (quote) seed[symbol] = { ...quote, at: quote.at.toISOString() };
    });
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

/** Thirty sessions behind each row. Enough to show the shape of a move
 *  without the line becoming a second chart. */
async function watchRows(): Promise<RowSeed[]> {
  return Promise.all(
    WATCHLIST.map(async (entry) => {
      const history = await getPriceHistory(entry.symbol).catch(() => null);
      return {
        ...entry,
        trail: (history?.candles ?? []).slice(-30).map((c) => c.close),
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
  const [seed, cards, rows, feed, screen, macro] = await Promise.all([
    seedQuotes([
      ...INDEX_PROXIES.map((i) => i.symbol),
      ...WATCHLIST.map((w) => w.symbol),
    ]),
    indexCards(),
    watchRows(),
    getLiveFeed(),
    runScreen().catch(() => ({ builtAt: "", results: [] })),
    getMacroBoard().catch(() => ({ instruments: [], builtAt: "" })),
  ]);

  // The stories carrying an analysis marked high, newest first. Falls back
  // to whatever is newest when nothing has been analysed yet.
  const articles = feed.sectors.flatMap((sector) => sector.articles);
  const unique = [...new Map(articles.map((a) => [a.url, a])).values()].sort(
    (a, b) => (b.seenAt ?? "").localeCompare(a.seenAt ?? ""),
  );
  const topPicks = screen.results.slice(0, 3);

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

  return <Page>
    <header className="market-opening product-heading"><div><span className="micro-label">MARKET / FINANCIAL INTELLIGENCE</span><h1>להבין מה זז. <em>לדעת למה.</em></h1></div><div className="market-status"><span>{signal.label}</span><p>{signal.detail}</p></div></header>
    <MarketNow indices={cards} rows={rows} initial={seed} detail={signal.detail} articles={unique} picks={topPicks}/>
    <nav className="sector-ribbon" aria-label="לחקור לפי סקטור"><span>מעבר למניה הבודדת</span>{[["semis","שבבים"],["software","תוכנה"],["financials","פיננסים"],["energy","אנרגיה"],["healthcare","בריאות"]].map(([key,label])=><Link key={key} href={`/sectors/${key}`}>{label} ↖</Link>)}<Link href="/sectors">כל הסקטורים ←</Link></nav>
    <ContextJourney articles={[...unique].sort((a,b)=>Number(b.analysis?.catalystKind === "catalyst")-Number(a.analysis?.catalystKind === "catalyst") || Number(b.analysis?.significance === "high")-Number(a.analysis?.significance === "high")).slice(0,3)}/>
    <ResearchDock macro={<MarketPulse instruments={macro.instruments}/>} monitor={<WatchlistStrip/>}/>
    <div className="home-next-worlds"><Link href="/learn"><span>להבין יותר</span><strong>חדש בשוק? מתחילים כאן.</strong><small>מושגים, מנגנונים ומדריכים ↖</small></Link><Link href="/intel"><span>לחבר את הנקודות</span><strong>מאירוע אחד לשרשרת השפעות.</strong><small>לחדר המודיעין ↖</small></Link></div>
    <details className="depth-disclosure"><summary>לפתוח את טבלת הנתונים המלאה</summary><MarketDeck indices={cards} rows={rows} initial={seed}/></details>
    <Disclaimer/>
  </Page>;
}
