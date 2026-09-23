import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuote } from "@/lib/sources/finnhub";
import { getPriceHistory } from "@/lib/sources/prices";
import { getCompanyAnalysis, getTechnicalRead } from "@/lib/company-analysis";
import { getArticlesForTicker } from "@/lib/news-store";
import { compareToSector, getSectorContext } from "@/lib/fundamentals-store";
import { identityFor, tint } from "@/lib/company-identity";
import { buildThesis } from "@/lib/analysis/thesis";
import { AccentTheme } from "@/components/AccentTheme";
import { CompanyChart } from "@/components/CompanyChart";
import type { ChartLevel, ChartMarker } from "@/components/LiveChart";
import { ThesisPanel } from "@/components/ThesisPanel";
import { TechnicalPanel } from "@/components/TechnicalPanel";
import { CapitalPanel } from "@/components/CapitalPanel";
import { RevenueChart } from "@/components/RevenueChart";
import { ArticleCard } from "@/components/ArticleCard";
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
    title: `${symbol} — ניתוח מלא | Market Intel`,
    description: `ניתוח פונדמנטלי, טכני ואיכות הון של ${symbol}, מול חציון הסקטור ועם מחיר חי.`,
  };
}

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
  const [analysis, quote, history, technical, sector, articles] =
    await Promise.all([
      getCompanyAnalysis(ticker),
      getQuote(ticker).catch(() => null),
      getPriceHistory(ticker).catch(() => null),
      getTechnicalRead(ticker).catch(() => null),
      getSectorContext(ticker),
      getArticlesForTicker(ticker, 6),
    ]);

  if (!analysis) notFound();

  const { profile, marketCap, fundamentals, capital, title } = analysis;
  const name = profile?.name ?? title;

  const thesis = buildThesis(fundamentals, capital, technical, sector, name);

  /**
   * The frameworks' own levels, drawn on the chart.
   *
   * Computed here from the same technical read the analysis panel renders,
   * so the line on the chart and the number in the table cannot disagree.
   * The chart never decides where a pivot or a stop belongs.
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

  // Each contraction low, so the tightening the pattern claims is visible
  // on the chart rather than only described beneath it.
  const chartMarkers: ChartMarker[] =
    technical?.vcp.contractions.map((contraction, i) => ({
      date: contraction.lowDate,
      label: `${i + 1} · ${contraction.depthPercent.toFixed(0)}%`,
    })) ?? [];

  return (
    <>
      <AccentTheme accent={identity.accent} />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <nav className="mb-5 text-xs text-ink-muted">
          <Link href="/" className="transition-colors hover:text-ink">
            ← חזרה לדשבורד
          </Link>
        </nav>

        {/* The accent band is the whole visual identity of the page: it is
            the first thing seen and it carries through to the ambient
            background, the chart line and every hovered panel below. */}
        <header
          className="enter panel overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${tint(identity.accent, 0.16)}, transparent 62%)`,
          }}
        >
          <div
            className="h-1 w-full"
            style={{ background: identity.accent }}
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-start justify-between gap-4 p-5">
            <div>
              <h1 className="text-3xl">{name}</h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <span className="num accent-chip rounded px-1.5 py-0.5 font-medium">
                  {ticker}
                </span>
                {profile?.exchange && <span>{profile.exchange}</span>}
                {profile?.industry && <span>· {profile.industry}</span>}
                {identity.sectorLabel && <span>· {identity.sectorLabel}</span>}
              </p>
            </div>


          </div>
        </header>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-muted">
          {marketCap !== null && (
            <span>
              שווי שוק{" "}
              <span className="num text-ink">${fmtCompact(marketCap)}</span>
            </span>
          )}
          {fundamentals.asOf && (
            <span>
              דוח אחרון{" "}
              <span className="num text-ink">
                {fmtDate(fundamentals.asOf.end)}
              </span>
            </span>
          )}
          {sector && (
            <span>
              מושווה מול <span className="text-ink">{sector.label}</span>{" "}
              {/* Only the digits carry .num. Wrapping the Hebrew word in it
                  too forces the whole phrase left-to-right, which moves the
                  closing bracket to the wrong side. */}
              (<span className="num">{sector.peerCount}</span> חברות)
            </span>
          )}
        </div>

        {fundamentals.stale && (
          <p className="panel mt-4 px-4 py-3 text-sm text-ink">
            הנתונים הכספיים מבוססים על דוח שהוגש לפני יותר מ-120 יום. ייתכן
            שהמצב העסקי השתנה מאז.
          </p>
        )}

        <div className="mt-8">
          <ThesisPanel thesis={thesis} />
        </div>

        {history && (
          <section className="reveal mt-10">
            <h2 className="mb-3 text-base">מחיר ומגמה</h2>
            <CompanyChart
              symbol={ticker}
              name={name}
              candles={history.candles}
              accent={identity.accent}
              levels={chartLevels}
              markers={chartMarkers}
              initial={quote ? { ...quote, at: quote.at.toISOString() } : null}
            />
          </section>
        )}

        {technical && (
          <div className="mt-10">
            <TechnicalPanel technical={technical} />
          </div>
        )}

        <div className="mt-10">
          <CapitalPanel capital={capital} />
        </div>

        {fundamentals.groups.map((group) => (
          <section key={group.title} className="reveal mt-10">
            <h2 className="mb-3 text-base">{group.title}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {group.metrics.map((metric) => {
                const median = sector?.medians[metric.key] ?? null;
                const comparison = compareToSector(metric.value, median);

                return (
                  <div
                    key={metric.key}
                    className="panel panel-interactive px-3 py-3"
                  >
                    <div className="num text-[11px] text-ink-muted">
                      {metric.label}
                    </div>
                    <div
                      className={`num mt-1 text-lg ${
                        metric.value === null ? "text-ink-faint" : "text-ink"
                      }`}
                    >
                      {fmtMetric(metric.value, metric.unit)}
                    </div>

                    {median !== null ? (
                      <div className="mt-1.5 text-[10px] text-ink-muted">
                        <span>
                          סקטור{" "}
                          <span className="num">
                            {fmtMetric(median, metric.unit)}
                          </span>
                        </span>
                        {comparison && (
                          <span className="num mr-1.5 text-ink-faint">
                            {comparison.higher ? "▲" : "▼"}
                            {Math.abs(comparison.differencePercent).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    ) : (
                      metric.hint && (
                        <div className="mt-1 text-[10px] leading-snug text-ink-faint">
                          {metric.hint}
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <div className="reveal mt-10 grid gap-4 lg:grid-cols-2">
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

        <section className="reveal mt-12">
          <h2 className="mb-3 text-base">חדשות על {name}</h2>
          {articles.length === 0 ? (
            <p className="panel px-4 py-4 text-xs text-ink-muted">
              לא נמצאו כתבות עדכניות שמזכירות את החברה בפיד הנוכחי.
            </p>
          ) : (
            <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <ArticleCard
                  key={article.url}
                  article={article}
                  accent={identity.accent}
                />
              ))}
            </div>
          )}
        </section>

        <p className="mt-12 text-xs leading-relaxed text-ink-faint">
          הנתונים הכספיים נשאבים מדוחות שהחברה הגישה ל-SEC. מדד המוצג
          כ-&quot;—&quot; אינו זמין בדוחות ולא הוערך. היסטוריית המחירים מגיעה
          ממקור חיצוני ועשויה להיות חסרה. המסגרות הטכניות והפונדמנטליות
          בעמוד מתארות את מה שכבר קרה ואינן תחזית. אין באמור ייעוץ השקעות,
          שיווק השקעות או תחליף לייעוץ המתחשב בנתוניו של כל אדם.
        </p>
      </main>
    </>
  );
}
