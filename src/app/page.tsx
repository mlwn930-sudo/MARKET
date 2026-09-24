import Link from "next/link";
import { getQuotes } from "@/lib/sources/finnhub";
import { getIntradayHistory, getPriceHistory } from "@/lib/sources/prices";
import { getLiveFeed } from "@/lib/live-news";
import { runScreen } from "@/lib/screener";
import { MarketDeck, type IndexCard, type RowSeed } from "@/components/MarketDeck";
import { ArticleCard } from "@/components/ArticleCard";
import { Disclaimer, Hero, MoreLink, Page, Section } from "@/components/ui";
import type { LiveQuote } from "@/lib/use-live-ticks";
import { fmtRelative } from "@/lib/format";

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

export default async function MarketPage() {
  const [seed, cards, rows, feed, screen] = await Promise.all([
    seedQuotes([
      ...INDEX_PROXIES.map((i) => i.symbol),
      ...WATCHLIST.map((w) => w.symbol),
    ]),
    indexCards(),
    watchRows(),
    getLiveFeed(),
    runScreen().catch(() => ({ builtAt: "", results: [] })),
  ]);

  // The stories carrying an analysis marked high, newest first. Falls back
  // to whatever is newest when nothing has been analysed yet.
  const articles = feed.sectors.flatMap((sector) => sector.articles);
  const unique = [...new Map(articles.map((a) => [a.url, a])).values()].sort(
    (a, b) => (b.seenAt ?? "").localeCompare(a.seenAt ?? ""),
  );
  const headlines = [
    ...unique.filter((a) => a.analysis?.significance === "high"),
    ...unique.filter((a) => a.analysis?.significance !== "high"),
  ].slice(0, 3);

  const topPicks = screen.results.slice(0, 6);

  return (
    <Page>
      <Hero
        eyebrow="סקירת שוק"
        title="כל השוק במקום אחד"
        lede="מדדים, מחירים חיים וחדשות מנותחות — והמספרים תמיד מול ההקשר שהופך אותם למשמעותיים."
        image="/hero/markets.webp"
        imageAlt=""
      />

      <div className="mt-20">
        <MarketDeck indices={cards} rows={rows} initial={seed} />
      </div>

      {/* ---- Screener ---- */}
      {topPicks.length > 0 && (
        <Section
          eyebrow="רדאר הזדמנויות"
          title="הציונים הגבוהים בסורק"
          description="48 חברות נבדקות מול קריטריונים של איכות, צמיחה, תמחור ואיתנות — רובם מול חציון הסקטור, כי מכפיל של 15 אומר דבר אחד בבנק ודבר אחר בחברת שבבים."
          action={<MoreLink href="/opportunities">לרדאר המלא</MoreLink>}
        >
          <div className="surface overflow-hidden">
            {topPicks.map((result) => (
              <Link
                key={result.company.ticker}
                href={`/company/${result.company.ticker}`}
                className="row grid-cols-[1fr_auto] sm:grid-cols-[1fr_1fr_auto]"
              >
                <span className="min-w-0">
                  <span className="num block text-[13px] font-medium text-ink">
                    {result.company.ticker}
                  </span>
                  <span className="block truncate text-[11px] text-ink-faint">
                    {result.company.name}
                  </span>
                </span>

                <span className="hidden text-[12px] text-ink-muted sm:block">
                  {result.sectorLabel}
                </span>

                <span className="flex items-center gap-3">
                  {/* The score as segments rather than a number alone —
                      "7" means nothing until you know it is out of ten. */}
                  <span className="hidden gap-[3px] sm:flex" aria-hidden="true">
                    {Array.from({ length: result.maxScore }, (_, i) => (
                      <span
                        key={i}
                        className="h-4 w-[3px] rounded-[1px]"
                        style={{
                          background:
                            i < result.score
                              ? "var(--color-accent)"
                              : "rgba(255,255,255,0.07)",
                        }}
                      />
                    ))}
                  </span>
                  <span className="num text-[13px]">
                    <span className="text-ink">{result.score}</span>
                    <span className="text-ink-ghost">/{result.maxScore}</span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* ---- News ---- */}
      {headlines.length > 0 && (
        <Section
          eyebrow="מה מזיז את השוק"
          title="חדשות, אחרי סינון"
          description="כל כתבה נקראת דרך שלוש עדשות: האם זה זרז או רעש, מה המחיר כבר עשה, ומי עוד בשרשרת הערך."
          action={
            <div className="flex items-center gap-4">
              {feed.refreshedAt && (
                <span className="text-[11px] text-ink-ghost">
                  עודכן {fmtRelative(new Date(feed.refreshedAt))}
                </span>
              )}
              <MoreLink href="/news">כל החדשות</MoreLink>
            </div>
          }
        >
          <div className="stagger grid gap-4 md:grid-cols-3">
            {headlines.map((article) => (
              <ArticleCard key={article.url} article={article} />
            ))}
          </div>
        </Section>
      )}

      <Disclaimer />
    </Page>
  );
}
