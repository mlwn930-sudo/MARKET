import Link from "next/link";
import { getQuote, getQuotes } from "@/lib/sources/finnhub";
import { getPriceHistory } from "@/lib/sources/prices";
import { getCompanyAnalysis, getTechnicalRead } from "@/lib/company-analysis";
import { getArticlesForTicker } from "@/lib/news-store";
import { getSectorContext } from "@/lib/fundamentals-store";
import { getCompanyIntelligence } from "@/lib/agents";
import { CompanyChart } from "@/components/CompanyChart";
import type { ChartLevel, ChartMarker } from "@/components/LiveChart";
import { VerdictPanel } from "@/components/VerdictPanel";
import { IntelligencePanel } from "@/components/IntelligencePanel";
import { TechnicalPanel } from "@/components/TechnicalPanel";
import { CapitalPanel } from "@/components/CapitalPanel";
import { ValueChain, type ChainLink } from "@/components/ValueChain";
import { ArticleCard } from "@/components/ArticleCard";
import { OutlookPanel } from "@/components/OutlookPanel";
import { buildOutlook } from "@/lib/analysis/outlook";
import {
  Disclaimer,
  Hero,
  MoreLink,
  Page,
  Section,
  StatBar,
  StatCell,
} from "@/components/ui";
import type { LiveQuote } from "@/lib/use-live-ticks";
import { fmtCompact, fmtMetric } from "@/lib/format";

export const revalidate = 600;

export const metadata = {
  title: "Take-Two ו-GTA VI",
  description:
    "מה השקה בסדר גודל כזה עושה לדוחות של Take-Two, איפה הסיכונים, ומי עוד בשרשרת הערך.",
};

/**
 * The launch page.
 *
 * One image, at the top, and then the site's ordinary financial language
 * all the way down. The previous version ran neon through every panel on
 * the page, which turned a research page into a poster: the figures were
 * the same but nobody was going to read them.
 *
 * The framing the whole page is built on: GTA VI viewed through the lens of
 * the stock market. Not the game — the accounting it passes through, the
 * companies around it, and what the filing will say when it lands.
 */

const MECHANICS = [
  {
    title: "ההכנסה לא נרשמת ביום ההשקה",
    body: "משחק עם רכיב מקוון נרשם כהכנסה נדחית ומתפרס על פני תקופת השירות הצפויה. זו הסיבה שרבעון השקה יכול להראות חלש בשורת ההכנסות בזמן שהמכירות בפועל שברו שיא — המספר שמסגיר את האמת הוא Net Bookings, לא Revenue.",
  },
  {
    title: "ההוצאה מגיעה לפני ההכנסה",
    body: "תקציב פיתוח ושיווק של כותר בסדר גודל כזה נשרף ברבעונים שלפני ההשקה. המרווח התפעולי נשחק דווקא כשההתרגשות בשיא, ומתאושש רק אחרי שהזרם מתחיל לזרום.",
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

/**
 * What to read in the filing when it lands.
 *
 * Written in advance on purpose. Deciding what would change your mind
 * before the number arrives is the only version of the exercise worth
 * anything; doing it afterwards is called explaining.
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
  const [analysis, quote, history, technical, sector, articles, chainSeed, intelligence] =
    await Promise.all([
      getCompanyAnalysis("TTWO"),
      getQuote("TTWO").catch(() => null),
      getPriceHistory("TTWO").catch(() => null),
      getTechnicalRead("TTWO").catch(() => null),
      getSectorContext("TTWO"),
      getArticlesForTicker("TTWO", 6),
      seedQuotes(CHAIN.map((link) => link.symbol)),
      getCompanyIntelligence("TTWO"),
    ]);

  const metricOf = (key: string) =>
    analysis?.fundamentals.groups
      .flatMap((group) => group.metrics)
      .find((metric) => metric.key === key) ?? null;

  const headline = [
    { key: "ps", label: "P/S" },
    { key: "operating_margin", label: "מרווח תפעולי" },
    { key: "fcf_margin", label: "FCF Margin" },
    { key: "rev_cagr_3", label: "צמיחת הכנסות 3ש׳" },
    { key: "net_debt_ebitda", label: "חוב נטו / EBITDA" },
    { key: "current_ratio", label: "Current Ratio" },
  ];

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

  const outlook =
    intelligence && analysis
      ? buildOutlook({
          ticker: "TTWO",
          companyName: analysis.profile?.name ?? analysis.title,
          price: quote?.price ?? null,
          intelligence,
          fundamentals: analysis.fundamentals,
          sector,
          technical,
        })
      : null;


  return (
    <Page tint="#fcaf17">
      <Hero
        eyebrow="השקה גדולה"
        title="GTA VI, דרך העדשה של שוק ההון"
        lede="השקה בסדר הגודל הזה היא אירוע פיננסי, לא רק אירוע תרבותי. העמוד מסביר איך היא עוברת דרך הדוחות של Take-Two — ולמה רבעון ההשקה בדרך כלל נראה בדיוק הפוך ממה שמצפים."
        image="/hero/launch.webp"
        imageAlt="איור בסגנון מיאמי בשקיעה, הרקע של עמוד ההשקה"
        stats={
          analysis && (
            <StatBar>
              <StatCell
                label="שווי שוק"
                value={
                  analysis.marketCap
                    ? `$${fmtCompact(analysis.marketCap)}`
                    : "—"
                }
              />
              {headline.slice(0, 3).map((item) => {
                const metric = metricOf(item.key);
                return (
                  <StatCell
                    key={item.key}
                    label={item.label}
                    value={fmtMetric(metric?.value ?? null, metric?.unit ?? "")}
                  />
                );
              })}
            </StatBar>
          )
        }
        action={
          <MoreLink href="/company/TTWO">לעמוד החברה המלא</MoreLink>
        }
      />

      {/* ---- The position, first.
           This page existed to explain how a launch passes through the
           accounts, and said nothing about where that leaves the company —
           which is the only question a reader arrives with. ---- */}
      {outlook && (
        <Section
          eyebrow="השורה התחתונה"
          title="איפה זה משאיר את Take-Two"
          description="ההשקה היא האירוע המרכזי של החברה הזאת, והיא עדיין לא נמצאת באף שורה בדוחות. זו בדיוק הסיבה שהבדיקות הכמותיות לבדן אינן מספיקות כאן."
        >
          <OutlookPanel outlook={outlook} ticker="TTWO" />
        </Section>
      )}

      {/* ---- Core Test, then the thesis. Take-Two is the case these two
           were split for: it fails the trailing checklist while the
           forward-looking question stays open. ---- */}
      {intelligence && (
        <>
          <Section
            eyebrow="מבחן הליבה"
            description="בדיקה כמותית על מה שכבר דווח ברבעונים שלפני ההשקה."
          >
            <VerdictPanel verdict={intelligence.verdict} />
          </Section>

          <Section
            eyebrow="תזת השקעה"
            title="האם יש סיבה מבוססת להמשיך לעקוב"
          >
            <IntelligencePanel intelligence={intelligence} />
          </Section>
        </>
      )}

      {/* ---- Accounting mechanics ---- */}
      <Section
        eyebrow="חשבונאות"
        title="איך השקה נראית בדוחות"
        description="ארבעה מנגנונים שהופכים רבעון השקה למטעה אם קוראים אותו כמו רבעון רגיל."
      >
        <div className="stagger grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
          {MECHANICS.map((item) => (
            <article key={item.title} className="bg-surface p-5">
              <h3 className="text-[15px] font-bold tracking-tight">
                {item.title}
              </h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-ink-muted">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </Section>

      {/* ---- Price ---- */}
      {history && (
        <Section eyebrow="מחיר" title="המחיר לפני ההשקה">
          <CompanyChart
            symbol="TTWO"
            name="Take-Two"
            candles={history.candles}
            levels={chartLevels}
            markers={chartMarkers}
            initial={quote ? { ...quote, at: quote.at.toISOString() } : null}
          />
        </Section>
      )}

      {technical && (
        <Section eyebrow="ניתוח טכני">
          <TechnicalPanel technical={technical} />
        </Section>
      )}

      {analysis && (
        <Section eyebrow="איכות הרווח">
          <CapitalPanel capital={analysis.capital} />
        </Section>
      )}

      {/* ---- What to read in the filing ---- */}
      <Section
        eyebrow="הכנה"
        title="מה לקרוא בדוח כשהוא יגיע"
        description="הרשימה נכתבה מראש בכוונה. להחליט מה היה משנה את דעתך לפני שהמספר מגיע היא הגרסה היחידה של התרגיל הזה ששווה משהו — לעשות את זה אחרי קוראים לזה הסבר."
      >
        <div className="surface divide-y divide-line">
          {WATCH_LIST.map((item) => (
            <div
              key={item.line}
              className="grid gap-2 p-5 sm:grid-cols-[200px_1fr] sm:gap-6"
            >
              <h3 className="num text-[14px] font-medium text-ink">
                {item.line}
              </h3>
              <p className="text-[13px] leading-relaxed text-ink-muted">
                {item.why}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---- The chain ---- */}
      <Section
        eyebrow="שרשרת הערך"
        title="מי עוד מושפע, וכמה"
        description="השקה בסדר גודל כזה נכתבת כאילו היא מזיזה כל חברה שנוגעת במשחקים. אצל רובן ההשפעה אמיתית וזניחה — טעות עיגול בתוך עסק של טריליון דולר. הסימון ליד כל שורה אומר איזו מהשתיים."
      >
        <ValueChain links={CHAIN} initial={chainSeed} />
      </Section>

      {/* ---- News ---- */}
      {articles.length > 0 && (
        <Section eyebrow="חדשות" title="מה נכתב על החברה">
          <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.url} article={article} />
            ))}
          </div>
        </Section>
      )}

      <p className="mt-16 text-[11px] leading-relaxed text-ink-ghost">
        העמוד מסביר מנגנונים חשבונאיים ואינו תחזית לגבי ביצועי הכותר, מועד
        ההשקה או מחיר המניה. שמות מוצרים וסימני מסחר המוזכרים בעמוד שייכים
        לבעליהם, ומופיעים כאן לצורך זיהוי החברה הנדונה בלבד.
      </p>

      <p className="mt-4 text-[12px]">
        <Link
          href="/company/TTWO"
          className="text-ink-muted transition-colors hover:text-ink"
        >
          ← לניתוח הפונדמנטלי המלא של TTWO
        </Link>
      </p>

      <Disclaimer />
    </Page>
  );
}
