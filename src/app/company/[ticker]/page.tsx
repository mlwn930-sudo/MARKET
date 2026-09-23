import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuote } from "@/lib/sources/finnhub";
import { getPriceHistory } from "@/lib/sources/prices";
import { getCompanyAnalysis } from "@/lib/company-analysis";
import { getArticlesForTicker } from "@/lib/news-store";
import { compareToSector, getSectorContext } from "@/lib/fundamentals-store";
import { identityFor, tint } from "@/lib/company-identity";
import { RevenueChart } from "@/components/RevenueChart";
import { CandleChart } from "@/components/CandleChart";
import { ArticleCard } from "@/components/ArticleCard";
import {
  directionClass,
  fmtChange,
  fmtCompact,
  fmtDate,
  fmtMetric,
  fmtPercent,
  fmtPrice,
} from "@/lib/format";

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
    description: `מכפילים, רווחיות, תזרים, גרף מחיר עם ממוצעים נעים וחדשות עדכניות על ${symbol}.`,
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
  const [analysis, quote, history, sector, articles] = await Promise.all([
    getCompanyAnalysis(ticker),
    getQuote(ticker).catch(() => null),
    getPriceHistory(ticker).catch(() => null),
    getSectorContext(ticker),
    getArticlesForTicker(ticker, 6),
  ]);

  if (!analysis) notFound();

  const { profile, marketCap, fundamentals, title } = analysis;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <nav className="mb-5 text-xs text-ink-muted">
        <Link href="/" className="hover:text-ink">
          ← חזרה לדשבורד
        </Link>
      </nav>

      {/* The accent band is the whole visual identity of the page: it is the
          first thing seen and it carries through to the chart line below. */}
      <header
        className="overflow-hidden rounded-2xl border border-line"
        style={{
          background: `linear-gradient(135deg, ${tint(identity.accent, 0.16)}, transparent 60%)`,
        }}
      >
        <div
          className="h-1 w-full"
          style={{ background: identity.accent }}
          aria-hidden="true"
        />
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div>
            <h1 className="text-2xl">{profile?.name ?? title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              <span
                className="num rounded px-1.5 py-0.5 font-medium"
                style={{
                  background: tint(identity.accent, 0.18),
                  color: identity.accent,
                }}
              >
                {ticker}
              </span>
              {profile?.exchange && <span>{profile.exchange}</span>}
              {profile?.industry && <span>· {profile.industry}</span>}
            </p>
          </div>

          {quote && (
            <div className="text-left">
              <div className="num text-3xl">{fmtPrice(quote.price)}</div>
              <div
                className={`num text-sm ${directionClass(quote.changePercent)}`}
              >
                {fmtChange(quote.change)} ({fmtPercent(quote.changePercent)})
              </div>
            </div>
          )}
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
            <span className="num text-ink">{fmtDate(fundamentals.asOf.end)}</span>
          </span>
        )}
        {sector && (
          <span>
            מושווה מול <span className="text-ink">{sector.label}</span>
            <span className="num"> ({sector.peerCount} חברות)</span>
          </span>
        )}
      </div>

      {fundamentals.stale && (
        <p className="mt-4 rounded-lg border border-line-strong bg-surface px-4 py-3 text-sm text-ink">
          הנתונים הכספיים מבוססים על דוח שהוגש לפני יותר מ-120 יום. ייתכן
          שהמצב העסקי השתנה מאז.
        </p>
      )}

      {history && (
        <section className="mt-6">
          <h2 className="mb-3 text-base">מחיר ומגמה</h2>
          <CandleChart history={history} accent={identity.accent} />
        </section>
      )}

      {fundamentals.groups.map((group) => (
        <section key={group.title} className="mt-8">
          <h2 className="mb-3 text-base">{group.title}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {group.metrics.map((metric) => {
              const median = sector?.medians[metric.key] ?? null;
              const comparison = compareToSector(metric.value, median);

              return (
                <div key={metric.key} className="rounded-xl bg-surface px-3 py-3">
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

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
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

      <section className="mt-10">
        <h2 className="mb-3 text-base">
          חדשות על {profile?.name ?? ticker}
        </h2>
        {articles.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-4 text-xs text-ink-muted">
            לא נמצאו כתבות עדכניות שמזכירות את החברה בפיד הנוכחי.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

      <p className="mt-10 text-xs leading-relaxed text-ink-faint">
        הנתונים הכספיים נשאבים מדוחות שהחברה הגישה ל-SEC. מדד המוצג
        כ-&quot;—&quot; אינו זמין בדוחות ולא הוערך. היסטוריית המחירים מגיעה
        ממקור חיצוני ועשויה להיות חסרה. אין באמור ייעוץ השקעות.
      </p>
    </main>
  );
}
