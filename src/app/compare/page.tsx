import Link from "next/link";
import { ComparePicker } from "@/components/ComparePicker";
import { RelativeChart } from "@/components/RelativeChart";
import { Disclaimer, Hero, Page, Section } from "@/components/ui";
import { COMPARE_GROUPS, MAX_COMPARE, buildComparison } from "@/lib/compare";
import { getFundamentalsFile } from "@/lib/fundamentals-store";
import { compareToSector } from "@/lib/fundamentals-store";
import { directionClass, fmtCompact, fmtMetric, fmtPercent, fmtPrice } from "@/lib/format";

export const revalidate = 300;

export const metadata = {
  title: "השוואה",
  description:
    "עד ארבע חברות זו מול זו — תמחור, רווחיות, צמיחה ומאזן, כל אחת מול חציון הסקטור שלה.",
};

/**
 * Compare.
 *
 * The table shows each company against the median of its own sector rather
 * than against the other columns, which is the whole design. Two companies
 * in different sectors do not share a scale — a bank at 1.2x book and a
 * chipmaker at 14x book are not two points on one line — and a comparison
 * that ranks them teaches the reader something false.
 */
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ tickers?: string }>;
}) {
  const params = await searchParams;

  const requested = (params.tickers ?? "")
    .split(",")
    .map((ticker) => ticker.trim().toUpperCase())
    .filter((ticker) => /^[A-Z.\-]{1,10}$/.test(ticker))
    .slice(0, MAX_COMPARE);

  const [columns, file] = await Promise.all([
    requested.length > 0 ? buildComparison(requested) : Promise.resolve([]),
    getFundamentalsFile(),
  ]);

  const suggestions = file.companies
    .slice()
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
    .map((company) => ({ ticker: company.ticker, name: company.name }));

  return (
    <Page tint="#5dcaa5" width="wide">
      <Hero
        eyebrow="השוואה"
        title="אותן שאלות, על כמה חברות בבת אחת"
        lede="כל מדד מוצג מול חציון הסקטור של אותה חברה, ולא מול העמודה שלידה. חברה מסקטור אחר נמדדת מול העמיתים שלה — זו הסיבה שהטבלה הזאת לא מכריזה על מנצח בשום שורה."
      />

      <Section eyebrow="בחירה" title="מי מול מי" className="mt-10">
        <ComparePicker
          selected={columns.map((c) => c.ticker)}
          suggestions={suggestions}
          max={MAX_COMPARE}
        />
      </Section>

      {columns.length === 0 ? (
        <p className="surface mt-6 px-5 py-8 text-center text-[13px] text-ink-muted">
          עוד לא נבחרו חברות. אפשר לבחור מהרשימה למעלה, או להקליד סימבול.
        </p>
      ) : (
        <>
          {/* The header row: who is being compared */}
          <Section eyebrow="כרטיסים" title="מי הן">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {columns.map((column) => (
                <article key={column.ticker} className="surface p-4">
                  <Link
                    href={`/company/${column.ticker}`}
                    className="num text-[15px] font-medium text-ink transition-colors hover:text-accent"
                  >
                    {column.ticker}
                  </Link>
                  <p className="mt-0.5 truncate text-[12px] text-ink-faint" dir="auto">
                    {column.name}
                  </p>

                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="num text-[18px] text-ink">
                      {fmtPrice(column.price)}
                    </span>
                    <span
                      className={`num text-[12px] ${directionClass(column.changePercent)}`}
                    >
                      {fmtPercent(column.changePercent)}
                    </span>
                  </div>

                  <dl className="mt-3 space-y-1 border-t border-line pt-3 text-[11px]">
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-ghost">שווי שוק</dt>
                      <dd className="num text-ink-muted">
                        {column.marketCap ? `$${fmtCompact(column.marketCap)}` : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-ghost">סקטור</dt>
                      <dd className="text-ink-muted">
                        {column.sectorLabel ?? "מחוץ ליקום האתר"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-ghost">דוח אחרון</dt>
                      <dd className="num text-ink-muted">{column.asOf ?? "—"}</dd>
                    </div>
                  </dl>

                  {column.stale && (
                    <p className="mt-2 text-[10px] leading-relaxed text-ink-ghost">
                      הדוח בן יותר מ-120 יום. המדדים מתארים תקופה שהסתיימה מזמן.
                    </p>
                  )}
                </article>
              ))}
            </div>
          </Section>

          {/* Relative performance */}
          <Section
            eyebrow="מחיר"
            title="תשואה יחסית"
            description="כל סדרה מתחילה ב-100 לפני שנה. זה משווה תנועת מחיר בלבד ואינו אומר דבר על שווי."
          >
            <div className="surface p-5">
              <RelativeChart
                series={columns.map((column) => ({
                  ticker: column.ticker,
                  points: column.performance,
                }))}
              />
            </div>
          </Section>

          {/* The table */}
          {COMPARE_GROUPS.map((group) => (
            <Section key={group.title} eyebrow="מדדים" title={group.title}>
              <div className="surface overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="px-5 py-3 text-start text-[11px] font-normal text-ink-ghost">
                        מדד
                      </th>
                      {columns.map((column) => (
                        <th
                          key={column.ticker}
                          className="num px-5 py-3 text-end text-[12px] font-medium text-ink"
                        >
                          {column.ticker}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.key} className="border-b border-line last:border-0">
                        <th
                          scope="row"
                          className="px-5 py-3 text-start text-[12px] font-normal text-ink-muted"
                        >
                          {row.label}
                        </th>
                        {columns.map((column) => {
                          const value = column.metrics[row.key] ?? null;
                          const median = column.medians[row.key] ?? null;
                          const against = compareToSector(value, median);

                          return (
                            <td key={column.ticker} className="px-5 py-3 text-end">
                              <span className="num block text-[13px] text-ink">
                                {fmtMetric(value, row.unit)}
                              </span>
                              {against && (
                                <span className="num block text-[10px] text-ink-ghost">
                                  {against.higher ? "מעל" : "מתחת"} לחציון{" "}
                                  {fmtMetric(median, row.unit)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          ))}

          <p className="mt-6 text-[11px] leading-relaxed text-ink-ghost">
            החציון מחושב מתוך היקום של האתר —{" "}
            {columns
              .filter((column) => column.peerCount)
              .map((column) => `${column.ticker}: ${column.peerCount} עמיתים`)
              .join(" · ") || "אין חציון זמין לחברות שנבחרו"}
            . חברה ללא חציון מוצגת עם המספר שלה בלבד, כי השוואה לחציון של
            סקטור אחר הייתה מטעה יותר מאשר להשאיר את המקום ריק.
          </p>
        </>
      )}

      <Disclaimer extra="הטבלה אינה מדרגת ואינה מכריזה על עדיפות. מדד נמוך יותר אינו בהכרח טוב יותר — הוא מתאר עסק אחר." />
    </Page>
  );
}
