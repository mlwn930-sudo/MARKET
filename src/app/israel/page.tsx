import Link from "next/link";
import {
  TASE_LEADERS,
  getTaseBoard,
  sessionFromData,
} from "@/lib/sources/tase";
import { DUAL_LISTED } from "@/lib/tase-universe";
import { getBoardQuotes, type BoardQuote } from "@/lib/sources/board-quotes";
import { getMacroBoard } from "@/lib/sources/macro";
import { getIsraelNews } from "@/lib/israel-news";
import { buildCrossListing } from "@/lib/analysis/cross-listing";
import {
  rangePosition,
  readSectors,
  readSession,
  readShekel,
  type LocalName,
} from "@/lib/analysis/tel-aviv";
import { GradeChip, DerivedMark } from "@/components/SignalCard";
import { Sparkline } from "@/components/Sparkline";
import { TaseSession } from "@/components/market/TaseSession";
import { TaseBoard } from "@/components/market/TaseBoard";
import { ShekelPanel } from "@/components/market/ShekelPanel";
import {
  Band,
  Delta,
  Disclaimer,
  Empty,
  Field,
  Hero,
  MarketStatus,
  MoreLink,
  Page,
  Section,
  Stat,
  StatBar,
  StatCell,
} from "@/components/ui";
import { directionClass, fmtPercent, fmtRelative } from "@/lib/format";

export const revalidate = 120;

export const metadata = {
  title: "הבורסה בתל אביב",
  description:
    "ת״א 35 ות״א 125, רוחב המסחר המקומי מול המדד המשוקלל, הסקטורים עם מספר לכל אחד, שער הדולר כחלק מהתשואה על נכס אמריקאי, והצמד הכפול מול וול סטריט.",
};

/** Shekels, always with the sign and two decimals. Israeli quotes arrive
 *  in agorot and are converted at the source; this only formats. */
function shekel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `₪${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dollar(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** An index level, which is points rather than money. */
function points(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/**
 * The local market.
 *
 * The page was four things stacked up — an index strip, fourteen prices, a
 * shekel rate and a news block — and every figure on it was a print that
 * had nothing to be measured against. That is the one failure this project
 * names as a rule rather than a preference: a figure alone is a datum, a
 * figure beside its comparison is knowledge, and a page that never crossed
 * that line had no reason to be visited twice.
 *
 * So the order is now an argument rather than an inventory.
 *
 * What the session did, first, because breadth and an equal-weight average
 * are the two things the index itself cannot tell you — and the gap between
 * the index and that average is the concentration this market is famous
 * for, measured here instead of asserted.
 *
 * The shekel second, and not as a widget. For a reader who spends shekels,
 * the dollar rate is half the return on every American asset they hold, and
 * the arithmetic that turns an index's dollar move into their actual return
 * appears nowhere else on this site.
 *
 * Then the sectors with a figure each, then the names with a month of shape
 * beside each price, then the dual-listed pair table — which is the bridge
 * from this page to the rest of the apparatus, because a company that files
 * with SEC is a company this site can genuinely analyse.
 *
 * What stays absent stays absent, and is spelled out at the bottom. Six of
 * the fourteen file nothing this site can read: they get a price, a trend
 * and a turnover ratio, and no Core Test, thesis or sector median, because
 * there is nothing to compute those from. Rule 9.
 */
export default async function IsraelPage() {
  const usTickers = DUAL_LISTED.map((entry) => entry.usTicker);

  const [board, usQuotes, macro, news] = await Promise.all([
    getTaseBoard(),
    /* One spark request for all eight, through the shared board cache —
       the same path the market map uses, for the same reason. */
    getBoardQuotes(usTickers).catch(() => ({}) as Record<string, BoardQuote>),
    getMacroBoard().catch(() => ({ instruments: [], builtAt: "" })),
    getIsraelNews().catch(() => null),
  ]);

  // The session is read from the newest trade timestamp on the board, so
  // a short Friday or a holiday closure is described by what the market
  // actually did rather than by a calendar hardcoded here.
  const latestTrade =
    [...board.indices, ...board.leaders]
      .map((quote) => quote?.at ?? null)
      .filter((at): at is string => typeof at === "string")
      .sort((a, b) => b.localeCompare(a))[0] ?? null;

  const session = sessionFromData(latestTrade);

  const flagship = board.indices[0] ?? null;
  const broad = board.indices[1] ?? null;

  /* The quote joined to the curated row, once, here. Everything downstream
     — the session read, the sector read, the board — takes this shape and
     never has to know that the price and the sector label arrive from two
     different places, or that half the quotes can be null. */
  const names: LocalName[] = board.leaders.flatMap((quote, index) => {
    const meta = TASE_LEADERS[index];
    if (!quote || !meta) return [];
    return [
      {
        symbol: quote.symbol,
        name: quote.name,
        sector: meta.sector,
        usTicker: meta.usTicker,
        price: quote.price,
        changePercent: quote.changePercent,
        windowChangePercent: quote.windowChangePercent,
        windowSessions: quote.windowSessions,
        yearHigh: quote.yearHigh,
        yearLow: quote.yearLow,
        volume: quote.volume,
        averageVolume: quote.averageVolume,
        closes: quote.closes,
      },
    ];
  });

  const missing = board.leaders.filter((quote) => quote === null).length;

  const sessionRead = readSession({
    names,
    missing,
    flagship:
      flagship === null
        ? null
        : { name: flagship.name, changePercent: flagship.changePercent },
  });

  /* The denominator is the quoted list, not the curated fourteen, so the
     share printed in the structure section matches the rows on screen.
     How many failed to quote is reported separately and on its own. */
  const sectors = readSectors(names, names.length);

  /* The heaviest sector by headcount rather than by move — the structural
     fact about this market, which is a different question from where today
     went and therefore a different sort. */
  const heaviest = [...sectors].sort(
    (a, b) => b.names.length - a.names.length,
  )[0];

  /* ---- The shekel ----
     Not decoration on this page. For a reader in Israel holding American
     stocks, the dollar rate is part of the return in exactly the way the
     share price is. */
  const instrument = (symbol: string) =>
    macro.instruments.find((entry) => entry.symbol === symbol) ?? null;

  const ils = instrument("ILS=X");

  const shekelRead = readShekel({
    rate: ils?.value ?? null,
    changePercent: ils?.changePercent ?? null,
    yearLow: ils?.yearLow ?? null,
    yearHigh: ils?.yearHigh ?? null,
    /* Two American indices rather than one. They are the assets an Israeli
       reader is most likely to actually hold in dollars, and the second one
       is here because the pair disagreeing is itself informative. */
    references: ["^GSPC", "^IXIC"].flatMap((symbol) => {
      const found = instrument(symbol);
      return found === null
        ? []
        : [
            {
              symbol: found.symbol,
              name: found.name,
              changePercent: found.changePercent,
            },
          ];
    }),
    local:
      flagship === null
        ? null
        : { name: flagship.name, percent: flagship.changePercent },
  });

  /* ---- The two prices ---- */
  const crossListing = buildCrossListing({
    rate: ils?.value ?? null,
    rateAsOf: ils?.at ?? null,
    taseOpen: session.state === "open",
    rows: DUAL_LISTED.map((entry) => {
      const tase = board.leaders.find((quote) => quote?.symbol === entry.symbol);
      const us = usQuotes[entry.usTicker];
      return {
        taseSymbol: entry.symbol,
        usTicker: entry.usTicker,
        name: entry.name,
        sector: entry.sector,
        tasePrice: tase?.price ?? null,
        taseChangePercent: tase?.changePercent ?? null,
        usPrice: us?.price ?? null,
        usChangePercent: us?.changePercent ?? null,
      };
    }),
  });

  const flagshipPosition =
    flagship === null
      ? null
      : rangePosition(flagship.price, flagship.yearLow, flagship.yearHigh);

  return (
    <Page tint="#3b82f6" width="wide">
      <Hero
        eyebrow="תל אביב"
        title="השוק המקומי, באותם כלים"
        lede="ת״א 35 ות״א 125 וארבע-עשרה החברות המובילות, במחירים בשקלים — הבורסה מדווחת באגורות וההמרה נעשית פעם אחת במקור. מה שהעמוד מוסיף למחיר הוא ההקשר: רוחב המסחר מול המדד המשוקלל, מקום כל נייר בטווח השנה שלו, שער הדולר כחלק מהתשואה על כל נכס אמריקאי, ושמונה חברות שנסחרות גם בניו יורק ולכן יש להן כאן ניתוח מלא."
        image="/hero/tase.webp"
        imageAlt="הבורסה לניירות ערך בתל אביב"
        meta={
          <MarketStatus open={session.state === "open"} label={session.label} />
        }
        aside={
          flagship === null ? undefined : (
            /* The flagship index, with the shape of its month under it. A
               level on its own says nothing about whether it arrived there
               from above or from below, and that is the first thing a reader
               opening a market page wants to know. */
            <div className="surface p-5">
              <div className="flex items-start justify-between gap-4">
                <Stat
                  label={flagship.name}
                  value={points(flagship.price)}
                  size="lg"
                />
                <Delta value={flagship.changePercent} />
              </div>

              {flagship.closes.length > 1 && (
                <Sparkline
                  points={flagship.closes}
                  direction={
                    flagship.windowChangePercent === null ||
                    Math.abs(flagship.windowChangePercent) < 0.05
                      ? "flat"
                      : flagship.windowChangePercent > 0
                        ? "up"
                        : "down"
                  }
                  area
                  className="mt-4 h-14 w-full"
                />
              )}

              <p className="context-line mt-3">
                {flagship.windowSessions} מסחרים אחרונים{" "}
                <span className={`num ${directionClass(flagship.windowChangePercent)}`}>
                  {fmtPercent(flagship.windowChangePercent)}
                </span>
                {flagshipPosition !== null && (
                  <>
                    {" · "}
                    <span className="num">
                      {Math.round(flagshipPosition * 100)}%
                    </span>{" "}
                    מטווח 52 השבועות שלו
                  </>
                )}
              </p>
            </div>
          )
        }
        stats={
          <StatBar>
            {broad ? (
              <StatCell
                label={broad.name}
                value={points(broad.price)}
                sub={
                  <span className={`num ${directionClass(broad.changePercent)}`}>
                    {fmtPercent(broad.changePercent)}
                  </span>
                }
              />
            ) : (
              <StatCell label="מדד רחב" value="—" sub="הנתון לא התקבל" />
            )}

            {/* The cell the fallback below was written to stop.
                When every quote fails the breadth read is 0 of 0, and the
                masthead printed "0/0" under a sub-line explaining what the
                denominator meant — a figure that looks measured, says
                nothing, and is the exact print the section lower down
                replaces itself to avoid. A count off nothing is not zero,
                it is absent, so the cell falls back the way the broad index
                beside it does. */}
            {sessionRead.quoted > 0 ? (
              <StatCell
                label="רוחב המסחר"
                value={`${sessionRead.advancing}/${sessionRead.quoted}`}
                sub="ניירות בעלייה מתוך אלה שהחזירו ציטוט"
              />
            ) : (
              <StatCell
                label="רוחב המסחר"
                value="—"
                sub="אף נייר לא החזיר ציטוט, ולכן אין רוחב למדוד"
              />
            )}

            <StatCell
              label="דולר / שקל"
              value={
                shekelRead.rate === null ? "—" : `₪${shekelRead.rate.toFixed(3)}`
              }
              sub={
                <span
                  className={`num ${directionClass(shekelRead.changePercent)}`}
                >
                  {fmtPercent(shekelRead.changePercent)}
                </span>
              }
            />

            <StatCell
              label="רישום כפול"
              value={`${DUAL_LISTED.length}/${TASE_LEADERS.length}`}
              sub="רק אלה מגישות ל-SEC, ולכן רק להן יש ניתוח מלא"
            />
          </StatBar>
        }
      />

      <p className="mt-6 text-[11px] text-ink-ghost">
        עודכן {fmtRelative(new Date(board.fetchedAt))} · מצב המסחר נגזר מזמן
        העסקה האחרונה שהתקבלה, ולא מלוח שעות קבוע
        {missing > 0 && ` · ${missing} ניירות לא החזירו נתון ומוצגים כחסרים`}
      </p>

      {/* ---- What the session did ---- */}
      {/* When the feed fails, this page used to delete itself.

          getTaseBoard has no top-level catch and a single non-ok response
          turns every one of the fourteen leader quotes into null — so the
          joined list empties, the sector list empties, and the page rendered
          nothing at all while the header went on announcing "0/0 מניות
          בירוק". A page that quietly loses its only content is worse than a
          page that says it lost it, so the two sections that are actually
          built from those quotes — this one and the board below — are
          replaced by one that explains the absence.

          Two sections, and the count is load-bearing. The shekel panel used
          to be inside this branch and is not any more: it is built from the
          macro feed and from board.indices, both fetched separately from
          board.leaders, so it kept vanishing in the one scenario this
          fallback exists for while every figure it needed had arrived. */}
      {names.length === 0 ? (
        <Section eyebrow="המסחר המקומי" title="הציטוטים לא נענו">
          <Empty
            title="אין כרגע ציטוטים מתל אביב"
            reason="הציטוטים נמשכים דרך Yahoo, ובקשה אחת שנדחתה מרוקנת את כל הלוח. הנתונים חוזרים מעצמם בריענון הבא; שאר העמוד — המטבע, הצמד הכפול והחדשות — אינו תלוי בהם."
            links={[
              { href: "/heatmap", label: "מפת השוק" },
              { href: "/macro", label: "מאקרו" },
              { href: "/news", label: "חדשות" },
            ]}
          />
        </Section>
      ) : (
        <Section
          eyebrow="המסחר המקומי"
          title="מה המדד לא מספר"
          description="מדד משוקלל לפי שווי שוק הוא בעיקר שלושה בנקים. ממוצע שווה-משקל נותן לכל חברה קול אחד, והפער בין השניים הוא בדיוק הריכוזיות שהשוק הזה מוכר בה — נמדדת כאן ולא נטענת."
        >
          <TaseSession read={sessionRead} />
        </Section>
      )}

      {/* ---- The shekel ----
          Outside the branch above, on purpose. Every figure in this section
          comes from the macro board (ILS=X) and from the flagship index, and
          neither of those is board.leaders — so the fourteen leader quotes
          failing says nothing about whether this panel has its data.
          ShekelPanel reports its own absences: the three readings fall back
          to dashes with a reason, and the conversion table is replaced by an
          Empty when there is nothing to convert. */}
      <Section
        eyebrow="שער הדולר"
        title="חצי מהתשואה על מניה אמריקאית"
        description="למי שמודד בשקלים, תשואה דולרית נמדדת אחרי השינוי בשער, והשניים מוכפלים זה בזה ולא מחוברים. מניה שעלתה 8% בזמן שהדולר נחלש 5% הניבה 2.6%, לא 3%."
        action={<MoreLink href="/macro">לוח המאקרו</MoreLink>}
      >
        <ShekelPanel read={shekelRead} />
      </Section>

      {/* ---- Sectors and names ---- */}
      {names.length > 0 && (
        <Section
          eyebrow="סקטורים וחברות"
          title="איפה היה היום, ומי זז בחודש"
          description="כל סקטור נושא מספר במקום כותרת: כמה חברות בו, כמה מהן עלו, והממוצע שווה-המשקל שלו היום ובחודש. בכל שורה — המחיר, צורת החודש שהגיע אליו, המחזור מול הממוצע של אותו נייר, והמקום בטווח 52 השבועות שלו."
        >
          <TaseBoard sectors={sectors} />

          <p className="caption mt-3">
            המחזור מושווה לממוצע המסחרים שנסגרו בחלון של אותו נייר, ולא לממוצע
            הענף — חברה שנסחרת בעשירית מהמחזור של בנק לאומי אינה חריגה, היא
            פשוט קטנה ממנו. המסחר הנוכחי אינו נספר בממוצע כל עוד הוא פתוח.
          </p>
        </Section>
      )}

      {/* ---- The cross listing ---- */}
      <Section
        eyebrow="הצמד הכפול"
        title="אותה חברה, שני מחירים, שני מטבעות"
        description="שמונה מהחברות ברשימה נסחרות גם בוול סטריט ומגישות דוחות ל-SEC. זה מה שמאפשר להן ניתוח מלא באתר — ומאפשר להמיר את המחיר המקומי ולראות איזה צד כבר זז."
      >
        <div className="surface overflow-hidden">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-5 py-3.5">
            <DerivedMark title="חושב בקוד משני ציטוטים ומשער החליפין" />
            <span className="text-[12px] text-ink-muted">
              {crossListing.headline}
            </span>
            {/* Said in the header, not only in the footnote: with Tel Aviv
                shut, one of the table's six columns cannot be computed,
                and a column of dashes with no explanation reads as missing
                data rather than as a deliberate refusal. */}
            {session.state !== "open" && (
              <span
                className="badge"
                style={{ color: "var(--color-warning)" }}
                title="שינוי של 0.00% בתל אביב הוא היעדר מדידה, לא יום שטוח"
              >
                תל אביב סגורה · ״מי זז יותר״ אינו מחושב
              </span>
            )}
            <span className="ms-auto">
              <GradeChip grade={crossListing.claim.grade} />
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="dt min-w-[680px]">
              <caption className="sr-only">
                השוואת מחירים בין הבורסה בתל אביב לוול סטריט עבור שמונה חברות
                בעלות רישום כפול.
              </caption>
              <thead>
                <tr>
                  <th scope="col">חברה</th>
                  <th scope="col" className="n">
                    תל אביב
                  </th>
                  <th scope="col" className="n">
                    ניו יורק
                  </th>
                  <th scope="col" className="n">
                    מומר לדולר
                  </th>
                  <th scope="col" className="n">
                    פער
                  </th>
                  <th scope="col">מי זז יותר</th>
                </tr>
              </thead>
              <tbody>
                {crossListing.rows.map((row) => (
                  <tr key={row.taseSymbol}>
                    <td>
                      <Link
                        href={`/company/${row.usTicker}`}
                        className="flex items-center gap-2.5"
                      >
                        <span className="min-w-0">
                          <span className="block text-[13px] text-ink">
                            {row.name}
                          </span>
                          <span className="num block text-[10px] text-ink-faint">
                            {row.usTicker} · {row.sector}
                          </span>
                        </span>
                      </Link>
                    </td>

                    <td className="n">
                      <span className="block text-ink">
                        {shekel(row.tasePrice)}
                      </span>
                      <span
                        className={`block text-[10px] ${directionClass(row.taseChangePercent)}`}
                      >
                        {fmtPercent(row.taseChangePercent)}
                      </span>
                    </td>

                    <td className="n">
                      <span className="block text-ink">
                        {dollar(row.usPrice)}
                      </span>
                      <span
                        className={`block text-[10px] ${directionClass(row.usChangePercent)}`}
                      >
                        {fmtPercent(row.usChangePercent)}
                      </span>
                    </td>

                    <td className="n text-ink-muted">{dollar(row.impliedUsd)}</td>

                    {/* Never coloured green or red. A positive gap is not
                        good news — it is a timing artefact, and colouring
                        it would say otherwise. */}
                    <td className="n text-ink-muted">
                      {row.gapPercent === null
                        ? "—"
                        : `${row.gapPercent > 0 ? "+" : row.gapPercent < 0 ? "−" : ""}${Math.abs(row.gapPercent).toFixed(1)}%`}
                    </td>

                    <td>
                      <span className="badge">
                        {row.leader === "us"
                          ? "ניו יורק"
                          : row.leader === "tase"
                            ? "תל אביב"
                            : row.leader === "even"
                              ? "שווה"
                              : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-line bg-element/70 px-5 py-4">
            <p className="num text-[11px] text-ink-faint">
              {crossListing.claim.basis}
            </p>
            <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-ink-ghost">
              {crossListing.claim.limits}
            </p>
          </div>
        </div>
      </Section>

      {/* ---- News ---- */}
      <Section
        eyebrow="חדשות"
        title="מה נכתב על החברות הישראליות"
        description="הפיד הכללי של האתר הוא אמריקאי ואינו מכסה את ישראל — נמדד: תשעים כתבות, אפס אזכורים. לכן החדשות כאן נשאלות לפי סימבול, על שמונה החברות עם הרישום הכפול."
        action={<MoreLink href="/news">הפיד האמריקאי</MoreLink>}
      >
        {!news || news.stories.length === 0 ? (
          <Empty
            title="לא התקבלו כתבות על החברות הישראליות"
            reason="הספק מחזיר חדשות לפי סימבול, ועל שמונה החברות האלה לא נקלט דבר בשלושת השבועות האחרונים — או שהבקשה נחסמה במגבלת קצב. זה לא אומר שלא קרה כלום בשוק המקומי."
            links={[
              { href: "/news", label: "הפיד האמריקאי" },
              { href: "/macro", label: "לוח המאקרו" },
            ]}
          />
        ) : (
          <>
            <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {news.stories.slice(0, 12).map((story) => (
                <article key={story.url} className="surface lift flex flex-col p-4">
                  <div className="mb-2.5 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/company/${story.ticker}`}
                      className="num rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-faint transition-colors hover:border-line-strong hover:text-ink"
                    >
                      {story.ticker}
                    </Link>
                    <span className="badge">{story.hebrewName}</span>
                    {story.triage.kind === "catalyst" && (
                      <span
                        className="badge"
                        style={{ color: "var(--color-accent)" }}
                        title={story.triage.reason}
                      >
                        זרז אפשרי
                      </span>
                    )}
                    <span className="ms-auto text-[10px] text-ink-ghost">
                      {fmtRelative(new Date(story.publishedAt))}
                    </span>
                  </div>

                  <a
                    href={story.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] font-medium leading-snug text-ink transition-colors hover:text-accent"
                    dir="auto"
                  >
                    {story.headline}
                  </a>

                  {story.summary && (
                    <p
                      className="mt-2 line-clamp-3 flex-1 text-[12px] leading-relaxed text-ink-faint"
                      dir="auto"
                    >
                      {story.summary}
                    </p>
                  )}

                  <p className="mt-3 border-t border-line pt-2.5 text-[11px] leading-relaxed text-ink-ghost">
                    <span className="text-ink-faint">סיווג ראשוני: </span>
                    {story.triage.reason}
                  </p>

                  {story.source && (
                    <p className="mt-1.5 text-[10px] text-ink-ghost" dir="auto">
                      {story.source}
                    </p>
                  )}
                </article>
              ))}
            </div>

            <p className="caption mt-4">
              {news.covered} מתוך {news.total} החברות החזירו כתבות · נאסף{" "}
              {fmtRelative(new Date(news.fetchedAt))} · הסיווג הוא לפי כללים
              ונעשה ברגע הקליטה, לפני שהכתבה נקראה במלואה
            </p>
          </>
        )}
      </Section>

      {/* ---- Structure ---- */}
      <Section
        eyebrow="מבנה השוק"
        title="למה המדד המקומי מתנהג אחרת"
        description="ריכוזיות היא לא ביקורת — היא עובדה שצריך להכיר לפני שמשווים את ת״א 35 ל-S&P 500."
      >
        <Band columns={3}>
          <Field
            label="הסקטור הכבד ברשימה"
            value={heaviest ? heaviest.sector : "—"}
            context={
              heaviest
                ? `${heaviest.names.length} מתוך ${names.length} החברות שהעמוד עוקב אחריהן — ${Math.round(heaviest.share * 100)}% מהרשימה. מדד צר נע לפי מעט מאוד סיפורים.`
                : "לא התקבלו ציטוטים, ולכן אין רשימה למדוד עליה ריכוזיות"
            }
          />
          <Field
            label="רישום כפול"
            value={`${DUAL_LISTED.length}/${TASE_LEADERS.length}`}
            context="רק לאלה יש כאן מבחן ליבה, תזה והשוואה לחציון — כי רק הן מגישות ל-SEC."
          />
          <Field
            label="המדד מול שווה-המשקל"
            value={
              sessionRead.concentration === null
                ? "—"
                : `${sessionRead.concentration.difference > 0 ? "+" : sessionRead.concentration.difference < 0 ? "−" : ""}${Math.abs(sessionRead.concentration.difference).toFixed(2)}`
            }
            context={
              sessionRead.concentration === null
                ? "אין מדד ואין ממוצע להשוות ביניהם כרגע"
                : "נקודות אחוז, מדד הדגל פחות הממוצע השווה. חיובי פירושו שהיום קרה בגדולות; שלילי, שהוא קרה בקטנות."
            }
          />
        </Band>

        <div className="surface mt-4 space-y-3 p-6 text-[13px] leading-relaxed text-ink-muted">
          <p>
            <span className="text-ink">מה שאין כאן, ולמה. </span>
            אין מבחן ליבה, אין תזה ואין חציוני סקטור לחברות שנסחרות רק בתל
            אביב — ובטבלה למעלה הן מסומנות ״מחיר בלבד״ ולא נשארות ריקות. כל
            אלה מחושבים מדוחות XBRL שמוגשים ל-SEC, והחברות המקומיות אינן
            מגישות לשם. להוסיף מדדים בלי דוחות מובנים פירושו לנחש, והכלל באתר
            הוא שמספר שאי אפשר לחשב נשאר חסר.
          </p>
          <p>
            <span className="text-ink">מה שכן. </span>
            שמונה החברות עם הרישום הכפול — אלביט, נייס, נובה, קמטק, טאואר,
            טבע, כיל ואורמת — מקבלות את מלוא הטיפול תחת הסימבול האמריקאי שלהן.
            טבלת הצמד הכפול היא הגשר: לחיצה על שם מגיעה לניתוח המלא.
          </p>
          <p>
            <span className="text-ink">מה שנמדד ולא נאמד. </span>
            הרוחב, הממוצע השווה, המחזור מול הממוצע והמקום בטווח השנה חושבו
            מציטוטים שהתקבלו, ולא מהערכה. אין בעמוד הזה ציון, דירוג או ניקוד
            מורכב — לא מפני שאי אפשר לחשב אחד, אלא מפני שציון מסתיר את
            החישוב שהוביל אליו, והחישוב הוא כל מה שיש כאן.
          </p>
          <p className="text-ink-faint">
            החדשות בעמוד הזה נשאלות לפי אותם שמונה סימבולים. בנק שנסחר רק בתל
            אביב לא יופיע בהן, וזה נאמר כאן במקום להיראות כמו כיסוי מלא.
          </p>
        </div>
      </Section>

      <Disclaimer extra="הנתונים מהבורסה בתל אביב מתקבלים ממקור ציבורי בהשהיה ואינם מסחר בזמן אמת. המרת תשואה דולרית לשקלים היא אריתמטיקה על מחירים ולא המלצה לגדר מטבע. הפער בין שני הרישומים אינו הזדמנות ארביטראז׳ — הוא מודד בעיקר את הפרש שעות הסגירה. אין באמור המלצה לקנות או למכור נייר ערך כלשהו." />
    </Page>
  );
}
