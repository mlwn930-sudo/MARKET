import Link from "next/link";
import type { Instrument } from "@/lib/sources/macro";
import type { EnrichedArticle } from "@/lib/news-shape";
import type { LiveQuote } from "@/lib/use-live-ticks";

type SignalInput = {
  label: string;
  detail: string | null;
};

type Props = {
  signal: SignalInput;
  quotes: Record<string, LiveQuote>;
  articles: EnrichedArticle[];
  instruments: Instrument[];
  opportunityCount: number;
};

function metricValue(value: number | null | undefined, suffix = "") {
  return value == null ? "—" : `${value}${suffix}`;
}

export function IntelligenceReadout({
  signal,
  quotes,
  articles,
  instruments,
  opportunityCount,
}: Props) {
  const quoteValues = Object.values(quotes).filter(
    (quote): quote is LiveQuote & { changePercent: number } =>
      typeof quote.changePercent === "number" &&
      Number.isFinite(quote.changePercent),
  );

  const advancing = quoteValues.filter((quote) => quote.changePercent > 0).length;
  const declining = quoteValues.filter((quote) => quote.changePercent < 0).length;
  const unchanged = quoteValues.length - advancing - declining;

  const analysed = articles.filter((article) => Boolean(article.analysis)).length;
  const material = articles.filter(
    (article) =>
      article.analysis?.significance === "high" ||
      article.analysis?.catalystKind === "catalyst",
  ).length;

  const vix = instruments.find((instrument) => instrument.symbol === "^VIX");
  const tenYear = instruments.find((instrument) => instrument.symbol === "^TNX");

  const breadth = quoteValues.length > 0 ? `${advancing} / ${declining}` : "—";
  const coverage = articles.length > 0 ? `${analysed} / ${articles.length}` : "—";
  const context =
    signal.detail ??
    (quoteValues.length > 0
      ? `${advancing} עולות · ${declining} יורדות · ${unchanged} ללא שינוי`
      : "אין מספיק ציטוטים זמינים למדידת רוחב התנועה");

  return (
    <section className="gap-section" aria-labelledby="intelligence-readout">
      <div className="on-dark overflow-hidden rounded-[8px] border border-white/10 bg-[linear-gradient(135deg,#0f172a_0%,#16233d_60%,#1b2b4d_100%)] text-white shadow-hero">
        <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
          <div className="border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-s lg:border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00B8E6]" aria-hidden="true" />
              <span className="text-[12px] font-medium tracking-[0.16em] text-white/65">
                INTELLIGENCE READOUT
              </span>
            </div>

            <h2 id="intelligence-readout" className="mt-5 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
              תמונת מצב, בלי רעש
            </h2>

            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/65">
              ארבעה מדדים שמסדרים את המידע שכבר נאסף לפני שעוברים לפרשנות.
              המסגרת מתארת מצב; היא לא הופכת אותו לציון.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/85">
                {signal.label}
              </span>
              <span className="text-[12px] text-white/65">{context}</span>
            </div>

            <p className="mt-6 text-[12px] text-ink-faint">זמינות נתונים מתוארת ליד כל מדד. אין ציון ביטחון כולל.</p>
          </div>

          <div className="grid sm:grid-cols-2">
            <Link
              href="/heatmap"
              className="group border-b border-white/10 p-6 transition-colors hover:bg-white/[0.035] sm:border-s sm:p-7"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-white/65">רוחב התנועה</span>
                <span className="text-[12px] tracking-[0.12em] text-[#00B8E6]">MARKET</span>
              </div>
              <div className="num mt-4 text-3xl tracking-[-0.04em] text-white">{breadth}</div>
              <p className="mt-2 text-[12px] leading-relaxed text-white/65">
                עולות / יורדות מתוך הציטוטים שהגיעו. {unchanged} ללא שינוי.
              </p>
            </Link>

            <Link
              href="/news"
              className="group border-b border-white/10 p-6 transition-colors hover:bg-white/[0.035] sm:border-s sm:p-7"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-white/65">כיסוי מודל</span>
                <span className="text-[12px] tracking-[0.12em] text-[#6757E8]">NEWS</span>
              </div>
              <div className="num mt-4 text-3xl tracking-[-0.04em] text-white">{coverage}</div>
              <p className="mt-2 text-[12px] leading-relaxed text-white/65">
                כתבות שנקראו על ידי המודל מתוך הפיד הנוכחי. {material} סווגו
                כבעלות משמעות גבוהה או כזרז.
              </p>
            </Link>

            <Link
              href="/macro"
              className="group p-6 transition-colors hover:bg-white/[0.035] sm:border-s sm:p-7"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-white/65">מחיר הכסף</span>
                <span className="text-[12px] tracking-[0.12em] text-[#D6A84A]">RATES</span>
              </div>
              <div className="num mt-4 text-3xl tracking-[-0.04em] text-white">
                {metricValue(tenYear?.value, "%")}
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-white/65">
                תשואת 10 שנים. שינוי:{" "}
                {tenYear?.change == null
                  ? "—"
                  : `${tenYear.change >= 0 ? "+" : "−"}${Math.abs(tenYear.change).toFixed(2)}`}.
              </p>
            </Link>

            <Link
              href="/macro"
              className="group p-6 transition-colors hover:bg-white/[0.035] sm:border-s sm:p-7"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-white/65">תנודתיות</span>
                <span className="text-[12px] tracking-[0.12em] text-[#E5B95B]">VIX</span>
              </div>
              <div className="num mt-4 text-3xl tracking-[-0.04em] text-white">
                {metricValue(vix?.value)}
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-white/65">
                מדד התנודתיות הגלומה. אין כאן יעד או אות מסחר — רק קריאת מצב.
              </p>
            </Link>

            <Link
              href="/opportunities"
              className="group border-t border-white/10 p-6 transition-colors hover:bg-white/[0.035] sm:col-span-2 sm:p-7"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <span className="text-[12px] text-white/65">יקום הסורק</span>
                  <div className="num mt-2 text-xl text-white">
                    {opportunityCount > 0 ? opportunityCount : "—"} חברות במעקב
                  </div>
                </div>
                <span className="text-[12px] text-white/65">
                  עשר בדיקות, חציוני סקטור, ו-Insufficient Data כשאין בסיס לחישוב
                </span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
