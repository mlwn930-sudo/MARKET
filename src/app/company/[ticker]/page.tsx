import { ChapterNav } from "@/components/market/ChapterNav";
import { EvidenceKey } from "@/components/market/EvidenceKey";
import { WorkflowLinks } from "@/components/market/WorkflowLinks";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuote } from "@/lib/sources/finnhub";
import { getPriceHistory, getRangeHistory } from "@/lib/sources/prices";
import { getCompanyAnalysis, getTechnicalRead } from "@/lib/company-analysis";
import { CompanyNewsCorner, loadCompanyNews } from "@/components/CompanyNewsCorner";
import { compareToSector, getSectorContext } from "@/lib/fundamentals-store";
import { identityFor } from "@/lib/company-identity";
import { CompanyMark } from "@/components/CompanyMark";
import { CompanyPriceTag } from "@/components/CompanyPriceTag";
import { getCompanyIntelligence } from "@/lib/agents";
import { CompanyChart } from "@/components/CompanyChart";
import type { ChartLevel, ChartMarker } from "@/components/LiveChart";
import { VerdictPanel } from "@/components/VerdictPanel";
import { IntelligencePanel } from "@/components/IntelligencePanel";
import { TechnicalPanel } from "@/components/TechnicalPanel";
import { LevelsPanel } from "@/components/LevelsPanel";
import { ExtendedHoursStrip } from "@/components/ExtendedHoursStrip";
import { readLevels, readFlow } from "@/lib/metrics/levels";
import { readTape } from "@/lib/metrics/tape";
import { TapePanel } from "@/components/market/TapePanel";
import { getExtendedHours } from "@/lib/sources/extended-hours";
import { CapitalPanel } from "@/components/CapitalPanel";
import { RevenueChart } from "@/components/RevenueChart";
import { WatchButton } from "@/components/WatchButton";
import { OutlookPanel } from "@/components/OutlookPanel";
import { ChartExplainer } from "@/components/ChartExplainer";
import { buildOutlook } from "@/lib/analysis/outlook";
import { whyMoving } from "@/lib/analysis/why-moving";
import { buildExpectationGap } from "@/lib/analysis/expectation-gap";
import { ExpectationGapPanel } from "@/components/ExpectationGapPanel";
import {
  getAnalystViews,
  getNextEarnings,
  getEarningsSurprises,
} from "@/lib/sources/finnhub";
import { WhyMovingPanel } from "@/components/WhyMovingPanel";
import { getSectorViews } from "@/lib/sectors";
import { SectorBackdrop } from "@/components/market/SectorBackdrop";
import { BaseRatePanel } from "@/components/market/BaseRatePanel";
import { baseRatesFor } from "@/lib/metrics/base-rate-store";
import { getFallbackQuote } from "@/lib/sources/prices";
import { readChart } from "@/lib/analysis/chart-read";
import { changesFor, historyFor } from "@/lib/intel/history-store";
import { buildExpectationEngine } from "@/lib/intel/surprise";
import { readEarnings } from "@/lib/intel/earnings";
import { buildCompanyGraph } from "@/lib/intel/graph";
import { sectorOf } from "@/lib/universe";
import { ThesisChangePanel } from "@/components/ThesisChangePanel";
import {
  EarningsReadPanel,
  ExpectationEnginePanel,
} from "@/components/ExpectationPanel";
import { ConnectionIndex } from "@/components/ConnectionIndex";
import {
  Band,
  Disclaimer,
  EventCard,
  Field,
  Page,
  Section,
  Stat,
} from "@/components/ui";
import { knownEventsFor } from "@/lib/analysis/known-events";
import { fmtCompact, fmtDate, fmtMetric } from "@/lib/format";

export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const symbol = decodeURIComponent(ticker).toUpperCase();
  const title = `${symbol} — ניתוח מלא`;
  const description = `ניתוח פונדמנטלי, טכני ואיכות הון של ${symbol}, מול חציון הסקטור ועם מחיר חי.`;
  /* The Open Graph block has to be stated here and not inherited. Next
     merges metadata by key, so a page that sets only `title` keeps the
     layout's `openGraph.title` — which meant every company link shared
     anywhere arrived carrying the site's name instead of the company's,
     with the right picture underneath it. The one thing a reader needs
     from a pasted URL is which company it is about. */
  return {
    title,
    description,
    openGraph: {
      type: "article",
      title,
      description,
      url: `/company/${symbol}`,
    },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: `/company/${symbol}` },
  };
}

/**
 * A company, as a research terminal.
 *
 * The order is the argument: the verdict first, because a reader who
 * scrolls no further should still leave with the answer; then the price;
 * then the working, in descending order of how much it would change that
 * answer. Metric tables sit last — they are the evidence, and evidence
 * belongs after the case it supports.
 *
 * The page takes the company's colour as its ambient tint only. No figure
 * on it changes colour: the same value has to look the same on every
 * company page, or the colour starts carrying meaning it does not have.
 */
export default async function CompanyPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: raw } = await params;
  const ticker = decodeURIComponent(raw).toUpperCase();
  const identity = identityFor(ticker);

  // Filings and metrics come from the hourly cache; the quote is fetched
  // fresh, because a price cached for an hour is a wrong price. Each of the
  // rest can fail without taking the page down.
  const [
    analysis,
    intelligence,
    quote,
    history,
    chartHistory,
    technical,
    sector,
    extended,
  ] = await Promise.all([
    getCompanyAnalysis(ticker),
    // The full agent pipeline, cached as its finished report. See
    // lib/agents/index.ts for why not every agent runs on every request.
    getCompanyIntelligence(ticker),
    getQuote(ticker).catch(() => null),
    getPriceHistory(ticker).catch(() => null),
    /* A second, longer series, for the chart only.
     *
     * The two-year daily history above is what the frameworks are defined
     * against — a 200-day average and a stage read need daily bars, and
     * computing either on the weekly bars a five-year range returns would
     * produce a confident wrong number. So the analysis keeps its series
     * and the chart gets its own: five years of weekly candles, which is
     * what someone asking "what has this done" actually wants to see.
     * Both are cached, and the page already fans out wider than this. */
    getRangeHistory(ticker, "5Y").catch(() => null),
    getTechnicalRead(ticker).catch(() => null),
    getSectorContext(ticker),
    getExtendedHours(ticker).catch(() => null),
  ]);

  if (!analysis) notFound();

  const { profile, marketCap, fundamentals, capital, title } = analysis;
  const name = profile?.name ?? title;

  /* The hand-kept table, read for this company. Empty for almost every
     ticker, which is correct — the table holds only what materially
     changes a business and is not in a filing. */
  const catalysts = knownEventsFor(ticker);


  /**
   * The frameworks' own levels, drawn on the chart. Computed from the same
   * technical read the analysis panel renders, so a line on the chart and a
   * number in the table cannot disagree. The chart never decides where a
   * pivot or a stop belongs.
   */
  const chartLevels: ChartLevel[] = [];
  if (technical?.vcp.pivot != null) {
    chartLevels.push({
      price: technical.vcp.pivot,
      label: "רמת ייחוס",
      kind: "pivot",
    });
  }
  if (technical?.risk) {
    chartLevels.push({
      price: technical.risk.stop,
      label: "עצירה",
      kind: "stop",
    });
    for (const target of technical.risk.targets) {
      chartLevels.push({
        price: target.price,
        label: `${target.multiple}R`,
        kind: "target",
      });
    }
  }

  /**
   * Prices the stock has actually reversed at, and what the volume was
   * doing when it did. Drawn on the same chart and tabulated underneath,
   * from one computation — the line and the row cannot disagree because
   * there is only one of them.
   *
   * The nearest four go on the chart. All six go in the table: a chart
   * with six horizontal lines across it stops being a chart.
   */
  const priceLevels = readLevels(history?.candles ?? []);
  const flow = readFlow(history?.candles ?? []);
  const tape = readTape(history?.candles ?? []);

  for (const level of priceLevels.slice(0, 4)) {
    chartLevels.push({
      price: level.price,
      label: `${level.kind === "support" ? "תמיכה" : "התנגדות"} · ${level.touches} נגיעות`,
      kind: level.kind,
    });
  }

  const chartMarkers: ChartMarker[] =
    technical?.vcp.contractions.map((contraction, i) => ({
      date: contraction.lowDate,
      label: `${i + 1} · ${contraction.depthPercent.toFixed(0)}%`,
    })) ?? [];

  const metric = (key: string) => {
    for (const group of fundamentals.groups) {
      const found = group.metrics.find((m) => m.key === key);
      if (found) return found;
    }
    return null;
  };

  const pe = metric("pe");
  const growth = metric("rev_cagr_3");

  // The forward-looking view and the chart's reading. Both are pure
  // functions over what has already been fetched — neither adds a request.
  const outlook = intelligence
    ? buildOutlook({
        ticker,
        companyName: name,
        price: quote?.price ?? null,
        intelligence,
        fundamentals,
        sector,
        technical,
      })
    : null;

  const chartReading = readChart(technical, { rangeLabel: "שנתיים" });

  /* Why it moved today. Deterministic: the index, the sector and the
     coverage are all figures the site already holds, and the panel says
     so rather than picking a headline and calling it a cause. */
  const [benchmarkToday, sectorViews, surprises, analystViews, fallbackQuote, news, baseRates, calendar] =
    await Promise.all([
      getFallbackQuote("^GSPC").catch(() => null),
      getSectorViews().catch(() => []),
      getEarningsSurprises(ticker).catch(() => []),
      /* Cached for a day upstream, so this is nearly free — and the agent
         pipeline has already warmed it on most visits. */
      getAnalystViews(ticker).catch(() => []),
      /* A second opinion on today's move, from the other provider.
         This page spends seven Finnhub calls before it renders, and when
         the quote is the one that loses the race to the rate limit, the
         whole "why is this moving" panel disappeared — the reading needs
         a change percent and had none. Yahoo carries the same figure and
         is already a dependency here. */
      getFallbackQuote(ticker).catch(() => null),
      /* Both live sources for this company's news, merged, deduplicated and
         screened for whether they are about the company at all. It waits for
         this wave rather than the first because the screen needs the
         registered name, and the name arrives with the filings.
         See components/CompanyNewsCorner.tsx — what this replaced was the
         committed feed file, which changed when a deployment landed rather
         than when a story broke. */
      loadCompanyNews(ticker, name),
      /* A file read, not a measurement. Ten years of candles for the whole
         universe is a nightly job; see scripts/build-base-rates.ts. */
      baseRatesFor(ticker).catch(() => null),
      /* The next scheduled report. One request for the whole market,
         cached six hours upstream, so asking here costs effectively
         nothing — and the tape panel needs it: a quiet bar eight sessions
         before a report is a different quiet bar. */
      getNextEarnings(ticker).catch(() => null),
    ]);

  /* Trading days, not calendar days, because that is the unit everything
     else on this panel is counted in — and "in 14 days" over a holiday
     week means something different from "in 14 sessions". Weekends are
     removed; market holidays are not, so this can run a day or two long
     across Thanksgiving. Close enough to be useful and stated as sessions
     rather than as a date arithmetic nobody checked. */
  const nextReport = calendar?.date ?? null;
  const sessionsToReport = (() => {
    if (!nextReport) return null;
    const from = new Date();
    const to = new Date(nextReport + "T00:00:00Z");
    if (Number.isNaN(to.getTime())) return null;
    let sessions = 0;
    const cursor = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
    );
    while (cursor < to && sessions < 400) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      const day = cursor.getUTCDay();
      if (day !== 0 && day !== 6) sessions++;
    }
    return sessions;
  })();

  /* One list, three readers: the corner renders it, "why is it moving" asks
     whether anything was written today, and the connection index counts what
     the company is attached to. One fetch, so they cannot disagree about
     whether coverage exists.

     `all` and not `items`: `items` is the corner's display slice, eight rows
     of it, and the two readers below *count* what they are given. Handed the
     slice, the connection index printed "8 כתבות מזכירות את NVDA" directly
     under a corner header reading "8 מתוך 55" — the same page answering one
     question twice, with the display limit in the place of the total. */
  const articles = news.all;

  /* Finnhub first: it is the real-time feed and it carries the day's high
     and low that the header's range bar needs. Yahoo is the backstop for
     the one field the analysis cannot do without. */
  const changeToday = quote?.changePercent ?? fallbackQuote?.changePercent ?? null;

  /* What the price implies against what the filings delivered. The panel
     is the site's answer to "is the problem the business or the price",
     and it is computed rather than judged. */
  const gap = buildExpectationGap({
    companyName: name,
    fundamentals,
    sector,
    surprises,
  });

  const sectorToday = sectorViews.find((view) =>
    view.members.some((member) => member.ticker === ticker),
  );

  /* Today's turnover against its own fifty-day average. Computed from
     candles the chart already loaded, so it costs nothing — and it is the
     one figure that separates a repricing many participants took part in
     from a drift on a thin tape. */
  const recentCandles = history?.candles.slice(-51) ?? [];
  const volumeRead =
    recentCandles.length === 51
      ? {
          today: recentCandles[recentCandles.length - 1].volume,
          average:
            recentCandles
              .slice(0, 50)
              .reduce((total, candle) => total + candle.volume, 0) / 50,
        }
      : null;

  /* How the sell side's mix moved between the last two published
     periods. Monthly resolution, which is why `why-moving` grades it as
     speculative rather than treating it as an explanation for a day. */
  const analystShift =
    analystViews.length >= 2
      ? {
          bullishNow: analystViews[0].strongBuy + analystViews[0].buy,
          bullishBefore: analystViews[1].strongBuy + analystViews[1].buy,
          total:
            analystViews[0].strongBuy +
            analystViews[0].buy +
            analystViews[0].hold +
            analystViews[0].sell +
            analystViews[0].strongSell,
        }
      : null;

  const movement = whyMoving({
    ticker,
    changePercent: changeToday,
    indexChange: benchmarkToday?.changePercent ?? null,
    sectorChange: sectorToday?.averageMove ?? null,
    sectorLabel: sectorToday?.label ?? null,
    peersAdvancing: sectorToday?.advancing ?? 0,
    peersQuoted: sectorToday?.quoted ?? 0,
    articles,
    volume: volumeRead,
    analysts: analystShift,
  });

  /* ---- The intelligence layer ----
     All four of these are pure composition over data this page already
     loaded, plus two reads of a file the nightly job writes. None of them
     adds a request, which is why they can sit on a page that already fans
     out to SEC and two quote providers. */
  const [thesisChanges, thesisHistory] = await Promise.all([
    changesFor(ticker).catch(() => []),
    historyFor(ticker).catch(() => []),
  ]);

  /* What the multiple implies, converted into a growth rate, and the
     specific measurements that would break it. */
  const expectations = buildExpectationEngine({
    companyName: name,
    fundamentals,
    sector,
    surprises,
  });

  /* The last quarter against four yardsticks rather than one. */
  const earnings = readEarnings({ ticker, surprises, fundamentals });

  /* Everything this company is attached to, as a navigable index. */
  const graph = buildCompanyGraph({
    ticker,
    companyName: name,
    sectorKey: sectorOf(ticker),
    intelligence,
    sector: sectorToday ?? null,
    articles,
    fundamentals,
    history: thesisHistory,
  });

  return (
    <Page>
      {/* ---- Masthead ----
           The one dark band on the page, and the reason it is here rather
           than on a marketing page: this is where a reader arrives from a
           table, and the change of material is what tells them they have
           arrived somewhere rather than filtered something.

           The company's colour appears exactly twice inside it — as the
           rule beside the name, and as the ambient light in the band.
           Never on a figure: the same P/E has to look the same on every
           page of this site. */}
      <header
        id="company-overview"
        className="company-masthead hero-dark on-dark enter relative start-1/2 w-screen -translate-x-1/2 rtl:translate-x-1/2"
        style={{ marginInlineStart: "calc(var(--rail-w) / -2)" }}
      >
      {/* The sector's photograph, drifting behind the type. One frame
          serves every company filed under that sector, which is why it is
          a place and never a business. */}
      <SectorBackdrop sector={sectorOf(ticker)} />
      <div className="relative mx-auto max-w-[1440px] px-5 pb-10 pt-10 sm:px-8 sm:pb-12 sm:pt-14">
        <nav className="mb-7 text-[12px] text-ink-faint">
          <Link href="/" className="transition-colors hover:text-ink">
            שוק
          </Link>
          <span className="mx-2 text-ink-ghost">/</span>
          {identity.sectorLabel && (
            <>
              <span className="text-ink-faint">{identity.sectorLabel}</span>
              <span className="mx-2 text-ink-ghost">/</span>
            </>
          )}
          <span className="num text-ink-muted">{ticker}</span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-7">
          <div className="min-w-0">
            {/* The mark, not a 3px bar. This page is where someone arrives
                from search and has to know in one glance which company they
                landed on; the board already identifies every row this way
                and the page it leads to was the one place that did not. */}
            <div className="flex items-center gap-3.5">
              <CompanyMark ticker={ticker} size="lg" />
              <h1 className="display min-w-0">{name}</h1>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-ink-faint">
              <span className="num rounded border border-line px-1.5 py-0.5 text-ink-muted">
                {ticker}
              </span>
              {profile?.exchange && <span>{profile.exchange}</span>}
              {profile?.industry && <span>· {profile.industry}</span>}
            </div>

            {/* The three things a reader does next from here: follow it,
                research it, or line it up against something else. */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <WatchButton ticker={ticker} />
              <Link
                href={`/research?ticker=${ticker}`}
                className="btn btn-ghost px-2.5 py-1.5 text-[12px]"
              >
                מחקר עומק
              </Link>
              <Link
                href={`/compare?tickers=${ticker}`}
                className="btn btn-ghost px-2.5 py-1.5 text-[12px]"
              >
                השוואה
              </Link>
            </div>
          </div>

          {/* The price first, then what it is being judged against.

               Everything in this row used to be a valuation figure and the
               quote itself was in chapter two, below the fold — so the page
               answered "is it expensive" before it answered "what does it
               cost". The order is the argument: the price is the fact, the
               multiples are the reading of it. */}
          <div className="flex flex-wrap items-end gap-x-10 gap-y-5">
            <CompanyPriceTag
              symbol={ticker}
              initial={quote ? { ...quote, at: quote.at.toISOString() } : null}
              extended={extended}
            />
            {marketCap !== null && (
              <Stat label="שווי שוק" value={`${fmtCompact(marketCap)}`} />
            )}
            {pe && (
              <Stat
                label="P/E"
                value={fmtMetric(pe.value, pe.unit)}
                sub={
                  sector?.medians.pe != null
                    ? `חציון ${sector.label} ${fmtMetric(sector.medians.pe, "x")}`
                    : undefined
                }
              />
            )}
            {growth && (
              <Stat
                label="צמיחת הכנסות 3ש׳"
                value={fmtMetric(growth.value, growth.unit)}
                sub={
                  sector?.medians.rev_cagr_3 != null
                    ? `חציון ${fmtMetric(sector.medians.rev_cagr_3, "%")}`
                    : undefined
                }
              />
            )}
            {fundamentals.asOf && (
              <Stat
                label="דוח אחרון"
                value={
                  <span className="text-base">
                    {fmtDate(fundamentals.asOf.end)}
                  </span>
                }
                sub={
                  sector
                    ? `מושווה מול ${sector.label} (${sector.peerCount})`
                    : undefined
                }
              />
            )}
          </div>
        </div>
      </div>
      </header>

      <ChapterNav label="ניווט בניתוח החברה" chapters={[
        { id: "company-overview", label: "מבט חברה" },
        ...(history ? [{ id: "company-price", label: "מחיר ומגמה" }] : []),
        { id: "company-news", label: "חדשות" },
        { id: "company-capital", label: "איכות הרווח" },
        ...(intelligence ? [{ id: "company-thesis", label: "התזה" }] : []),
        ...(fundamentals.groups.length ? [{ id: "company-financials", label: "נתונים כספיים" }] : []),
        { id: "company-connections", label: "קשרים" },
      ]} />
      <div className="mt-6"><EvidenceKey /></div>
      {fundamentals.stale && (
        <p
          className="surface mt-8 border-s-2 px-5 py-4 text-sm text-ink"
          style={{ borderInlineStartColor: "var(--color-warning)" }}
        >
          הנתונים הכספיים מבוססים על דוח שהוגש לפני יותר מ-120 יום. ייתכן
          שהמצב העסקי השתנה מאז.
        </p>
      )}

      {/* A flex column, so the phone can lead with the price without the
          desktop losing its argument.

          The desktop order is deliberate — the view first, then the
          evidence — but on a phone that buries the last price four
          scrolls down, and the price is the reason most visits to a
          company page happen at all. `order-first` moves one section and
          leaves every other in place. */}
      <div className="flex flex-col">

      {/* ---- Did anything change ----
           Above the view rather than below it, because a reader returning
           to a company they already read does not need the position
           restated — they need to know whether it still says what it said.
           Absent entirely on a company whose measurements have not moved,
           which is most of them on most days. */}
      {thesisChanges.length > 0 && (
        <Section
          eyebrow="שינוי בתזה"
          title="מה האתר אמר קודם, ומה הוא אומר עכשיו"
          description="זוהה בהשוואה בין שתי מדידות שמורות. ההבחנה שהכול תלוי בה היא האם הקלטים המדודים השתנו — דוח חדש — או שרק המחיר זז ואיתו המכפיל."
        >
          <div className="space-y-4">
            {thesisChanges.slice(0, 2).map((change) => (
              <ThesisChangePanel key={change.to} change={change} />
            ))}
          </div>
        </Section>
      )}

      {/* ---- The view, before anything else.
           A reader who stops here should still leave with the position, the
           condition it rests on, and what would break it. Everything below
           is the evidence for arguing with it. ---- */}
      {outlook && (
        <Section
          eyebrow="השורה התחתונה"
          title={`מה אומרים הנתונים על ${name}`}
          description="עמדה מנומקת, לא דירוג: מה הנתונים מראים, מה צריך לקרות כדי שזה יעבוד, ומה היה הופך את התמונה. כולל מה שעדיין לא נמצא בדוחות."
        >
          <OutlookPanel outlook={outlook} ticker={ticker} />
        </Section>
      )}

      {/* ---- What is coming that the filings cannot contain ----
           Placed here, directly under the bottom line, and not with the
           evidence below it. For a company whose next filing will be
           dominated by a dated product release, that date is not
           supporting material — it is the thing. Burying it under nine
           sections of history would be the failure the brief calls out.

           Same table the homepage and the launch page read. Written once,
           because the date on this entry has already moved twice. ---- */}
      {catalysts.length > 0 && (
        <Section
          eyebrow="זרזים"
          title="אירועים שהדוחות עדיין לא מכילים"
          description="מה שנמסר על ידי החברה עצמה, עם המקור לצידו. אין כאן תחזית ואין מספר — רק מה האירוע, איזה קו בדוח הוא מזיז, ומה יאשר או ישבור אותו."
        >
          <div className="grid gap-4">
            {catalysts.map((event) => (
              <EventCard
                key={event.title}
                when={event.window ?? "טרם הוכרז"}
                title={event.title}
                status={
                  event.status === "confirmed"
                    ? "תאריך מאושר"
                    : event.status === "indicated"
                      ? "חלון שהוכרז"
                      : "לא הוכרז"
                }
                body={
                  <>
                    <p>{event.why}</p>

                    {event.scope && event.scope.length > 0 && (
                      <>
                        <p className="eyebrow mt-4">מה ההכרזה מכסה</p>
                        <ul className="mt-1.5 flex flex-wrap gap-2">
                          {event.scope.map((item) => (
                            <li key={item} className="pill">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    <p className="eyebrow mt-4">מה לעקוב אחריו</p>
                    <p className="mt-1.5">{event.watch}</p>

                    {/* The delays are part of the fact. A date given once
                        and a date given three times are different claims,
                        and only one of them is visible without this. */}
                    {event.history && event.history.length > 0 && (
                      <>
                        <p className="eyebrow mt-4">תאריכים קודמים</p>
                        <ul className="mt-1.5 space-y-1">
                          {event.history.map((step) => (
                            <li key={step.date} className="text-ink-faint">
                              <span className="num">{step.date}</span> — {step.note}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </>
                }
                source={
                  <>
                    {event.sourceUrl ? (
                      <Link
                        href={event.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                      >
                        {event.source}
                      </Link>
                    ) : (
                      event.source
                    )}
                    <span className="text-ink-ghost">
                      {" · "}נבדק מול המקור ב-
                      <span className="num">{fmtDate(event.verifiedAt)}</span>
                    </span>
                  </>
                }
              />
            ))}
          </div>
        </Section>
      )}

      {/* ---- What the market is paying for, against what arrived ---- */}
      {gap && (
        <Section
          eyebrow="פער ציפיות"
          title="מה המחיר מגלם, ומה הדוחות מראים"
          description="מכפיל הוא משפט על העתיד שנכתב במספר אחד. כאן הוא מוצג מול מה שכבר דווח — וכשהשניים לא מסתדרים, אי-ההסכמה היא הממצא."
        >
          <ExpectationGapPanel gap={gap} />
        </Section>
      )}

      {/* ---- The same question, made falsifiable ----
           The gap above says the premium exists. This converts it into a
           growth rate and names the measurements that would break it,
           which is the difference between "expensive" — an opinion nobody
           can check — and a threshold next quarter either crosses or does
           not. */}
      {expectations && (
        <Section
          eyebrow="מנוע הציפיות"
          title="מה היה מפתיע את השוק"
          description="המרה אריתמטית מפרמיית מכפיל לקצב צמיחה נדרש, ומולה הקצב שנמסר בפועל. כל הנחה שהחישוב נשען עליה מודפסת מתחתיו."
          tight
        >
          <ExpectationEnginePanel engine={expectations} />
        </Section>
      )}

      {/* ---- The last report, against four yardsticks ---- */}
      {earnings && (
        <Section
          eyebrow="הדוח האחרון"
          title="מה הוא אמר, מול ארבע אמות מידה"
          description="הכאה מול קונצנזוס שנחתך פעמיים ברבעון אינה אותו אירוע כמו הכאה מול המספר שהוחזק כל הדרך. לכן ההשוואה נעשית גם מול הרבעון הקודם, גם מול אותו רבעון אשתקד, וגם מול שיא ההכאות."
          tight
        >
          <EarningsReadPanel read={earnings} />
        </Section>
      )}

      {/* ---- The Core Test: quantitative, trailing, pass or fail ---- */}
      {intelligence && (
        <Section
          eyebrow="מבחן הליבה"
          description="בדיקה כמותית על מה שכבר דווח. היא מסתכלת אחורה בהגדרה — וחברה יכולה להיכשל בה ועדיין להיות מעניינת, וזה בדיוק מה שהתזה שמתחת בודקת."
        >
          <VerdictPanel verdict={intelligence.verdict} />
        </Section>
      )}

      {/* ---- Price ---- */}
      {/* The session strip is its own section rather than part of the chart
          block. It was inside it first, which tied "what did this do before
          the bell" to whether a year of daily candles happened to load —
          two different fetches from two different endpoints, and the one
          that fails more often was gating the one that matters most at
          seven in the morning. */}
      {extended && (
        <Section
          id="company-session"
          eyebrow="מחוץ לשעות המסחר"
          title="לפני הפתיחה ואחרי הסגירה"
          className="max-lg:order-first"
        >
          <ExtendedHoursStrip data={extended} />
        </Section>
      )}

      {history && (
        <Section
          id="company-price"
          eyebrow="מחיר ומגמה"
          title="מה המחיר כבר עשה"
          className="max-lg:order-first"
        >
          <CompanyChart
            symbol={ticker}
            name={name}
            /* Five years when the longer fetch came back, the analysis
               series when it did not. The switcher below is told which one
               it is holding, so the label and the bars cannot disagree —
               that exact mismatch shipped once, with the chart drawing 501
               bars under a tab that claimed 252. */
            candles={(chartHistory ?? history).candles}
            seededRange={chartHistory ? "5Y" : "2Y"}
            levels={chartLevels}
            markers={chartMarkers}
            initial={quote ? { ...quote, at: quote.at.toISOString() } : null}
          />

          {/* The caption, not a chapter: a chart nobody can read is a
              decoration, and the numbers it is drawn from are already here. */}
          {movement && <WhyMovingPanel reading={movement} />}

          {chartReading && <ChartExplainer reading={chartReading} />}
        </Section>
      )}

      {/* ---- The news corner ----
           Directly under the price, and the placement is the argument. It
           used to be the last section on the page, below twenty-three
           metric cells, which is where a reader stops looking — and what
           was asked for is the opposite: open a company and see what is
           being said about it. The panel directly above has just said
           whether the move belongs to the index, to the sector or to the
           company; this is where the reader finds out what happened.

           `order-first` on a phone, for the same reason the price carries
           it. The three sections that share it keep their relative order,
           so a phone reads session, price, news — and the whole valuation
           argument follows underneath. ---- */}
      <Section
        id="company-news"
        eyebrow="חדשות"
        title={`מה נכתב על ${name}`}
        description={`שני מקורות חיים — החוט של Finnhub לסימול ${ticker} והפיד הסקטוריאלי של האתר — מהחדשה לישנה. ליד כל כתבה נכתב אם היא זרז או רעש: זו קביעה על המנגנון, לא המלצה לפעולה.`}
        className="max-lg:order-first"
      >
        <CompanyNewsCorner ticker={ticker} name={name} news={news} />
      </Section>

      <LevelsPanel levels={priceLevels} flow={flow} />

      {/* The volume, ranked. `LevelsPanel` above already reports the flow —
          what share of the window's shares traded on up days, how many
          heavy days there were — which answers the question in aggregate.
          This answers it bar by bar: what the last session was, where it
          ranks in the instrument's own year, and what that kind of session
          has been followed by here. The two are different questions and
          the aggregate one cannot stand in for the specific one. */}
      <Section eyebrow="קריאת מחזור">
        <TapePanel
          tape={tape}
          rates={baseRates}
          ticker={ticker}
          lastClose={history?.candles.at(-1)?.close ?? 0}
          earnings={
            nextReport ? { date: nextReport, sessionsAway: sessionsToReport } : null
          }
        />
      </Section>

      {technical && (
        <Section eyebrow="ניתוח טכני">
          <TechnicalPanel technical={technical} />
        </Section>
      )}

      {/* Straight after the technical read, because it is the question
          that read always raises and never answered: the page would name
          the setup and stop. This says what the same setup was followed
          by on this instrument, and — the part that matters — what a
          random day in the same window was followed by. */}
      <BaseRatePanel read={baseRates} />

      <Section id="company-capital" eyebrow="איכות הרווח">
        <CapitalPanel capital={capital} />
      </Section>

      {/* ---- The Investment Thesis: forward-looking, evidence-bound ---- */}
      {intelligence && (
        <Section
          id="company-thesis"
          eyebrow="תזת השקעה"
          title="האם יש סיבה מבוססת שהשוק יתמחר אחרת"
          description="שאלה אחרת לגמרי ממבחן הליבה. כאן נבדק אם קיים גורם מתועד — אירוע, מגמה או פער תמחור — שעשוי לשנות את התמונה קדימה."
        >
          <IntelligencePanel intelligence={intelligence} />
        </Section>
      )}

      {/* ---- Evidence ----
           One border around the whole group and hairlines inside it,
           rather than a panel per metric. Twenty-three boxed cards was
           the single loudest thing on a company page, and the figures
           inside them were the quietest. */}
      {fundamentals.groups.map((group, index) => (
        <Section id={index === 0 ? "company-financials" : undefined} key={group.title} eyebrow="נתונים" title={group.title}>
          <Band columns={6}>
            {group.metrics.map((item) => {
              const median = sector?.medians[item.key] ?? null;
              const comparison = compareToSector(item.value, median);

              return (
                <Field
                  key={item.key}
                  label={item.label}
                  value={
                    <span
                      className={item.value === null ? "text-ink-ghost" : ""}
                    >
                      {fmtMetric(item.value, item.unit)}
                    </span>
                  }
                  /* Rule 5: a figure never appears without what it should
                     be measured against. When the sector has no median for
                     this metric, the hint says why rather than the cell
                     going quiet. */
                  context={
                    median !== null ? (
                      <span className="flex items-center gap-1.5">
                        <span>
                          סקטור{" "}
                          <span className="num">
                            {fmtMetric(median, item.unit)}
                          </span>
                        </span>
                        {comparison && (
                          <span className="num text-ink-ghost">
                            {comparison.higher ? "▲" : "▼"}
                            {Math.abs(comparison.differencePercent).toFixed(0)}%
                          </span>
                        )}
                      </span>
                    ) : (
                      item.hint
                    )
                  }
                />
              );
            })}
          </Band>
        </Section>
      ))}

      <Section eyebrow="מגמות רב-שנתיות">
        <div className="grid gap-4 lg:grid-cols-2">
          <RevenueChart
            series={fundamentals.revenueSeries}
            title="הכנסות שנתיות"
            ariaLabel={`הכנסות שנתיות של ${ticker}`}
          />
          <RevenueChart
            series={fundamentals.operatingIncomeSeries}
            title="רווח תפעולי שנתי"
            ariaLabel={`רווח תפעולי שנתי של ${ticker}`}
          />
        </div>
      </Section>

      {/* ---- Everything this connects to ----
           Near the end on purpose. It is the index out of this page and
           into the rest of the site, and an index belongs after the thing
           it indexes. */}
      <Section
        id="company-connections"
        eyebrow="קשרים"
        title={`מה עוד מחובר ל-${ticker}`}
        description={`${graph.count} קשרים, כל אחד עם הסיבה שהוא קיים ועם דרגת הראיות שמאחוריה. קישור מאקרו מסומן כהשערה ויושב ליד קישור סקטור שמסומן כמאושש — וההשוואה הזאת היא מה שדיאגרמה הייתה משטחת.`}
      >
        <ConnectionIndex graph={graph} />
      </Section>
      </div>

      <WorkflowLinks ticker={ticker} title="מהראיות אל השאלה הבאה" />

      <Disclaimer extra="הנתונים הכספיים נשאבים מדוחות שהחברה הגישה ל-SEC. מדד המוצג כ-&quot;—&quot; אינו זמין בדוחות ולא הוערך." />
    </Page>
  );
}
