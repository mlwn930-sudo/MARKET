import { getQuotes } from "@/lib/sources/finnhub";
import { TickerSearch } from "@/components/TickerSearch";
import { LiveIndexStrip, LiveWatchlist } from "@/components/LiveQuotes";
import type { LiveQuote } from "@/lib/use-live-quotes";

// Finnhub's free tier does not carry index symbols, so we track the ETFs that
// follow them. The label says which index each one tracks — never imply the
// ETF *is* the index.
const INDEX_PROXIES = [
  { symbol: "SPY", label: "S&P 500", note: "SPY" },
  { symbol: "QQQ", label: "Nasdaq 100", note: "QQQ" },
  { symbol: "IWM", label: "Russell 2000", note: "IWM" },
  { symbol: "DIA", label: "Dow Jones", note: "DIA" },
];

const WATCHLIST = ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA"];

export const revalidate = 30;

/** Server-rendered seed so the page opens on real prices. The client takes
 *  over from here and refreshes them every fifteen seconds. */
async function seedQuotes(symbols: string[]): Promise<Record<string, LiveQuote>> {
  const quotes = await getQuotes(symbols);
  const seed: Record<string, LiveQuote> = {};

  symbols.forEach((symbol, i) => {
    const quote = quotes[i];
    if (!quote) return;
    seed[symbol] = {
      symbol,
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      high: quote.high,
      low: quote.low,
      at: quote.at.toISOString(),
    };
  });

  return seed;
}

export default async function Home() {
  const [indexSeed, watchSeed] = await Promise.all([
    seedQuotes(INDEX_PROXIES.map((i) => i.symbol)),
    seedQuotes(WATCHLIST),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-center justify-between border-b border-line pb-5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl text-gold">Market Intel</h1>
          <span className="text-xs text-ink-muted">שוק ההון האמריקאי</span>
        </div>
      </header>

      <div className="mt-6">
        <LiveIndexStrip items={INDEX_PROXIES} initial={indexSeed} />
        <p className="mt-2 text-[11px] text-ink-faint">
          המדדים מוצגים דרך קרנות הסל העוקבות אחריהם.
        </p>
      </div>

      <section className="mt-8" aria-labelledby="watchlist">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="watchlist" className="text-base">
            רשימת מעקב
          </h2>
          <TickerSearch />
        </div>
        <LiveWatchlist symbols={WATCHLIST} initial={watchSeed} />
      </section>
    </main>
  );
}
