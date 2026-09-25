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
import { readChart } from "@/lib/analysis/chart-read";
import { Disclaimer, Page, Section, Stat } from "@/components/ui";
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

  return (
    <Page tint={identity.accent}>
      {/* ---- Masthead ---- */}
      <header className="enter border-b border-line pb-8 pt-12 sm:pt-16">
        <nav className="mb-6 text-[12px] text-ink-faint">
          <Link href="/" className="transition-colors hover:text-ink">
            שוק
          </Link>
          <span className="mx-2 text-ink-ghost">/</span>
          <span className="num text-ink-muted">{ticker}</span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span
                className="h-8 w-[3px] rounded-full"
                style={{ background: identity.accent }}
                aria-hidden="true"
              />
              <h1 className="display">{name}</h1>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-faint">
              <span className="num rounded border border-line px-1.5 py-0.5 text-ink-muted">
                {ticker}
              </span>
              {profile?.exchange && <span>{profile.exchange}</span>}
              {profile?.industry && <span>· {profile.industry}</span>}
              {identity.sectorLabel && <span>· {identity.sectorLabel}</span>}
            </div>

            {/* The three things a reader does next from here: follow it,
                research it, or line it up against something else. */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
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

          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {marketCap !== null && (
              <Stat label="שווי שוק" value={`$${fmtCompact(marketCap)}`} />
            )}
            {pe && (
              <Stat label="P/E" value={fmtMetric(pe.value, pe.unit)} />
            )}
            {growth && (
              <Stat
                label="צמיחת הכנסות 3ש׳"
                value={fmtMetric(growth.value, growth.unit)}
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
        <p className="surface mt-8 px-5 py-4 text-sm text-ink">
          הנתונים הכספיים מבוססים על דוח שהוגש לפני יותר מ-120 יום. ייתכן
          שהמצב העסקי השתנה מאז.
        </p>
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
        <Section eyebrow="מחיר ומגמה" title="מה המחיר כבר עשה">
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

      {/* ---- Evidence ---- */}
      {fundamentals.groups.map((group) => (
        <Section key={group.title} eyebrow="נתונים" title={group.title}>
          <div className="surface grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {group.metrics.map((item, i) => {
              const median = sector?.medians[item.key] ?? null;
              const comparison = compareToSector(item.value, median);

              return (
                <div
                  key={item.key}
                  className={`px-4 py-4 ${
                    i % 2 === 1 ? "border-s border-line" : ""
                  } sm:[&:not(:nth-child(3n+1))]:border-s sm:border-line lg:[&:not(:nth-child(6n+1))]:border-s ${
                    i >= 2 ? "border-t border-line" : ""
                  }`}
                >
                  <div className="text-[11px] text-ink-faint">{item.label}</div>
                  <div
                    className={`num mt-1.5 text-[17px] ${
                      item.value === null ? "text-ink-ghost" : "text-ink"
                    }`}
                  >
                    {fmtMetric(item.value, item.unit)}
                  </div>

                  {median !== null ? (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-ink-ghost">
                      <span>
                        סקטור{" "}
                        <span className="num">
                          {fmtMetric(median, item.unit)}
                        </span>
                      </span>
                      {comparison && (
                        <span className="num">
                          {comparison.higher ? "▲" : "▼"}
                          {Math.abs(comparison.differencePercent).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  ) : (
                    item.hint && (
                      <div className="mt-1.5 text-[10px] leading-snug text-ink-ghost">
                        {item.hint}
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
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

      {/* ---- News ---- */}
      <Section eyebrow="חדשות" title={`מה נכתב על ${name}`}>
        {articles.length === 0 ? (
          <p className="surface px-5 py-5 text-[13px] text-ink-muted">
            לא נמצאו כתבות עדכניות שמזכירות את החברה בפיד הנוכחי.
          </p>
        ) : (
          <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.url} article={article} />
            ))}
          </div>
        )}
      </Section>

      <Disclaimer extra="הנתונים הכספיים נשאבים מדוחות שהחברה הגישה ל-SEC. מדד המוצג כ-&quot;—&quot; אינו זמין בדוחות ולא הוערך." />
    </Page>
  );
}
