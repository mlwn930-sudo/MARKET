import Link from "next/link";
import Image from "next/image";
import { CinematicHero } from "@/components/market/CinematicHero";
import { SignalCanvas } from "@/components/market/SignalCanvas";
import { WorkflowLinks } from "@/components/market/WorkflowLinks";
import { getQuotes } from "@/lib/sources/finnhub";
import { getIntradayHistory, getPriceHistory } from "@/lib/sources/prices";
import { getLiveFeed } from "@/lib/live-news";
import { runScreen } from "@/lib/screener";
import { MarketDeck, type IndexCard, type RowSeed } from "@/components/MarketDeck";
import { ArticleCard } from "@/components/ArticleCard";
import { WhatMattersToday } from "@/components/WhatMattersToday";
import { MarketPulse } from "@/components/MarketPulse";
import { getMacroBoard } from "@/lib/sources/macro";
import {
  Disclaimer,
  EventCard,
  MoreLink,
  Page,
  Section,
  StatusPill,
} from "@/components/ui";
import { upcomingEvents } from "@/lib/analysis/known-events";
import { WatchlistStrip } from "@/components/WatchlistStrip";
import { marketSignal, marketStatus, type MarketSignalKind } from "@/lib/market-hours";
import type { LiveQuote } from "@/lib/use-live-ticks";
import { fmtRelative } from "@/lib/format";
import { IntelligenceReadout } from "@/components/IntelligenceReadout";

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
const SIGNAL_TONE: Record<
  MarketSignalKind,
  "live" | "closed" | "brand" | "event" | "neutral"
> = {
  open: "live",
  extended: "brand",
  closed: "closed",
  delayed: "event",
  unavailable: "neutral",
};

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
  const headlines = [
    ...unique.filter((a) => a.analysis?.significance === "high"),
    ...unique.filter((a) => a.analysis?.significance !== "high"),
  ].slice(0, 3);

  const topPicks = screen.results.slice(0, 6);

  /* The hand-kept table, read across companies. Four is the ceiling rather
     than the target — the table is short on purpose, and a page that
     padded it would be inventing catalysts to fill a grid. */
  const catalysts = upcomingEvents().slice(0, 4);

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

  return (
    <Page>
      <CinematicHero
        image="/hero/market-city.webp"
        eyebrow={<span><span className="micro-label">FINANCIAL INTELLIGENCE</span><StatusPill tone={SIGNAL_TONE[signal.kind]}>{signal.label}</StatusPill></span>}
        title={<>לראות את השוק.<br /><em>להבין את התמונה.</em></>}
        description="מהנתון הראשון ועד לתזת ההשקעה. חברות, חדשות והכוחות שמחברים ביניהן — במקום אחד."
        actions={<>
          <Link href="/brief" className="btn btn-editorial">לתדריך השוק <span aria-hidden="true">←</span></Link>
          <Link href="/research">לפתוח מחקר</Link>
        </>}
        aside={<SignalCanvas indices={cards} quotes={seed} detail={signal.detail} />}
        footer={<nav className="journey-rail" aria-label="מסלול המחקר">
          <a href="#market-data"><span className="num">01</span>נתונים</a>
          <a href="#what-matters"><span className="num">02</span>הקשר</a>
          <Link href="/intel"><span className="num">03</span>מודיעין</Link>
          <Link href="/research"><span className="num">04</span>תזה</Link>
          <Link href="/watchlist"><span className="num">05</span>מעקב</Link>
        </nav>}
      />

      {/* The pulse first: equities, the price of money, and what that did
          to hard assets — one band, because those three read together are
          a story and read apart are trivia. */}
      <div id="market-data" className="market-pulse-band">
        <MarketPulse instruments={macro.instruments} />
      </div>

      <div className="gap-section-tight">
        <MarketDeck indices={cards} rows={rows} initial={seed} />
      </div>

      <IntelligenceReadout
        signal={{ label: signal.label, detail: signal.detail }}
        quotes={seed}
        articles={unique}
        instruments={macro.instruments}
        opportunityCount={screen.results.length}
      />

      {/* ---- What matters, before what is new.
           The feed is sorted by time; this is sorted by consequence, and
           it is the first thing under the prices for that reason. ---- */}
      <Section
        id="what-matters"
        eyebrow="02 / הקשר"
        title="האירועים שמאחורי התנועה"
        description="רק כתבות שהניתוח סיווג כאירוע שמשנה תזרים, תחרות או רגולציה. כל השאר נשאר בפיד."
        action={<MoreLink href="/news">כל החדשות</MoreLink>}
      >
        <WhatMattersToday articles={unique} />
      </Section>

      <section className="editorial-feature" aria-labelledby="featured-research">
        <div className="editorial-feature-media"><Image src="/hero/ttwo-story.webp" alt="איור מערכתי: מיאמי בשקיעה" fill sizes="(max-width: 767px) 100vw, 45vw" className="object-cover object-left" /></div>
        <div className="editorial-feature-copy">
          <span className="micro-label">THE BIG PICTURE / TTWO</span>
          <h2 id="featured-research">כולם מחכים למשחק.<br />אנחנו בוחנים את התזה.</h2>
          <p>GTA VI דרך הדוחות של Take-Two: מועד ההשקה, הציפיות, ההכנסות שעוד לא הוכרו ומה יכול לשנות את הסיפור.</p>
          <Link href="/launch/ttwo">לסיפור ההשקעה <span aria-hidden="true">←</span></Link>
        </div>
      </section>

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
                              : "rgba(11,18,32,0.08)",
                        }}
                      />
                    ))}
                  </span>
                  <span className="num text-[13px]">
                    <span className="text-ink">{result.score}</span>
                    <span className="text-ink-ghost">/{result.maxScore}</span>
                  </span>
                  <span
                    className="on-hover text-ink-ghost"
                    aria-hidden="true"
                  >
                    ←
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

      {/* ---- The reader's own list ----
           The only thing on this page that differs per visitor, and the
           MONITOR end of the product. It renders unconditionally because
           the empty state is a one-line invitation rather than a panel —
           gating it on a list the server cannot see is not possible
           anyway, since the list is in the browser. */}
      <Section
        eyebrow="מה שאתה עוקב אחריו"
        title="הרשימה שלך"
        description="נשמרת בדפדפן שלך בלבד. אין כאן חשבונות, ואין שרת שיודע אחרי מי אתה עוקב."
        action={<MoreLink href="/watchlist">ללוח המלא</MoreLink>}
      >
        <WatchlistStrip />
      </Section>

      {/* ---- What is still ahead ----
           Read from the same table the launch page reads, rather than
           restated here. The date on this one has already moved twice,
           which is exactly why there is only ever one copy of it. */}
      {catalysts.length > 0 && (
        <Section
          eyebrow="מה עוד לפנינו"
          title="זרזים מתוזמנים"
          description="אירועים שהדוחות אינם מכילים, מתוך טבלה שנכתבת ביד ונבדקת מול מקור. לא תחזיות — תאריכים שהחברה עצמה מסרה."
          action={<MoreLink href="/launch/ttwo">לניתוח המלא</MoreLink>}
        >
          <div className="stagger grid gap-4 md:grid-cols-2">
            {catalysts.map((event) => (
              <EventCard
                key={`${event.ticker}-${event.title}`}
                when={event.window ?? "טרם הוכרז"}
                title={`${event.ticker} · ${event.title}`}
                status={
                  event.status === "confirmed"
                    ? "תאריך מאושר"
                    : event.status === "indicated"
                      ? "חלון שהוכרז"
                      : "לא הוכרז"
                }
                body={event.why}
                source={
                  <>
                    {event.source}
                    {event.history && event.history.length > 0 && (
                      <span className="text-ink-ghost">
                        {" · "}נדחה {event.history.length === 1 ? "פעם" : `${event.history.length} פעמים`}
                      </span>
                    )}
                  </>
                }
              />
            ))}
          </div>
        </Section>
      )}

      <WorkflowLinks />

      <Disclaimer />
    </Page>
  );
}
