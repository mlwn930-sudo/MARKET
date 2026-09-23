import Link from "next/link";
import { getQuote } from "@/lib/sources/finnhub";
import { getPriceHistory } from "@/lib/sources/prices";
import { getCompanyAnalysis } from "@/lib/company-analysis";
import { getArticlesForTicker } from "@/lib/news-store";
import { PriceChart } from "@/components/PriceChart";
import { ArticleCard } from "@/components/ArticleCard";
import { VicePanorama } from "@/components/VicePanorama";
import {
  directionClass,
  fmtChange,
  fmtCompact,
  fmtMetric,
  fmtPercent,
  fmtPrice,
} from "@/lib/format";

export const revalidate = 600;

export const metadata = {
  title: "השקה גדולה — Take-Two ו-GTA VI | Market Intel",
  description:
    "מה השקה בסדר גודל כזה עושה לדוחות של Take-Two, ואיפה נמצאים הסיכונים.",
};

const NEON_PINK = "#ff2e88";
const NEON_ORANGE = "#ff9f1c";
const NEON_PURPLE = "#8b5cf6";

/**
 * A launch page for Take-Two around GTA VI.
 *
 * The visual language here is deliberately unlike the rest of the site: a
 * neon sunset rather than the analyst-terminal dark. That is the exception
 * the design rules allow for a hero panel — the no-gradient rule exists so
 * that data stays legible, and this panel carries no data.
 *
 * The artwork is original. Rockstar's marketing images are copyrighted, and
 * a research site reproducing them would be a straightforward infringement
 * however good it looked.
 */

const MECHANICS = [
  {
    title: "ההכנסה לא נרשמת ביום ההשקה",
    body: "משחק עם רכיב מקוון נרשם כהכנסה נדחית ומתפרס על פני תקופת השירות הצפויה. זו הסיבה שרבעון השקה יכול להראות חלש בשורת ההכנסות בזמן שהמכירות בפועל שברו שיא — המספר שמסגיר את האמת הוא Net Bookings, לא Revenue.",
  },
  {
    title: "ההוצאה מגיעה לפני ההכנסה",
    body: "תקציב פיתוח ושיווק של כותר בסדר גודל כזה נשרף ברבעונים שלפני ההשקה. כלומר המרווח התפעולי נשחק דווקא כשההתרגשות בשיא, ומתאושש רק אחרי שהזרם מתחיל לזרום.",
  },
  {
    title: "הזנב ארוך מהפתיחה",
    body: "אצל כותרי GTA הקודמים ההכנסה מתוכן מקוון נמשכה שנים אחרי ההשקה והייתה גדולה מהמכירה הראשונית. מי שמסתכל רק על שבוע הפתיחה מודד את החלק הקטן.",
  },
  {
    title: "דחייה היא הסיכון המרכזי",
    body: "בתעשייה הזו דחיות נפוצות, והן מזיזות הכנסה שלמה משנת כספים אחת לאחרת. זה לא משנה את שווי הכותר, אבל כן משנה לגמרי איך נראים הדוחות בדרך — ואיך השוק מגיב להם.",
  },
];

export default async function TtwoLaunchPage() {
  const [analysis, quote, history, articles] = await Promise.all([
    getCompanyAnalysis("TTWO"),
    getQuote("TTWO").catch(() => null),
    getPriceHistory("TTWO").catch(() => null),
    getArticlesForTicker("TTWO", 6),
  ]);

  const metrics = analysis?.fundamentals.groups
    .flatMap((g) => g.metrics)
    .reduce<Record<string, { value: number | null; unit: "x" | "%" | "$" | "" }>>(
      (acc, m) => {
        acc[m.key] = { value: m.value, unit: m.unit };
        return acc;
      },
      {},
    );

  const headline = [
    { key: "ps", label: "P/S" },
    { key: "operating_margin", label: "מרווח תפעולי" },
    { key: "fcf_margin", label: "FCF Margin" },
    { key: "rev_cagr_3", label: "צמיחת הכנסות 3ש׳" },
    { key: "net_debt_ebitda", label: "חוב נטו / EBITDA" },
    { key: "current_ratio", label: "Current Ratio" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <nav className="mb-5 text-xs text-ink-muted">
        <Link href="/" className="hover:text-ink">
          ← חזרה לדשבורד
        </Link>
      </nav>

      <header className="relative overflow-hidden rounded-2xl border border-line">
        <VicePanorama />

        <div className="relative p-7 pt-28 sm:pt-36">
          <span
            className="num rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ background: NEON_PINK, color: "#0b0d10" }}
          >
            השקה גדולה
          </span>

          <h1 className="mt-4 text-4xl font-medium tracking-tight">
            Take-Two ו-GTA VI
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink">
            השקה של כותר בסדר הגודל הזה היא אירוע פיננסי, לא רק אירוע תרבותי.
            העמוד הזה מסביר איך היא עוברת דרך הדוחות של החברה — ולמה רבעון
            ההשקה בדרך כלל נראה בדיוק הפוך ממה שמצפים.
          </p>

          {quote && (
            <div className="mt-5 flex items-baseline gap-4">
              <span className="num text-3xl">{fmtPrice(quote.price)}</span>
              <span
                className={`num text-sm ${directionClass(quote.changePercent)}`}
              >
                {fmtChange(quote.change)} ({fmtPercent(quote.changePercent)})
              </span>
              {analysis?.marketCap && (
                <span className="num text-xs text-ink-muted">
                  שווי שוק ${fmtCompact(analysis.marketCap)}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <section className="mt-10">
        <h2 className="text-lg" style={{ color: NEON_PINK }}>
          איך השקה נראית בדוחות
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {MECHANICS.map((item, i) => (
            <article
              key={item.title}
              className="rounded-xl border border-line bg-surface p-4"
              style={{
                borderInlineStartWidth: 2,
                borderInlineStartColor: [
                  NEON_PINK,
                  NEON_ORANGE,
                  NEON_PURPLE,
                  NEON_PINK,
                ][i % 4],
              }}
            >
              <h3 className="text-sm">{item.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {metrics && (
        <section className="mt-10">
          <h2 className="text-lg" style={{ color: NEON_ORANGE }}>
            המספרים של Take-Two היום
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {headline.map((item) => {
              const metric = metrics[item.key];
              return (
                <div key={item.key} className="rounded-xl bg-surface px-3 py-3">
                  <div className="text-[11px] text-ink-muted">{item.label}</div>
                  <div className="num mt-1 text-lg">
                    {fmtMetric(metric?.value ?? null, metric?.unit ?? "")}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
            שים לב ש-P/S רלוונטי כאן יותר מ-P/E: ברבעונים שלפני השקה גדולה
            הרווח נשחק בגלל הוצאות השיווק, ומכפיל רווח נראה מנופח בלי שקרה
            שום דבר רע בעסק.
          </p>
        </section>
      )}

      {history && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg" style={{ color: NEON_PURPLE }}>
            המחיר לפני ההשקה
          </h2>
          <PriceChart history={history} accent={NEON_PINK} />
        </section>
      )}

      {articles.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg" style={{ color: NEON_PINK }}>
            חדשות על החברה
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard
                key={article.url}
                article={article}
                accent={NEON_PINK}
              />
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-xs leading-relaxed text-ink-faint">
        העמוד מסביר מנגנונים חשבונאיים ואינו תחזית לגבי ביצועי הכותר, מועד
        ההשקה או מחיר המניה. האיורים מקוריים ואינם חומר שיווקי של המפרסם.
        אין באמור ייעוץ השקעות.
      </p>

      <p className="mt-4 text-xs">
        <Link href="/company/TTWO" className="text-ink-muted hover:text-ink">
          ← לניתוח הפונדמנטלי המלא של TTWO
        </Link>
      </p>
    </main>
  );
}
