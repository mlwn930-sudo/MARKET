import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuote } from "@/lib/sources/finnhub";
import { getPriceHistory } from "@/lib/sources/prices";
import { getCompanyAnalysis, getTechnicalRead } from "@/lib/company-analysis";
import { getArticlesForTicker } from "@/lib/news-store";
import { compareToSector, getSectorContext } from "@/lib/fundamentals-store";
import { identityFor } from "@/lib/company-identity";
import { getCompanyIntelligence } from "@/lib/agents";
import { CompanyChart } from "@/components/CompanyChart";
import type { ChartLevel, ChartMarker } from "@/components/LiveChart";
import { VerdictPanel } from "@/components/VerdictPanel";
import { IntelligencePanel } from "@/components/IntelligencePanel";
import { TechnicalPanel } from "@/components/TechnicalPanel";
import { CapitalPanel } from "@/components/CapitalPanel";
import { RevenueChart } from "@/components/RevenueChart";
import { ArticleCard } from "@/components/ArticleCard";
import { WatchButton } from "@/components/WatchButton";
import { OutlookPanel } from "@/components/OutlookPanel";
import { ChartExplainer } from "@/components/ChartExplainer";
import { buildOutlook } from "@/lib/analysis/outlook";
import { whyMoving } from "@/lib/analysis/why-moving";
import { buildExpectationGap } from "@/lib/analysis/expectation-gap";
import { ExpectationGapPanel } from "@/components/ExpectationGapPanel";
import { getEarningsSurprises } from "@/lib/sources/finnhub";
import { WhyMovingPanel } from "@/components/WhyMovingPanel";
import { getSectorViews } from "@/lib/sectors";
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
  Empty,
  Field,
  Page,
  Section,
  Stat,
} from "@/components/ui";
import { fmtCompact, fmtDate, fmtMetric } from "@/lib/format";

export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const symbol = decodeURIComponent(ticker).toUpperCase();
  return {
    title: `${symbol} — ניתוח מלא`,
    description: `ניתוח פונדמנטלי, טכני ואיכות הון של ${symbol}, מול חציון הסקטור ועם מחיר חי.`,
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
  const [analysis, intelligence, quote, history, technical, sector, articles] =
    await Promise.all([
      getCompanyAnalysis(ticker),
      // The full agent pipeline, cached as its finished report. See
      // lib/agents/index.ts for why not every agent runs on every request.
      getCompanyIntelligence(ticker),
      getQuote(ticker).catch(() => null),
      getPriceHistory(ticker).catch(() => null),
      getTechnicalRead(ticker).catch(() => null),
      getSectorContext(ticker),
      getArticlesForTicker(ticker, 6),
    ]);

  if (!analysis) notFound();

  const { profile, marketCap, fundamentals, capital, title } = analysis;
  const name = profile?.name ?? title;


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
  const [benchmarkToday, sectorViews, surprises] = await Promise.all([
    getFallbackQuote("^GSPC").catch(() => null),
    getSectorViews().catch(() => []),
    getEarningsSurprises(ticker).catch(() => []),
  ]);

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

  const movement = whyMoving({
    ticker,
    changePercent: quote?.changePercent ?? null,
    indexChange: benchmarkToday?.changePercent ?? null,
    sectorChange: sectorToday?.averageMove ?? null,
    sectorLabel: sectorToday?.label ?? null,
    peersAdvancing: sectorToday?.advancing ?? 0,
    peersQuoted: sectorToday?.quoted ?? 0,
    articles,
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
    <Page tint={identity.accent}>
      {/* ---- Masthead ----
           The company's colour appears exactly twice: as the rule beside
           its name, and as the page's ambient tint. Not on one figure. */}
      <header className="enter border-b border-line pb-9 pt-12 sm:pt-16">
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
            <div className="flex items-center gap-3.5">
              <span
                className="h-9 w-[3px] shrink-0 rounded-full"
                style={{ background: identity.accent }}
                aria-hidden="true"
              />
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

          <div className="flex flex-wrap gap-x-10 gap-y-5">
            {marketCap !== null && (
              <Stat label="שווי שוק" value={`$${fmtCompact(marketCap)}`} />
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
      </header>

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
      {history && (
        <Section
          eyebrow="מחיר ומגמה"
          title="מה המחיר כבר עשה"
          className="max-lg:order-first"
        >
          <CompanyChart
            symbol={ticker}
            name={name}
            candles={history.candles}
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

      {technical && (
        <Section eyebrow="ניתוח טכני">
          <TechnicalPanel technical={technical} />
        </Section>
      )}

      <Section eyebrow="איכות הרווח">
        <CapitalPanel capital={capital} />
      </Section>

      {/* ---- The Investment Thesis: forward-looking, evidence-bound ---- */}
      {intelligence && (
        <Section
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
      {fundamentals.groups.map((group) => (
        <Section key={group.title} eyebrow="נתונים" title={group.title}>
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
        eyebrow="קשרים"
        title={`מה עוד מחובר ל-${ticker}`}
        description={`${graph.count} קשרים, כל אחד עם הסיבה שהוא קיים ועם דרגת הראיות שמאחוריה. קישור מאקרו מסומן כהשערה ויושב ליד קישור סקטור שמסומן כמאושש — וההשוואה הזאת היא מה שדיאגרמה הייתה משטחת.`}
      >
        <ConnectionIndex graph={graph} />
      </Section>

      {/* ---- News ---- */}
      <Section eyebrow="חדשות" title={`מה נכתב על ${name}`}>
        {articles.length === 0 ? (
          <Empty
            title="אין כרגע כתבה בפיד שמזכירה את החברה"
            reason="הפיד נבנה מכמה עשרות מקורות ומתרענן כל עשרים דקות. חברה שלא הייתה בכותרות ביממה האחרונה פשוט לא מופיעה בו — זה לא סימן לכלום."
            links={[
              { href: "/news", label: "כל החדשות" },
              {
                href: `/research?ticker=${ticker}`,
                label: `מחקר עומק על ${ticker}`,
              },
              { href: "/brief", label: "התדריך של היום" },
            ]}
          />
        ) : (
          <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.url} article={article} />
            ))}
          </div>
        )}
      </Section>
      </div>

      <Disclaimer extra="הנתונים הכספיים נשאבים מדוחות שהחברה הגישה ל-SEC. מדד המוצג כ-&quot;—&quot; אינו זמין בדוחות ולא הוערך." />
    </Page>
  );
}
