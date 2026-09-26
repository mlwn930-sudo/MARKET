import Link from "next/link";
import {
  TASE_LEADERS,
  getTaseBoard,
  sessionFromData,
  type TaseQuote,
} from "@/lib/sources/tase";
import { DUAL_LISTED } from "@/lib/tase-universe";
import { getBoardQuotes, type BoardQuote } from "@/lib/sources/board-quotes";
import { getMacroBoard } from "@/lib/sources/macro";
import { getIsraelNews } from "@/lib/israel-news";
import { buildCrossListing } from "@/lib/analysis/cross-listing";
import { GradeChip, DerivedMark } from "@/components/SignalCard";
import {
  Band,
  Disclaimer,
  Empty,
  Field,
  Hero,
  MoreLink,
  Page,
  Section,
  StatBar,
  StatCell,
} from "@/components/ui";
import {
  directionClass,
  fmtCompact,
  fmtPercent,
  fmtRelative,
} from "@/lib/format";

export const revalidate = 120;

export const metadata = {
  title: "הבורסה בתל אביב",
  description:
    "ת״א 35, ת״א 125 והמניות המובילות — מחירים בשקלים, הצמד הכפול מול וול סטריט, חדשות על החברות הישראליות ושער הדולר כחלק מהתשואה.",
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

function Row({ quote, sector }: { quote: TaseQuote; sector: string }) {
  const range =
    quote.yearHigh !== null &&
    quote.yearLow !== null &&
    quote.price !== null &&
    quote.yearHigh > quote.yearLow
      ? (quote.price - quote.yearLow) / (quote.yearHigh - quote.yearLow)
      : null;

  const dual = DUAL_LISTED.find((entry) => entry.symbol === quote.symbol);

  return (
    <div className="row grid-cols-[1fr_auto] gap-4 sm:grid-cols-[1.3fr_auto_auto_auto]">
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-ink">{quote.name}</span>
          {/* The badge that matters most on this page: it is the
              difference between a price and a full analysis. */}
          {dual && (
            <Link
              href={`/company/${dual.usTicker}`}
              className="num rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-faint transition-colors hover:border-line-strong hover:text-ink"
              title={`${quote.name} נסחרת גם בניו יורק ומגישה ל-SEC — יש לה ניתוח מלא באתר`}
            >
              {dual.usTicker}
            </Link>
          )}
        </span>
        <span className="num block text-[11px] text-ink-faint" dir="ltr">
          {quote.symbol.replace(".TA", "")} · {sector}
        </span>
      </span>

      <span className="text-end">
        <span className="num block text-[14px] text-ink">
          {shekel(quote.price)}
        </span>
        <span
          className={`num block text-[11px] ${directionClass(quote.changePercent)}`}
        >
          {fmtPercent(quote.changePercent)}
        </span>
      </span>

      {/* Where it sits in its own year. The single most useful piece of
          context a price can carry, and the cheapest to compute. */}
      <span className="hidden w-32 self-center sm:block">
        {range === null ? (
          <span className="text-[11px] text-ink-ghost">—</span>
        ) : (
          <>
            <span className="relative block h-[3px] w-full rounded-full bg-overlay">
              <span
                className="absolute top-1/2 h-2.5 w-[2px] -translate-y-1/2 rounded-full bg-ink"
                style={{ insetInlineStart: `${Math.max(0, Math.min(range, 1)) * 100}%` }}
              />
            </span>
            <span className="num mt-1 block text-[10px] text-ink-ghost">
              {shekel(quote.yearLow)} – {shekel(quote.yearHigh)}
            </span>
          </>
        )}
      </span>

      <span className="hidden text-end sm:block">
        <span className="block text-[10px] text-ink-ghost">מחזור</span>
        <span className="num block text-[12px] text-ink-muted">
          {quote.volume === null ? "—" : fmtCompact(quote.volume)}
        </span>
      </span>
    </div>
  );
}

export default async function IsraelPage() {
  const usTickers = DUAL_LISTED.map((entry) => entry.usTicker);

  const [board, usQuotes, macro, news] = await Promise.all([
    getTaseBoard(),
    /* One spark request for all eight, through the shared board cache —
       the same path the market map uses, for the same reason. */
    getBoardQuotes(usTickers).catch(
      () => ({}) as Record<string, BoardQuote>,
    ),
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

  const leaders = board.leaders
    .map((quote, i) => ({ quote, meta: TASE_LEADERS[i] }))
    .filter(
      (row): row is { quote: TaseQuote; meta: (typeof TASE_LEADERS)[number] } =>
        row.quote !== null,
    );

  const sectors = [...new Set(leaders.map((row) => row.meta.sector))];

  const advancing = leaders.filter(
    (row) => (row.quote.changePercent ?? 0) > 0,
  ).length;

  const missing = board.leaders.filter((quote) => quote === null).length;

  /* ---- The shekel ----
     Not decoration on this page. For a reader in Israel holding American
     stocks, the dollar rate is part of the return in exactly the way the
     share price is. */
  const ils =
    macro.instruments.find((instrument) => instrument.symbol === "ILS=X") ??
    null;

  /* ---- The two prices ---- */
  const crossListing = buildCrossListing({
    rate: ils?.value ?? null,
    rateAsOf: ils?.at ?? null,
    taseOpen: session.state === "open",
    rows: DUAL_LISTED.map((entry) => {
      const tase = board.leaders.find(
        (quote) => quote?.symbol === entry.symbol,
      );
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

  /* ---- Concentration ----
     The flagship index is famously narrow. Measured from the curated list
     rather than asserted, so the sentence carries a figure. */
  const bySector = sectors.map((sector) => ({
    sector,
    count: leaders.filter((row) => row.meta.sector === sector).length,
  }));
  const biggest = [...bySector].sort((a, b) => b.count - a.count)[0];

  return (
    <Page tint="#3b82f6" width="wide">
      <Hero
        eyebrow="תל אביב"
        title="השוק המקומי, באותם כלים"
        lede="ת״א 35 ות״א 125 והמניות המובילות. המחירים בשקלים — הבורסה מדווחת באגורות וההמרה נעשית פעם אחת במקור — ולצידם הדבר שמבדיל את העמוד הזה: שמונה מהחברות נסחרות גם בניו יורק, ולכן יש להן כאן ניתוח מלא ואפשר להעמיד שני מחירים זה מול זה."
        image="/hero/tase.webp"
        imageAlt="הבורסה לניירות ערך בתל אביב"
        stats={
          <StatBar>
            {board.indices.map((index, i) =>
              index ? (
                <StatCell
                  key={index.symbol}
                  label={index.name}
                  value={
                    index.price === null
                      ? "—"
                      : index.price.toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })
                  }
                  sub={
                    <span className={`num ${directionClass(index.changePercent)}`}>
                      {fmtPercent(index.changePercent)}
                    </span>
                  }
                />
              ) : (
                <StatCell
                  key={`missing-${i}`}
                  label="מדד"
                  value="—"
                  sub="הנתון לא התקבל"
                />
              ),
            )}
            <StatCell
              label="מניות בירוק"
              value={`${advancing}/${leaders.length}`}
            />
            <StatCell
              label="מצב המסחר"
              value={<span className="text-base">{session.label}</span>}
            />
          </StatBar>
        }
      />

      <p className="mt-6 text-[11px] text-ink-ghost">
        עודכן {fmtRelative(new Date(board.fetchedAt))} · מצב המסחר נגזר מזמן
        העסקה האחרונה שהתקבלה, ולא מלוח שעות קבוע
        {missing > 0 && ` · ${missing} ניירות לא החזירו נתון ומוצגים כחסרים`}
      </p>

      {/* ---- The cross listing ---- */}
      <Section
        eyebrow="הצמד הכפול"
        title="אותה חברה, שני מחירים, שתי מטבעות"
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

          <div className="border-t border-line bg-base/40 px-5 py-4">
            <p className="num text-[11px] text-ink-faint">
              {crossListing.claim.basis}
            </p>
            <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-ink-ghost">
              {crossListing.claim.limits}
            </p>
          </div>
        </div>
      </Section>

      {/* ---- The shekel ---- */}
      {ils && (
        <Section
          eyebrow="שער הדולר"
          title="חצי מהתשואה על מניה אמריקאית"
          description="למשקיע שחי בשקלים, תשואה דולרית נמדדת אחרי השינוי בשער. מניה שעלתה 8% בזמן שהדולר נחלש 5% הניבה שלושה."
          tight
        >
          <Band columns={3}>
            <Field
              label="דולר / שקל"
              value={ils.value === null ? "—" : `₪${ils.value.toFixed(3)}`}
              context={
                ils.changePercent !== null
                  ? `${fmtPercent(ils.changePercent)} היום`
                  : undefined
              }
              tone="neutral"
            />
            <Field
              label="טווח השנה"
              value={
                ils.yearLow !== null && ils.yearHigh !== null
                  ? `${ils.yearLow.toFixed(2)} – ${ils.yearHigh.toFixed(2)}`
                  : "—"
              }
              context="שער נמוך מיטיב עם מי שקונה דולרים, ופוגע במי שכבר מחזיק נכסים דולריים"
            />
            <Field
              label="מה זה עושה לתיק"
              value={
                <span className="text-[13px] leading-snug text-ink-muted">
                  {ils.note}
                </span>
              }
            />
          </Band>
        </Section>
      )}

      {/* ---- The leaders ---- */}
      {sectors.map((sector) => (
        <Section key={sector} eyebrow="מניות" title={sector} tight>
          <div className="surface overflow-hidden">
            {leaders
              .filter((row) => row.meta.sector === sector)
              .map((row) => (
                <Row
                  key={row.quote.symbol}
                  quote={row.quote}
                  sector={row.meta.sector}
                />
              ))}
          </div>
        </Section>
      ))}

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
            value={biggest ? biggest.sector : "—"}
            context={
              biggest
                ? `${biggest.count} מתוך ${leaders.length} החברות שהעמוד עוקב אחריהן. מדד צר נע לפי מעט מאוד סיפורים.`
                : undefined
            }
          />
          <Field
            label="רישום כפול"
            value={`${DUAL_LISTED.length}/${TASE_LEADERS.length}`}
            context="רק לאלה יש כאן מבחן ליבה, תזה והשוואה לחציון — כי רק הן מגישות ל-SEC."
          />
          <Field
            label="רוחב היום"
            value={`${advancing}/${leaders.length}`}
            context="כמה מהמניות ברשימה נסחרות בירוק. רוחב חיובי בשוק צר אומר פחות מאשר באותו רוחב בשוק רחב."
          />
        </Band>

        <div className="surface mt-4 space-y-3 p-6 text-[13px] leading-relaxed text-ink-muted">
          <p>
            <span className="text-ink">מה שאין כאן, ולמה. </span>
            אין מבחן ליבה, אין תזה ואין חציוני סקטור לחברות שנסחרות רק בתל
            אביב. כל אלה מחושבים מדוחות XBRL שמוגשים ל-SEC, והחברות המקומיות
            אינן מגישות לשם. להוסיף מדדים בלי דוחות מובנים פירושו לנחש, והכלל
            באתר הוא שמספר שאי אפשר לחשב נשאר חסר.
          </p>
          <p>
            <span className="text-ink">מה שכן. </span>
            שמונה החברות עם הרישום הכפול — אלביט, נייס, נובה, קמטק, טאואר,
            טבע, כיל ואורמת — מקבלות את מלוא הטיפול תחת הסימבול האמריקאי שלהן.
            הטבלה למעלה היא הגשר: לחיצה על שם מגיעה לניתוח המלא.
          </p>
          <p className="text-ink-faint">
            החדשות בעמוד הזה נשאלות לפי אותם שמונה סימבולים. בנק שנסחר רק בתל
            אביב לא יופיע בהן, וזה נאמר כאן במקום להיראות כמו כיסוי מלא.
          </p>
        </div>
      </Section>

      <Disclaimer extra="הנתונים מהבורסה בתל אביב מתקבלים ממקור ציבורי בהשהיה ואינם מסחר בזמן אמת. הפער בין שני הרישומים אינו הזדמנות ארביטראז׳ — הוא מודד בעיקר את הפרש שעות הסגירה. אין באמור המלצה לקנות או למכור נייר ערך כלשהו." />
    </Page>
  );
}
