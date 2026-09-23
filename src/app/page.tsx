import Link from "next/link";
import { getQuotes } from "@/lib/sources/finnhub";
import { getLiveFeed } from "@/lib/live-news";
import { runScreen } from "@/lib/screener";
import { AccentTheme } from "@/components/AccentTheme";
import { TickerSearch } from "@/components/TickerSearch";
import { MarketDeck, type IndexCard } from "@/components/MarketDeck";
import { ArticleCard } from "@/components/ArticleCard";
import { getIntradayHistory } from "@/lib/sources/prices";
import type { LiveQuote } from "@/lib/use-live-ticks";
import { fmtCompact, fmtRelative } from "@/lib/format";

// Finnhub's free tier does not carry index symbols, so we track the ETFs
// that follow them. The label says which index each one tracks — never
// imply the ETF *is* the index.
const INDEX_PROXIES = [
  { symbol: "SPY", label: "S&P 500", note: "SPY" },
  { symbol: "QQQ", label: "Nasdaq 100", note: "QQQ" },
  { symbol: "IWM", label: "Russell 2000", note: "IWM" },
  { symbol: "DIA", label: "Dow Jones", note: "DIA" },
];

const WATCHLIST = ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA"];

const SECTIONS = [
  {
    href: "/ai",
    title: "בינה מלאכותית",
    blurb: "שרשרת הערך בשלוש חוליות — שבבים, תשתית, מודלים",
    accent: "#7f77dd",
  },
  {
    href: "/opportunities",
    title: "הזדמנויות",
    blurb: "48 חברות מול 10 קריטריונים של איכות ותמחור",
    // Cyan, not the site's green. Green means "price went up" everywhere on
    // this site, and a green section card would quietly imply that the
    // screener found something good before the reader has opened it.
    accent: "#3fa7c4",
  },
  {
    href: "/institutional",
    title: "מעקב מוסדי",
    blurb: "מה ברקשייר, בריג׳ווטר ו-ARK קנו ומכרו",
    accent: "#378add",
  },
  {
    href: "/learn",
    title: "מרכז ידע",
    blurb: "22 מושגים, וכל אחד עם המלכודת שלו",
    accent: "#c9a227",
  },
];

export const revalidate = 30;

/** Server-rendered seed so the page opens on real prices. The client takes
 *  over and refreshes on the market's cadence. */
async function seedQuotes(
  symbols: string[],
): Promise<Record<string, LiveQuote>> {
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

/**
 * Today's session for each index card, so the sparkline has a shape to draw
 * before the first live tick arrives. A card that starts as a flat line and
 * grows one is a card that looks broken for the first minute.
 */
async function indexCards(): Promise<IndexCard[]> {
  return Promise.all(
    INDEX_PROXIES.map(async (proxy) => {
      const history = await getIntradayHistory(proxy.symbol).catch(() => null);
      return {
        ...proxy,
        intraday: history?.candles.map((c) => c.close) ?? [],
      };
    }),
  );
}

export default async function Home() {
  const [seed, cards, feed, screen] = await Promise.all([
    seedQuotes([...INDEX_PROXIES.map((i) => i.symbol), ...WATCHLIST]),
    indexCards(),
    getLiveFeed(),
    runScreen().catch(() => ({ builtAt: "", results: [] })),
  ]);

  // The stories that carry an analysis marked high, newest first. Falls back
  // to whatever is newest when nothing has been analysed yet.
  const allArticles = feed.sectors.flatMap((s) => s.articles);
  const byUrl = new Map(allArticles.map((a) => [a.url, a]));
  const unique = [...byUrl.values()].sort((a, b) =>
    (b.seenAt ?? "").localeCompare(a.seenAt ?? ""),
  );
  const headlines = [
    ...unique.filter((a) => a.analysis?.significance === "high"),
    ...unique.filter((a) => a.analysis?.significance !== "high"),
  ].slice(0, 3);

  const topPicks = screen.results.slice(0, 5);

  return (
    <>
      <AccentTheme accent="#c9a227" />
      <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="enter flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="font-serif text-4xl text-gold">Market Intel</h1>
          <p className="mt-1 text-sm text-ink-muted">
            מחקר שוק ההון האמריקאי — מספרים, הקשר, וחדשות מנותחות
          </p>
        </div>
        <TickerSearch />
      </header>

      <div className="mt-8">
        <MarketDeck
          indices={cards}
          watchlist={WATCHLIST}
          initial={seed}
        />
      </div>

      <div className="mt-10">
        <section aria-labelledby="picks">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="picks" className="text-base">
              הציונים הגבוהים בסורק
            </h2>
            <Link
              href="/opportunities"
              className="text-[11px] text-ink-muted hover:text-ink"
            >
              הכל ←
            </Link>
          </div>

          {topPicks.length === 0 ? (
            <p className="panel px-4 py-4 text-xs text-ink-muted">
              הסורק עדיין לא נבנה.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-line">
              {topPicks.map((result) => (
                <li
                  key={result.company.ticker}
                  className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0 hover:bg-surface"
                >
                  <Link
                    href={`/company/${result.company.ticker}`}
                    className="min-w-0 flex-1"
                  >
                    <span className="num text-sm text-ink">
                      {result.company.ticker}
                    </span>
                    <span className="mr-2 truncate text-[11px] text-ink-muted">
                      {result.sectorLabel}
                    </span>
                  </Link>
                  <span className="num shrink-0 text-xs">
                    <span className="text-gold">{result.score}</span>
                    <span className="text-ink-faint">/{result.maxScore}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {headlines.length > 0 && (
        <section className="mt-12" aria-labelledby="headlines">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="headlines" className="text-base">
              מה מזיז את השוק
            </h2>
            <div className="flex items-center gap-3 text-[11px] text-ink-muted">
              {feed.refreshedAt && (
                <span>עודכן {fmtRelative(new Date(feed.refreshedAt))}</span>
              )}
              <Link href="/news" className="hover:text-ink">
                כל החדשות ←
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {headlines.map((article) => (
              <ArticleCard
                key={article.url}
                article={article}
                accent="#c9a227"
              />
            ))}
          </div>
        </section>
      )}

      <section className="mt-12" aria-labelledby="sections">
        <h2 id="sections" className="sr-only">
          מדורי האתר
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group panel p-4 transition-colors hover:border-line-strong"
              style={{
                borderInlineStartWidth: 2,
                borderInlineStartColor: section.accent,
              }}
            >
              <h3 className="text-sm" style={{ color: section.accent }}>
                {section.title}
              </h3>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
                {section.blurb}
              </p>
            </Link>
          ))}
        </div>
      </section>
      </main>
    </>
  );
}
