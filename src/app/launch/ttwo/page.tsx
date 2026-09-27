import Link from "next/link";
import { CinematicHero } from "@/components/market/CinematicHero";
import { ChapterNav } from "@/components/market/ChapterNav";
import { WorkflowLinks } from "@/components/market/WorkflowLinks";
import { EvidenceKey } from "@/components/market/EvidenceKey";
import { WatchButton } from "@/components/WatchButton";
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
import { ReleasePanel } from "@/components/ReleasePanel";
import { buildOutlook } from "@/lib/analysis/outlook";
import { knownEventsFor } from "@/lib/analysis/known-events";
import {
  Disclaimer,
  Page,
  Section,
  StatBar,
  StatCell,
} from "@/components/ui";
import type { LiveQuote } from "@/lib/use-live-ticks";
import { fmtCompact, fmtMetric, fmtPrice, fmtPercent, fmtDate } from "@/lib/format";

export const revalidate = 600;

export const metadata = {
  title: "Take-Two ו-GTA VI",
  description:
    "מה השקה בסדר גודל כזה עושה לדוחות של Take-Two, איפה הסיכונים, ומי עוד בשרשרת הערך.",
};

/** The same research system, with an editorial entrance and chapter navigation. */

const MECHANICS = [
  {
    title: "ההכנסה לא נרשמת ביום ההשקה",
    body: "חלק מהתמורה עשוי להיות מוכר לאורך תקופת השירות, בהתאם להתחייבויות הביצוע. Net Bookings מודד מכירות נטו בתקופה לפי הגדרת החברה; הוא אינו זהה להכנסות GAAP או לתזרים המזומנים. צריך לקרוא את שלושתם יחד.",
  },
  {
    title: "ההוצאה מגיעה לפני ההכנסה",
    body: "תקציב פיתוח ושיווק של כותר בסדר גודל כזה נשרף ברבעונים שלפני ההשקה. המרווח התפעולי נשחק דווקא כשההתרגשות בשיא, ומתאושש רק אחרי שהזרם מתחיל לזרום.",
  },
  {
    title: "הזנב ארוך מהפתיחה",
    body: "GTA Online מדגים כיצד תוכן ורכישות בתוך המשחק עשויים להאריך את חיי המוצר. הצלחת ההשקה אינה מבטיחה שימור שחקנים או הוצאות חוזרות; את שניהם צריך לבדוק בדיווחים הבאים.",
  },
  {
    title: "דחייה היא הסיכון המרכזי",
    body: "בתעשייה הזו דחיות נפוצות, והן מזיזות הכנסה שלמה משנת כספים אחת לאחרת. דחייה עלולה לשנות את עיתוי התזרים, עלויות הפיתוח והשיווק, ואת הערך הנוכחי של ההכנסות הצפויות.",
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
    why: "מדד המכירות נטו לפי הגדרת Take-Two. יש להשוות להנחיית ההנהלה ולהצליב עם Revenue ותזרים, ולא לקרוא אותו כמזומן שנגבה.",
  },
  {
    line: "Deferred revenue",
    why: "תמורה שהתקבלה או הפכה לחייבת לפני שהחברה השלימה את ההכרה בהכנסה. לבחון יחד עם יתרות הלקוחות, תנאי ההכרה והתזרים.",
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


  const launchEvent = knownEventsFor("TTWO")[0] ?? null;

  return (
    <Page>
      <CinematicHero
        variant="story"
        image="/hero/ttwo-story.webp"
        eyebrow={<span><span className="micro-label">MARKET STORIES / 001</span><span>מחקר מיוחד · NASDAQ: TTWO</span></span>}
        title={<><bdi>GTA <span>VI</span></bdi><small>הסיפור שמאחורי הציפיות.</small></>}
        description="אירוע תרבותי. מבחן פיננסי. מסע מהעולם של Rockstar אל הדוחות, התמחור והתזה של Take-Two."
        actions={<><a href="#legacy" className="btn btn-editorial">לגלות את הסיפור <span aria-hidden="true">↓</span></a><Link href="#investment">ישר לניתוח הפיננסי</Link></>}
        aside={<div className="story-ticket">
          <div><span className="micro-label">NASDAQ / TTWO</span><p className="mt-1 text-sm text-ink-muted">Take-Two Interactive</p></div>
          <div><strong className="num">{fmtPrice(quote?.price)}</strong><span className={"num text-sm " + ((quote?.changePercent ?? 0) >= 0 ? "text-up" : "text-down")}>{fmtPercent(quote?.changePercent ?? null)}</span></div>
          <p className="mt-2 text-xs text-ink-faint">{quote?.at ? "ציטוט: " + fmtDate(quote.at.toISOString()) : "ציטוט אינו זמין כרגע"}</p>
          <Link href="/company/TTWO">לעמוד החברה <span aria-hidden="true">↗</span></Link>
        </div>}
        footer={<div className="story-facts">
          <div><span className="micro-label">THE CATALYST</span><strong>Grand Theft Auto VI</strong><p>הכותר הבא של Rockstar Games</p></div>
          <div><span className="micro-label">THE COMPANY</span><strong>Take-Two Interactive</strong><p>חברה שלמה, מעבר להשקה אחת</p></div>
          <div><span className="micro-label">THE QUESTION</span><strong>כמה כבר מגולם במחיר?</strong><p>ציפייה אינה תוצאה מדווחת</p></div>
        </div>}
      />
      <ChapterNav label="פרקי הסיפור של Take-Two" chapters={[
        { id: "legacy", label: "המורשת" },
        ...(launchEvent ? [{ id: "release", label: "ההשקה" }] : []),
        { id: "investment", label: "ממשחק להשקעה" },
        { id: "economics", label: "המספרים" },
        { id: "expectations", label: "הציפיות" },
        { id: "risks", label: "הסיכונים" },
        { id: "monitor", label: "מה לעקוב" },
        ...(intelligence ? [{ id: "thesis", label: "התזה" }] : []),
      ]} />

      <section id="legacy" className="legacy-section">
        <div><div className="chapter-kicker"><span className="num">01</span>המורשת / THE LEGACY</div><h2 className="legacy-title"><bdi>GTA V.</bdi><small>ממשחק לעולם מתמשך.</small></h2></div>
        <div className="legacy-copy"><p>GTA V יצא ב־2013. GTA Online המשיך את הקשר עם השחקנים מעבר לסיפור הראשי. למשקיע, השאלה היא איך כותר חדש הופך למערכת של תוכן, מעורבות והוצאות חוזרות לאורך זמן.</p>
          <div className="legacy-facts"><div><strong>פתיחה חזקה</strong><p>המכירה הראשונית בונה בסיס שחקנים. היא רק תחילת המחזור הכלכלי.</p></div><div><strong>קשר מתמשך</strong><p>שימור, תוכן ותשלומים חוזרים קובעים את אורך החיים של ההכנסה.</p></div></div>
          <p className="mt-5 !text-xs"><a href="https://www.rockstargames.com/newswire/article/o349k552518949/grand-theft-auto-v-now-available.html" target="_blank" rel="noopener noreferrer">מקור: Rockstar, השקת GTA V · 17.09.2013 ↗</a></p>
        </div>
      </section>

      {/* ---- The date, before anything else ----
           The one fact every reader of this page arrives wanting, and the
           one the page used to leave as an absence. It is a company
           statement, so it is shown with its source, when it was last
           checked, and the two previous dates it replaced. */}
      {launchEvent && (
        <Section
          id="release"
          eyebrow="02 / ההשקה"
          title="מתי, ועל מה זה מבוסס"
          description="תאריך שהחברה מסרה, לא אומדן של האתר. הוא כבר נדחה פעמיים, וזה חלק מהעובדה ולא הערת שוליים."
        >
          <ReleasePanel event={launchEvent} />
        </Section>
      )}

      <section id="investment" className="investment-bridge">
        <div className="chapter-kicker"><span className="num">03</span>FROM THE GAME TO THE BUSINESS</div>
        <h2>המשחק יוצר את ההתרגשות.<br /><span>התזרים צריך להצדיק את המחיר.</span></h2>
        <p className="lede">מכאן עוברים מהסיפור אל החברה: מה היא מוכרת, מתי ההכנסה מוכרת ומה נשאר לבעלי המניות.</p>
        <div className="bridge-steps">
          <div><span className="num">01 / DEMAND</span><h3>ביקוש</h3><p>כמה שחקנים יקנו, באיזה מחיר, ועל אילו פלטפורמות.</p></div>
          <div><span className="num">02 / BOOKINGS</span><h3>מכירות נטו</h3><p>המדד של החברה למכירות בתקופה, לפי הגדרתה.</p></div>
          <div><span className="num">03 / CASH FLOW</span><h3>מזומן</h3><p>גבייה פחות פיתוח, שיווק והוצאות תפעול.</p></div>
          <div><span className="num">04 / VALUATION</span><h3>שווי</h3><p>כמה מהצמיחה כבר משתקפת במחיר ששולם.</p></div>
        </div>
        {analysis && <div className="mt-9"><StatBar><StatCell label="שווי שוק" value={analysis.marketCap ? "$" + fmtCompact(analysis.marketCap) : "—"} />{headline.slice(0,3).map((item) => { const metric = metricOf(item.key); return <StatCell key={item.key} label={item.label} value={fmtMetric(metric?.value ?? null, metric?.unit ?? "")} />; })}</StatBar><p className="caption mt-3">מדדים מדווחים היסטוריים; הם אינם תחזית ל־GTA VI. המקור וההשוואה לסקטור בעמוד החברה.</p></div>}
      </section>

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

      {/* ---- Accounting mechanics ---- */}
      <Section
        id="economics"
        eyebrow="04 / העסק"
        title="איך השקה נראית בדוחות"
        description="ארבעה מנגנונים שהופכים רבעון השקה למטעה אם קוראים אותו כמו רבעון רגיל."
      >
        <div className="editorial-rows">
          {MECHANICS.map((item, index) => (
            <article key={item.title}><span className="num">0{index + 1}</span>
              <h3 className="font-bold tracking-tight">
                {item.title}
              </h3>
              <p className="text-ink-muted">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="expectations" eyebrow="05 / ציפיות" title="השקה מוצלחת יכולה עדיין לא להספיק" description="התשואה תלויה גם בפער בין התוצאה לבין מה שכבר ציפו לו. מחיר המניה לבדו אינו מגלה במדויק את תחזית המכירות שהשוק מניח.">
        <EvidenceKey />
        <div className="editorial-rows mt-6">
          <article><span className="num">01</span><h3>מה ידוע</h3><p>מועד ההשקה והפלטפורמות מפורטים בהודעת החברה. הדוחות מתארים את העסק לפני תרומת הכותר החדש.</p></article>
          <article><span className="num">02</span><h3>מה צריך להשוות</h3><p>הנחיות Net Bookings, תוצאות בפועל והוצאות. לבדוק שינוי בהנחיה מול הגרסה הקודמת, ולא רק צמיחה שנתית.</p></article>
          <article><span className="num">03</span><h3>מה עדיין חסר</h3><p>מודל קונצנזוס מאומת לכותר וניתוח הפוך של השווי אינם מוצגים כאן. לכן אין מספר מומצא ל״מכירות שמגולמות במחיר״.</p></article>
        </div>
        <Link href="/research?ticker=TTWO" className="btn btn-ghost mt-6">לבחון את הציפיות במחקר</Link>
      </Section>

      <Section id="risks" eyebrow="06 / סיכונים" title="מה יכול לשנות את הסיפור">
        <div className="editorial-rows">
          <article><span className="num">01</span><h3>לוח הזמנים</h3><p>דחייה משנה את עיתוי התזרים ואת חשיפת ההוצאות. שינוי מועד מחייב לבדוק מחדש את שנת הכספים הרלוונטית.</p></article>
          <article><span className="num">02</span><h3>איכות ההשקה</h3><p>תקלות, החזרים או מעורבות נמוכה עלולים לשנות את הקשר בין מכירות הפתיחה לבין ערך לאורך זמן.</p></article>
          <article><span className="num">03</span><h3>רווח למניה</h3><p>עלויות, דילול ותמחור גבוה יכולים לצמצם את התועלת לבעל המניות גם כשנתוני המכירות נראים חזקים.</p></article>
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
        id="monitor"
        eyebrow="07 / מעקב"
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
            id="thesis"
            eyebrow="MARKET / תזת השקעה"
            title="האם יש סיבה מבוססת להמשיך לעקוב"
          >
            <IntelligencePanel intelligence={intelligence} />
          </Section>
        </>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-4"><WatchButton ticker="TTWO" /><Link href="/research?ticker=TTWO" className="btn btn-ghost">לחקור את Take-Two</Link></div>
      <WorkflowLinks ticker="TTWO" title="מהסיפור לתהליך ההשקעה" />

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
