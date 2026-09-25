import Link from "next/link";
import { notFound } from "next/navigation";
import { getSectorView, getSectorViews } from "@/lib/sectors";
import { ArticleCard } from "@/components/ArticleCard";
import {
  Disclaimer,
  Hero,
  MoreLink,
  Page,
  Section,
  StatBar,
  StatCell,
} from "@/components/ui";
import { directionClass, fmtCompact, fmtMetric, fmtPercent, fmtPrice } from "@/lib/format";

export const revalidate = 120;

export async function generateStaticParams() {
  const views = await getSectorViews().catch(() => []);
  return views.map((view) => ({ key: view.key }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const view = await getSectorView(key).catch(() => null);
  return {
    title: view ? `${view.label} — סקטור` : "סקטור",
    description: view?.note ?? "",
  };
}

/**
 * One sector, in full.
 *
 * The structure answers three questions in order: how the group moved,
 * which members caused it, and what the whole set looks like against its
 * own medians. The news at the bottom is the feed's subjects mapped onto
 * this group by hand — the two vocabularies were built for different jobs,
 * and no automatic mapping between them would be right.
 */
export default async function SectorPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const view = await getSectorView(key);
  if (!view) notFound();

  const metrics = [
    { key: "pe", label: "P/E", unit: "x" as const },
    { key: "ev_ebitda", label: "EV/EBITDA", unit: "x" as const },
    { key: "operating_margin", label: "Operating Margin", unit: "%" as const },
    { key: "roic", label: "ROIC", unit: "%" as const },
    { key: "rev_cagr_3", label: "צמיחת הכנסות 3ש׳", unit: "%" as const },
    { key: "fcf_margin", label: "FCF Margin", unit: "%" as const },
    { key: "debt_equity", label: "Debt / Equity", unit: "x" as const },
    { key: "net_debt_ebitda", label: "Net Debt / EBITDA", unit: "x" as const },
  ];

  return (
    <Page tint="#0a84ff" width="wide">
      <Hero
        eyebrow="סקטור"
        title={view.label}
        lede={view.note}
        stats={
          <StatBar>
            <StatCell
              label="תנועת היום (ממוצע שווה)"
              value={fmtPercent(view.averageMove)}
              sub={`${view.advancing} מתוך ${view.quoted} בירוק`}
              tone={
                (view.averageMove ?? 0) > 0
                  ? "up"
                  : (view.averageMove ?? 0) < 0
                    ? "down"
                    : "neutral"
              }
            />
            <StatCell label="חברות" value={view.members.length} />
            <StatCell
              label="שווי מצרפי"
              value={`$${fmtCompact(view.totalMarketCap)}`}
            />
            <StatCell
              label="חציון P/E"
              value={fmtMetric(view.medians.pe ?? null, "x")}
              sub={`מתוך ${view.peerCount} חברות`}
            />
          </StatBar>
        }
      />

      {/* Who moved it */}
      <Section
        eyebrow="היום"
        title="מי מוביל ומי גורר"
        description="שלוש החברות בקצה כל צד. ביום עם פער גדול ביניהן, הממוצע של הסקטור מתאר פחות ממה שנראה."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            { title: "מובילות", rows: view.leaders },
            { title: "גוררות", rows: view.laggards },
          ].map((column) => (
            <div key={column.title} className="surface overflow-hidden">
              <div className="border-b border-line px-5 py-3">
                <span className="eyebrow">{column.title}</span>
              </div>
              {column.rows.map((member) => (
                <Link
                  key={member.ticker}
                  href={`/company/${member.ticker}`}
                  className="row grid-cols-[1fr_auto_auto] gap-4"
                >
                  <span className="min-w-0">
                    <span className="num block text-[13px] text-ink">
                      {member.ticker}
                    </span>
                    <span className="block truncate text-[11px] text-ink-faint">
                      {member.name}
                    </span>
                  </span>
                  <span className="num self-center text-[13px] text-ink-muted">
                    {fmtPrice(member.price)}
                  </span>
                  <span
                    className={`num self-center text-[13px] ${directionClass(member.changePercent)}`}
                  >
                    {fmtPercent(member.changePercent)}
                  </span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </Section>

      {/* The whole group */}
      <Section
        eyebrow="החברות"
        title="כל הסקטור, מול החציון שלו"
        description="כל שורה היא חברה; העמודה האחרונה היא החציון שהיא נמדדת מולו בעמוד שלה."
      >
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className="px-5 py-3 text-start text-[11px] font-normal text-ink-ghost">
                  חברה
                </th>
                <th className="px-5 py-3 text-end text-[11px] font-normal text-ink-ghost">
                  מחיר
                </th>
                <th className="px-5 py-3 text-end text-[11px] font-normal text-ink-ghost">
                  P/E
                </th>
                <th className="px-5 py-3 text-end text-[11px] font-normal text-ink-ghost">
                  מרווח תפעולי
                </th>
                <th className="px-5 py-3 text-end text-[11px] font-normal text-ink-ghost">
                  ROIC
                </th>
                <th className="px-5 py-3 text-end text-[11px] font-normal text-ink-ghost">
                  צמיחה 3ש׳
                </th>
              </tr>
            </thead>
            <tbody>
              {view.members.map((member) => (
                <tr key={member.ticker} className="border-b border-line last:border-0">
                  <th scope="row" className="px-5 py-3 text-start font-normal">
                    <Link
                      href={`/company/${member.ticker}`}
                      className="num text-[13px] text-ink hover:text-accent"
                    >
                      {member.ticker}
                    </Link>
                    <span className="block truncate text-[11px] text-ink-faint">
                      {member.name}
                    </span>
                  </th>
                  <td className="px-5 py-3 text-end">
                    <span className="num block text-[13px] text-ink">
                      {fmtPrice(member.price)}
                    </span>
                    <span
                      className={`num block text-[11px] ${directionClass(member.changePercent)}`}
                    >
                      {fmtPercent(member.changePercent)}
                    </span>
                  </td>
                  <td className="num px-5 py-3 text-end text-[13px] text-ink-muted">
                    {fmtMetric(member.pe, "x")}
                  </td>
                  <td className="num px-5 py-3 text-end text-[13px] text-ink-muted">
                    {fmtMetric(member.operatingMargin, "%")}
                  </td>
                  <td className="num px-5 py-3 text-end text-[13px] text-ink-muted">
                    {fmtMetric(member.roic, "%")}
                  </td>
                  <td className="num px-5 py-3 text-end text-[13px] text-ink-muted">
                    {fmtMetric(member.revenueGrowth, "%")}
                  </td>
                </tr>
              ))}

              <tr className="border-t border-line-strong bg-raised/40">
                <th scope="row" className="px-5 py-3 text-start text-[12px] font-normal text-ink">
                  חציון הסקטור
                </th>
                <td className="px-5 py-3 text-end text-[11px] text-ink-ghost">—</td>
                <td className="num px-5 py-3 text-end text-[13px] text-ink">
                  {fmtMetric(view.medians.pe ?? null, "x")}
                </td>
                <td className="num px-5 py-3 text-end text-[13px] text-ink">
                  {fmtMetric(view.medians.operating_margin ?? null, "%")}
                </td>
                <td className="num px-5 py-3 text-end text-[13px] text-ink">
                  {fmtMetric(view.medians.roic ?? null, "%")}
                </td>
                <td className="num px-5 py-3 text-end text-[13px] text-ink">
                  {fmtMetric(view.medians.rev_cagr_3 ?? null, "%")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* All the medians, including the ones the table has no column for */}
      <Section eyebrow="חציונים" title="הקבוצה במספרים">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.key} className="surface p-4">
              <div className="text-[11px] text-ink-faint">{metric.label}</div>
              <div className="num mt-1 text-[20px] text-ink">
                {fmtMetric(view.medians[metric.key] ?? null, metric.unit)}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-ghost">
          מדד שאינו מחושב לסקטור הזה מוצג כמקף. בפיננסים, למשל, מרווח גולמי
          ו-EV/EBITDA אינם מדווחים באותו אופן ולכן אינם מחושבים — זו התנהגות
          מכוונת ולא תקלה.
        </p>
      </Section>

      {/* What is being written */}
      {view.articles.length > 0 && (
        <Section
          eyebrow="חדשות"
          title={`מה נכתב על ${view.label}`}
          action={<MoreLink href="/news">כל החדשות</MoreLink>}
        >
          <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {view.articles.map((article) => (
              <ArticleCard key={article.url} article={article} />
            ))}
          </div>
        </Section>
      )}

      <Disclaimer extra="חציון הסקטור מחושב מהחברות שביקום האתר בלבד, ואינו מייצג את הסקטור כולו בשוק." />
    </Page>
  );
}
