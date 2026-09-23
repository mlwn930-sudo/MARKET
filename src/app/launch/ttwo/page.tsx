import Link from "next/link";
import { getQuote, getQuotes } from "@/lib/sources/finnhub";
import { getPriceHistory } from "@/lib/sources/prices";
import { getCompanyAnalysis, getTechnicalRead } from "@/lib/company-analysis";
import { getArticlesForTicker } from "@/lib/news-store";
import { getSectorContext } from "@/lib/fundamentals-store";
import { buildThesis } from "@/lib/analysis/thesis";
import { buildVerdict } from "@/lib/analysis/verdict";
import { AccentTheme } from "@/components/AccentTheme";
import { CompanyChart } from "@/components/CompanyChart";
import type { ChartLevel, ChartMarker } from "@/components/LiveChart";
import { ArticleCard } from "@/components/ArticleCard";
import { VicePanorama } from "@/components/VicePanorama";
import { LivePrice } from "@/components/LivePrice";
import { VerdictPanel } from "@/components/VerdictPanel";
import { ThesisPanel } from "@/components/ThesisPanel";
import { TechnicalPanel } from "@/components/TechnicalPanel";
import { CapitalPanel } from "@/components/CapitalPanel";
import { ValueChain, type ChainLink } from "@/components/ValueChain";
import type { LiveQuote } from "@/lib/use-live-ticks";
import { fmtCompact, fmtMetric } from "@/lib/format";

export const revalidate = 600;

export const metadata = {
  title: "השקה גדולה — Take-Two ו-GTA VI | Market Intel",
  description:
    "מה השקה בסדר גודל כזה עושה לדוחות של Take-Two, איפה הסיכונים, ומי עוד בשרשרת.",
};

const NEON_PINK = "#ff2e88";
const NEON_ORANGE = "#ff9f1c";
const NEON_PURPLE = "#8b5cf6";

/**
 * A launch page for Take-Two around GTA VI.
 *
 * The visual language is deliberately unlike the rest of the site: a neon
 * sunset rather than the analyst-terminal dark. That is the exception the
 * design rules allow for a hero panel — the no-gradient rule exists so that
 * data stays legible, and the hero carries no data. Everything below it
 * returns to the site's discipline, with the same analysis engine every
 * other company gets.
 *
 * The artwork is original, drawn from primitives in VicePanorama. Rockstar's
 * marketing images are copyrighted, and a research site reproducing them
 * would be a straightforward infringement however good it looked.
 */

const MECHANICS = [
  {
    title: "ההכנסה לא נרשמת ביום ההשקה",
    body: "משחק עם רכיב מקוון נרשם כהכנסה נדחית ומתפרס על פני תקופת השירות הצפויה. זו הסיבה שרבעון השקה יכול להראות חלש בשורת ההכנסות בזמן שהמכירות בפועל שברו שיא — המספר שמסגיר את האמת הוא Net Bookings, לא Revenue.",
    accent: NEON_PINK,
  },
  {
    title: "ההוצאה מגיעה לפני ההכנסה",
    body: "תקציב פיתוח ושיווק של כותר בסדר גודל כזה נשרף ברבעונים שלפני ההשקה. כלומר המרווח התפעולי נשחק דווקא כשההתרגשות בשיא, ומתאושש רק אחרי שהזרם מתחיל לזרום.",
    accent: NEON_ORANGE,
  },
  {
    title: "הזנב ארוך מהפתיחה",
    body: "אצל כותרי GTA הקודמים ההכנסה מתוכן מקוון נמשכה שנים אחרי ההשקה והייתה גדולה מהמכירה הראשונית. מי שמסתכל רק על שבוע הפתיחה מודד את החלק הקטן.",
    accent: NEON_PURPLE,
  },
  {
    title: "דחייה היא הסיכון המרכזי",
    body: "בתעשייה הזו דחיות נפוצות, והן מזיזות הכנסה שלמה משנת כספים אחת לאחרת. זה לא משנה את שווי הכותר, אבל כן משנה לגמרי איך נראים הדוחות בדרך — ואיך השוק מגיב להם.",
    accent: NEON_PINK,
  },
];

/**
 * What to read in the filing when it lands, and why each line matters.
 *
 * Written in advance on purpose. Deciding what would change your mind
 * before the number arrives is the only version of the exercise that is
 * worth anything; doing it afterwards is called explaining.
 */
const WATCH_LIST = [
  {
    line: "Net Bookings",
    why: "המכירות בפועל ברבעון, לפני פריסת ההכנסה. זה המספר שאומר אם הכותר נמכר — שורת ההכנסות לא תגיד את זה.",
  },
  {
    line: "Deferred revenue",
    why: "קפיצה בהכנסה נדחית היא כסף שכבר נגבה ויירשם ברבעונים הבאים. מדד מקדים להמשך, לא לעבר.",
  },
  {
    line: "מרווח תפעולי",
    why: "אם הוא נשאר שחוק גם אחרי ההשקה, השיווק לא היה חד-פעמי — והמינוף התפעולי שהשוק מתמחר לא הגיע.",
  },
  {
    line: "תגמול במניות מול רכישה עצמית",
    why: "אם ספירת המניות עולה בזמן שהרווח עולה, חלק מהרווח למניה נבלע בדילול לפני שהגיע לבעל המניות.",
  },
];

const CHAIN: ChainLink[] = [
  {
    symbol: "MSFT",
    role: "Xbox · Game Pass",
    mechanism:
      "כותר בסדר הגודל הזה מזיז מנויים ומכירות קונסולות. אצל מיקרוסופט זה יושב בתוך חטיבה שהיא עצמה חלק קטן מהחברה, ולכן ההשפעה אמיתית אך כמעט בלתי נראית בשורה התחתונה.",
    exposure: "שולית",
  },
  {
    symbol: "SONY",
    role: "PlayStation",
    mechanism:
      "הפלטפורמה גובה עמלה מכל מכירה דיגיטלית בחנות שלה, והשקה גדולה מושכת גם מכירות חומרה. חטיבת המשחקים היא נתח משמעותי מסוני, ולכן החשיפה כאן מורגשת יותר מאשר אצל מיקרוסופט.",
    exposure: "חלקית",
  },
  {
    symbol: "NVDA",
    role: "כרטיסי מסך",
    mechanism:
      "כותר תובעני מאיץ מחזור שדרוגים אצל גיימרים במחשב. אצל אנבידיה של היום זה זניח לחלוטין מול מרכזי הנתונים — הסעיף שמניע את המניה נמצא במקום אחר.",
    exposure: "שולית",
  },
  {
    symbol: "AAPL",
    role: "App Store",
    mechanism:
      "החשיפה היא דרך עמלת החנות על גרסאות ותוכן נלווה לנייד, לא דרך הכותר עצמו. הקשר קיים, והוא רחוק.",
    exposure: "שולית",
  },
];

async function seedQuotes(
  symbols: string[],
): Promise<Record<string, LiveQuote>> {
  try {
    const quotes = await getQuotes(symbols);
    const seed: Record<string, LiveQuote> = {};
    symbols.forEach((symbol, i) => {
      const quote = quotes[i];
      if (quote) seed[symbol] = { ...quote, at: quote.at.toISOString() };
    });
    return seed;
  } catch {
    return {};
  }
}

export default async function TtwoLaunchPage() {
  const [analysis, quote, history, technical, sector, articles, chainSeed] =
    await Promise.all([
      getCompanyAnalysis("TTWO"),
      getQuote("TTWO").catch(() => null),
      getPriceHistory("TTWO").catch(() => null),
      getTechnicalRead("TTWO").catch(() => null),
      getSectorContext("TTWO"),
      getArticlesForTicker("TTWO", 6),
      seedQuotes(CHAIN.map((link) => link.symbol)),
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

  /** The frameworks' own levels, drawn on the chart. Same source as the
   *  analysis panel below it, so the two cannot disagree. */
  const chartLevels: ChartLevel[] = [];
  if (technical?.vcp.pivot != null) {
    chartLevels.push({
      price: technical.vcp.pivot,
      label: "רמת ייחוס",
      kind: "pivot",
    });
  }
  if (technical?.risk) {
    chartLevels.push({ price: technical.risk.stop, label: "עצירה", kind: "stop" });
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

  const verdict =
    analysis &&
    buildVerdict(
      analysis.fundamentals,
      analysis.capital,
      technical,
      sector,
      analysis.profile?.name ?? "Take-Two",
    );

  const thesis =
    analysis &&
    buildThesis(
      analysis.fundamentals,
      analysis.capital,
      technical,
      sector,
      analysis.profile?.name ?? "Take-Two",
    );

  return (
    <>
      <AccentTheme accent={NEON_PINK} />

      <main className="vice-page mx-auto max-w-6xl px-6 py-8">
        <nav className="mb-5 text-xs text-ink-muted">
          <Link href="/" className="transition-colors hover:text-ink">
            ← חזרה לדשבורד
          </Link>
        </nav>

        <header className="vice-hero">
          <VicePanorama />

          <div className="relative flex min-h-[560px] flex-col justify-end p-7">
            <span
              className="num neon-flicker w-fit rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{ background: NEON_PINK, color: "#0b0d10" }}
            >
              השקה גדולה
            </span>

            <h1 className="neon neon-flicker mt-4 font-serif text-5xl tracking-tight sm:text-6xl">
              Take-Two ו-GTA VI
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink">
              השקה של כותר בסדר הגודל הזה היא אירוע פיננסי, לא רק אירוע
              תרבותי. העמוד הזה מסביר איך היא עוברת דרך הדוחות של החברה — ולמה
              רבעון ההשקה בדרך כלל נראה בדיוק הפוך ממה שמצפים.
            </p>

            <div className="mt-5 flex flex-wrap items-end gap-5">
              <LivePrice
                symbol="TTWO"
                initial={quote ? { ...quote, at: quote.at.toISOString() } : null}
              />
              {analysis?.marketCap && (
                <span className="pb-2 text-xs text-ink-muted">
                  שווי שוק{" "}
                  <span className="num">${fmtCompact(analysis.marketCap)}</span>
                </span>
              )}
            </div>
          </div>
        </header>

        {/* ---- How a launch moves through the accounts ---- */}
        <section className="reveal mt-12">
          <h2 className="text-xl">
            איך השקה נראית בדוחות
          </h2>
          <div className="stagger mt-4 grid gap-4 md:grid-cols-2">
            {MECHANICS.map((item) => (
              <article
                key={item.title}
                className="panel panel-interactive p-4"
                style={{
                  borderInlineStartWidth: 2,
                  borderInlineStartColor: item.accent,
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

        {/* ---- The bottom line, from the same engine as every company ---- */}
        {verdict && (
          <div className="mt-12">
            <VerdictPanel verdict={verdict} />
          </div>
        )}

        {thesis && (
          <div className="mt-12">
            <ThesisPanel thesis={thesis} />
          </div>
        )}

        {/* ---- Headline numbers ---- */}
        {metrics && (
          <section className="reveal mt-12">
            <h2 className="text-xl">
              המספרים של Take-Two היום
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {headline.map((item) => {
                const metric = metrics[item.key];
                return (
                  <div key={item.key} className="panel panel-interactive px-3 py-3">
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

        {/* ---- Price ---- */}
        {history && (
          <section className="reveal mt-12">
            <h2 className="mb-4 text-xl">
              המחיר לפני ההשקה
            </h2>
            <CompanyChart
              symbol="TTWO"
              name="Take-Two"
              candles={history.candles}
              accent={NEON_PINK}
              levels={chartLevels}
              markers={chartMarkers}
              initial={quote ? { ...quote, at: quote.at.toISOString() } : null}
            />
          </section>
        )}

        {technical && (
          <div className="mt-12">
            <TechnicalPanel technical={technical} />
          </div>
        )}

        {analysis && (
          <div className="mt-12">
            <CapitalPanel capital={analysis.capital} />
          </div>
        )}

        {/* ---- What to read in the filing ---- */}
        <section className="reveal mt-12">
          <h2 className="text-xl">
            מה לקרוא בדוח כשהוא יגיע
          </h2>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-ink-muted">
            הרשימה נכתבה מראש בכוונה. להחליט מה היה משנה את דעתך לפני
            שהמספר מגיע היא הגרסה היחידה של התרגיל הזה ששווה משהו — לעשות
            את זה אחרי קוראים לזה הסבר.
          </p>
          <div className="stagger mt-4 grid gap-3 md:grid-cols-2">
            {WATCH_LIST.map((item) => (
              <div key={item.line} className="panel accent-edge p-4">
                <h3 className="num text-sm">{item.line}</h3>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
                  {item.why}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- The chain around it ---- */}
        <section className="reveal mt-12">
          <h2 className="text-xl">
            מי עוד בשרשרת
          </h2>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-ink-muted">
            השקה בסדר גודל כזה נכתבת כאילו היא מזיזה כל חברה שנוגעת במשחקים.
            אצל רובן ההשפעה אמיתית וזניחה — טעות עיגול בתוך עסק של טריליון
            דולר. הסימון ליד כל שורה אומר איזו מהשתיים.
          </p>
          <div className="mt-4">
            <ValueChain links={CHAIN} initial={chainSeed} />
          </div>
        </section>

        {/* ---- News ---- */}
        {articles.length > 0 && (
          <section className="reveal mt-12">
            <h2 className="mb-4 text-xl">
              חדשות על החברה
            </h2>
            <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

        <p className="mt-12 text-xs leading-relaxed text-ink-faint">
          העמוד מסביר מנגנונים חשבונאיים ואינו תחזית לגבי ביצועי הכותר, מועד
          ההשקה או מחיר המניה. האיורים בעמוד מקוריים ואינם חומר שיווקי של
          המפרסם, ואין באתר שימוש בסימני מסחר או בנכסים גרפיים של צד שלישי.
          אין באמור ייעוץ השקעות.
        </p>

        <p className="mt-4 text-xs">
          <Link
            href="/company/TTWO"
            className="text-ink-muted transition-colors hover:text-ink"
          >
            ← לניתוח הפונדמנטלי המלא של TTWO
          </Link>
        </p>
      </main>
    </>
  );
}
