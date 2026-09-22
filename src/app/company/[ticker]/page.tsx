import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuote } from "@/lib/sources/finnhub";
import { getCompanyAnalysis } from "@/lib/company-analysis";
import { RevenueChart } from "@/components/RevenueChart";
import {
  compareToSector,
  getSectorContext,
} from "@/lib/fundamentals-store";
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

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: raw } = await params;
  const ticker = decodeURIComponent(raw).toUpperCase();

  // Filings and metrics come from the hourly cache; the quote is fetched
  // fresh every time, because a price cached for an hour is a wrong price.
  const [analysis, quoteResult] = await Promise.all([
    getCompanyAnalysis(ticker),
    getQuote(ticker).catch(() => null),
  ]);

  if (!analysis) notFound();

  const { profile: profileResult, marketCap, fundamentals } = analysis;
  const listing = { title: analysis.title };

  // Sector benchmark from the precomputed universe. Null when the company
  // is outside it, in which case every metric renders without a comparison
  // rather than against a made-up baseline.
  const sector = await getSectorContext(ticker);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <nav className="mb-6 text-xs text-ink-muted">
        <Link href="/" className="hover:text-ink">
          ← חזרה לדשבורד
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="text-2xl">{profileResult?.name ?? listing.title}</h1>
          <p className="mt-1 text-xs text-ink-muted">
            <span className="num">{ticker}</span>
            {profileResult?.exchange && ` · ${profileResult.exchange}`}
            {profileResult?.industry && ` · ${profileResult.industry}`}
          </p>
        </div>
        {quoteResult && (
          <div className="text-left">
            <div className="num text-3xl">{fmtPrice(quoteResult.price)}</div>
            <div
              className={`num text-sm ${directionClass(quoteResult.changePercent)}`}
            >
              {fmtChange(quoteResult.change)} (
              {fmtPercent(quoteResult.changePercent)})
            </div>
          </div>
        )}
      </header>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-muted">
        {marketCap !== null && (
          <span>
            שווי שוק <span className="num text-ink">${fmtCompact(marketCap)}</span>
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
        {fundamentals.asOf && (
          <span>
            הוגש{" "}
            <span className="num text-ink">
              {fmtDate(fundamentals.asOf.filed)}
            </span>
          </span>
        )}
        {sector && (
          <span>
            מושווה מול{" "}
            <span className="text-ink">{sector.label}</span>
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

      {fundamentals.groups.map((group) => (
        <section key={group.title} className="mt-8">
          <h2 className="mb-3 text-base">{group.title}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {group.metrics.map((metric) => {
              const sectorMedian = sector?.medians[metric.key] ?? null;
              const comparison = compareToSector(metric.value, sectorMedian);

              return (
                <div
                  key={metric.key}
                  className="rounded-xl bg-surface px-4 py-3"
                >
                  <div className="num text-[11px] text-ink-muted">
                    {metric.label}
                  </div>
                  <div
                    className={`num mt-1 text-xl ${
                      metric.value === null ? "text-ink-faint" : "text-ink"
                    }`}
                  >
                    {fmtMetric(metric.value, metric.unit)}
                  </div>

                  {sectorMedian !== null ? (
                    <div className="mt-1.5 flex items-baseline gap-1.5 text-[10px] text-ink-muted">
                      <span>
                        סקטור{" "}
                        <span className="num">
                          {fmtMetric(sectorMedian, metric.unit)}
                        </span>
                      </span>
                      {comparison && (
                        <span className="num text-ink-faint">
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
          ariaLabel={`הכנסות שנתיות של ${ticker} לאורך השנים האחרונות`}
        />
        <RevenueChart
          series={fundamentals.operatingIncomeSeries}
          title="רווח תפעולי שנתי"
          ariaLabel={`רווח תפעולי שנתי של ${ticker} לאורך השנים האחרונות`}
        />
      </div>

      <p className="mt-8 text-xs leading-relaxed text-ink-faint">
        הנתונים נשאבים מדוחות שהחברה הגישה ל-SEC. מדד המוצג כ-&quot;—&quot;
        אינו זמין בדוחות, ולא הוערך. אין באמור ייעוץ השקעות.
      </p>
    </main>
  );
}
