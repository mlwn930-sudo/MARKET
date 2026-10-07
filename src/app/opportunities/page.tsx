import Link from "next/link";
import { FilmBand } from "@/components/market/FilmBand";
import { runScreen, type ScreenResult } from "@/lib/screener";
import { readScreen, type ReadingSegment } from "@/lib/analysis/screen-reading";
import { identityFor } from "@/lib/company-identity";
import {
  Band,
  Disclaimer,
  Empty,
  Field,
  Hero,
  Meter,
  Page,
  Section,
  StatBar,
  StatCell,
} from "@/components/ui";
import { fmtCompact, fmtDate } from "@/lib/format";

export const revalidate = 600;

export const metadata = {
  title: "רדאר הזדמנויות",
  description:
    "48 חברות מול קריטריונים של איכות, צמיחה, תמחור ואיתנות — כל אחת עם הפרופיל שלה, לא עם ציון בודד.",
};

/**
 * The radar.
 *
 * The screener produces a score, and a score is the least useful thing it
 * knows. Two companies on seven out of ten can be opposites — one cheap and
 * shrinking, one expensive and compounding — and a list sorted by the total
 * hides exactly that.
 *
 * So each company is shown as a profile across four axes instead. The score
 * is still there, small, as an index into the list; the shape beside it is
 * what actually distinguishes one row from the next. The reader compares
 * shapes, which is a thing eyes are good at, rather than reading forty
 * numbers.
 *
 * No overall ranking of "best". The site presents the measurements; which
 * of them matters is the reader's call and depends on what they already own.
 */

/**
 * The grouping moved out.
 *
 * The four axes used to be declared here and matched against criterion keys
 * by substring, which quietly mis-filed three of the ten tests: `rev_growth`
 * contains "ev" and `ev_fcf` contains "fcf", so growth was counted inside
 * the valuation meter and cash flow inside both quality and valuation. The
 * valuation column showed four tests out of a group that holds two.
 *
 * Both the meters and the written reading now come from readScreen(), which
 * names the keys exactly. One grouping, so the shape above a row and the
 * sentence inside it cannot say different things.
 */

/** A reading's text, with every figure set in the tabular face.
 *
 *  Not decoration: a number dropped raw into an RTL paragraph lets bidi
 *  move a leading minus to the far end of the digits, which turns −3.1%
 *  into something else entirely. This is why the module hands back segments
 *  instead of a finished string. */
function Segments({ parts }: { parts: ReadingSegment[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.num ? (
          <span key={index} className="num">
            {part.text}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/**
 * How many companies a page of the register carries.
 *
 * The whole universe used to render at once. At 47 companies that was a
 * long page; at 123 it was 2.2MB of HTML and thirteen thousand elements,
 * because every row carries its full criteria breakdown whether or not it
 * is open. Measured, not estimated — and it got that way when the universe
 * widened, which is the kind of cost that arrives quietly.
 *
 * Nothing is hidden by this. The ranking is over all of them, the counts
 * above are over all of them, and every company is one link away.
 */
const PER_PAGE = 25;

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { builtAt, results } = await runScreen().catch(() => ({
    builtAt: "",
    results: [] as ScreenResult[],
  }));

  if (results.length === 0) {
    return (
      <Page width="read">
        <Hero
          eyebrow="רדאר הזדמנויות"
          title="הסורק עדיין לא נבנה"
          lede="הסורק קורא קובץ מדדים שנבנה מדוחות SEC בסקריפט לילי. עד שהוא רץ פעם אחת אין ליקום ההשוואה חציונים, ובלי חציון אין מול מה לבדוק."
        />
        <div className="gap-section-tight">
          <Empty
            title="קובץ המדדים ריק"
            reason="הרצה אחת של npm run build:fundamentals מושכת את הדוחות ובונה את החציונים לתשעת הסקטורים."
            links={[
              { href: "/heatmap", label: "מפת השוק" },
              { href: "/sectors", label: "סקטורים" },
              { href: "/news", label: "חדשות" },
            ]}
          />
        </div>
        <Disclaimer />
      </Page>
    );
  }

  const maxScore = results[0]?.maxScore ?? 0;
  // Measured against what could be tested, not against every criterion —
  // otherwise a company is marked down for a figure its filings never carried.
  const strong = results.filter(
    (r) => r.evaluatedCount > 0 && r.score >= r.evaluatedCount * 0.7,
  ).length;
  const median = results[Math.floor(results.length / 2)]?.score ?? 0;

  const pages = Math.max(1, Math.ceil(results.length / PER_PAGE));
  const current = Math.min(page, pages);
  const shown = results.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const firstRank = (current - 1) * PER_PAGE + 1;

  return (
    <Page tint="#2855f5">
      <Hero
        eyebrow="רדאר הזדמנויות"
        title="לא מי הכי טובה — מי חזקה במה"
        lede="כל חברה נבדקת מול קריטריונים כמותיים, רובם מול חציון הסקטור שלה. מה שמוצג הוא הפרופיל, לא דירוג: שתי חברות באותו ציון יכולות להיות הפוכות זו מזו."
        image="/hero/opportunities.webp"
        imageAlt=""
        stats={
          <StatBar>
            <StatCell label="חברות נבדקו" value={results.length} />
            <StatCell label="קריטריונים" value={maxScore} />
            <StatCell
              label="עברו 70% ומעלה"
              value={strong}
              sub="ציון גבוה אינו המלצה"
            />
            <StatCell
              label="ציון חציוני"
              value={
                <>
                  {median}
                  <span className="text-ink-ghost">/{maxScore}</span>
                </>
              }
            />
          </StatBar>
        }
      />

      <p
        className="surface gap-section-tight border-s-2 px-5 py-4 text-[13px] leading-relaxed text-ink-muted"
        style={{ borderInlineStartColor: "var(--color-warning)" }}
      >
        <strong className="font-medium text-ink">זה סינון, לא המלצה.</strong>{" "}
        ציון גבוה אומר שהחברה עברה יותר מבחנים כמותיים — לא שכדאי לקנות אותה.
        קריטריון שאי אפשר לחשב מסומן כ"אין נתון" ואינו נספר ככישלון: נתון
        חסר אינו הוכחה לאיכות, אבל גם אינו ראיה נגדה.
        {builtAt && (
          <span className="mt-1 block text-[11px] text-ink-ghost">
            נבנה <span className="num">{fmtDate(builtAt.slice(0, 10))}</span>
          </span>
        )}
      </p>

      <Section
        eyebrow="הפרופילים"
        title="כל החברות ביקום ההשוואה"
        description={`מדורגות לפי ציון. מוצגות ${firstRank}–${firstRank + shown.length - 1} מתוך ${results.length}.`}
      >
        {/* One surface, a page of rows, hairlines between them — not a
            panel per company. A card each made the list read as a shelf of
            products; a divided list reads as a register, which is what it
            is, and it lets the four profile meters line up into columns
            the eye can run down. */}
        <div className="surface divide-y divide-line overflow-hidden">
          {shown.map((result) => {
            const reading = readScreen(result);
            const identity = identityFor(result.company.ticker);

            return (
              <details
                key={result.company.ticker}
                className="group transition-colors open:bg-element hover:bg-element/60"
              >
                {/* `block`, not the default `list-item`: a summary that keeps
                    list-item display draws the browser's own disclosure
                    triangle, and this row already has one of its own. */}
                <summary className="block cursor-pointer p-4">
                  <div className="grid grid-cols-1 items-center gap-4 lg:grid-cols-[minmax(200px,1.1fr)_2.4fr_auto]">
                    {/* Identity */}
                    <div className="flex items-center gap-3">
                      <span
                        className="h-9 w-[3px] shrink-0 rounded-full"
                        style={{ background: identity.accent }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="num text-[14px] font-medium text-ink">
                          {result.company.ticker}
                        </div>
                        <div className="truncate text-[11px] text-ink-faint">
                          {result.company.name}
                        </div>
                        <div className="mt-0.5 text-[10px] text-ink-ghost">
                          {result.sectorLabel}
                          {result.company.marketCap !== null && (
                            <>
                              {" · "}
                              <span className="num">
                                ${fmtCompact(result.company.marketCap)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
  
                    {/* The profile — the part worth comparing */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                      {reading.axes.map((axis) => (
                        <Meter
                          key={axis.key}
                          label={axis.label}
                          value={axis.passed}
                          max={axis.total}
                        />
                      ))}
                    </div>
  
                    {/* Score, small: an index into the list, not a verdict */}
                    <div className="flex items-center justify-between gap-3 lg:justify-end">
                      {/* What the market is doing with it — a separate
                          figure, deliberately not folded into the score
                          beside it. A company passing eight tests at rank 5
                          and one passing eight at rank 85 are opposite
                          situations: the first is cheap and being sold, the
                          second is cheap and being bought. A sum cannot say
                          which, and that distinction is the most useful
                          thing this page can draw. */}
                      {result.market?.strengthRank != null && (
                        <span className="screen-rank" title={`דירוג כוח יחסי מול ${result.market.universe} החברות ביקום המחקר, נכון ל-${result.market.asOf}`}>
                          <span className="screen-rank-label">כוח יחסי</span>
                          <span className="num screen-rank-value">
                            {result.market.strengthRank}
                            <span className="text-ink-ghost">/99</span>
                          </span>
                        </span>
                      )}
                      <span className="text-end">
                        <span className="num text-[15px]">
                          <span className="text-ink">{result.score}</span>
                          <span className="text-ink-ghost">/{result.evaluatedCount}</span>
                        </span>
                        {result.insufficientCount > 0 && (
                          <span className="mt-0.5 block text-[9px] text-ink-ghost">
                            {result.insufficientCount} ללא נתון
                          </span>
                        )}
                      </span>
                      <span
                        className="text-[11px] text-ink-ghost transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      >
                        ▾
                      </span>
                    </div>
                  </div>

                  {/* The reason, in the row itself.
                      The meters say where the company is strong; this says
                      what that adds up to and, when there is one, which
                      single test holds the other side. It sits in the
                      summary rather than behind the disclosure because a
                      reader scanning the register is exactly the reader who
                      needs it — the breakdown below is for the one who has
                      already decided to look. */}
                  <p className="screen-lead">
                    <Segments parts={reading.lead} />
                  </p>
                </summary>

                {/* The working, on demand */}
                <div className="border-t border-line bg-element/70 p-4">
                  {/* ---- The argument ----
                       Four groups of tests, each with what it found and what
                       the group means read together, ordered so the
                       supporting evidence comes first and the part that
                       argues the other way is not buried at the bottom.

                       Every sentence here is selected by a branch over the
                       criteria in lib/analysis/screen-reading.ts. No model
                       is called, which is what makes it free, identical
                       between builds, and impossible to drift from the
                       numbers beside it. */}
                  <div className="screen-read">
                    {/* A company whose filings support nothing has no groups
                        to show. The heading goes with them — a title over an
                        empty grid reads as a loading failure. What stays is
                        the absent-data line below, which is the whole of what
                        is known about it. */}
                    {reading.clauses.length > 0 && (
                      <h4 className="eyebrow">מה המבחנים אומרים יחד</h4>
                    )}

                    <div className="screen-claims">
                      {reading.clauses.map((clause) => (
                        <div
                          key={clause.key}
                          className="screen-claim"
                          data-tone={clause.tone}
                        >
                          <div className="screen-claim-head">
                            <span>{clause.label}</span>
                            <span className="num">
                              {clause.passed}/{clause.total}
                            </span>
                          </div>
                          {clause.counters.length > 0 && (
                            /* Only what did not pass. What did is in the
                               count above and in the ledger below, and a
                               third copy of the same ten rows is weight
                               rather than information. */
                            <p className="screen-claim-counters">
                              {clause.counters.map((counter) => (
                                <span key={counter.label}>
                                  {counter.label}
                                  <b className="num">{counter.detail}</b>
                                  {counter.benchmark && (
                                    <i className="screen-bar num">{counter.benchmark}</i>
                                  )}
                                </span>
                              ))}
                            </p>
                          )}
                          <p className="screen-claim-meaning">{clause.meaning}</p>
                        </div>
                      ))}
                    </div>

                    {reading.tension && (
                      /* The half a score always loses. Gold, because on this
                         site gold marks a caveat — and a caveat in the
                         evidence is what this is. */
                      <p className="screen-tension">
                        <b>איפה הראיות לא מסכימות</b>
                        {reading.tension}
                      </p>
                    )}

                    {reading.missing && (
                      <p className="screen-read-absent">
                        <Segments parts={reading.missing} />
                      </p>
                    )}
                  </div>

                  <div className="screen-ledger grid gap-x-8 gap-y-2 sm:grid-cols-2">
                    {result.criteria.map((criterion) => (
                      <div
                        key={criterion.key}
                        className="flex items-start justify-between gap-3 border-b border-line py-2 last:border-b-0"
                      >
                        {/* The label and the result, and not the
                            explanation. Every criterion's explanation is
                            identical for all forty-eight companies, and
                            emitting it inside each row shipped the same
                            ten Hebrew sentences four hundred and eighty
                            times — three megabytes of HTML on a page a
                            reader opens on a phone. They are printed once,
                            in the glossary below. */}
                        <span className="flex items-start gap-2">
                          <span
                            className={`num mt-px w-3 shrink-0 text-[11px] ${
                              criterion.status === "pass"
                                ? "text-ink"
                                : criterion.status === "fail"
                                  ? "text-ink-ghost"
                                  : "text-ink-ghost/70"
                            }`}
                            aria-hidden="true"
                          >
                            {criterion.status === "pass"
                              ? "✓"
                              : criterion.status === "fail"
                                ? "✕"
                                : "·"}
                          </span>
                          <span className="text-[12px] text-ink-muted">
                            {criterion.label}
                            {criterion.status === "insufficient-data" && (
                              <span className="ms-2 text-[10px] text-ink-ghost">אין נתון</span>
                            )}
                          </span>
                        </span>
                        {/* The figure and the bar it was judged against.
                            Rule 5: 42.1 is a datum, "42.1 against a sector
                            median of 31.4" is the thing a reader can use. */}
                        <span className="shrink-0 text-[11px] text-ink-faint">
                          <span className="num">{criterion.detail}</span>
                          {criterion.benchmark && criterion.status !== "insufficient-data" && (
                            <span className="screen-bar num">{criterion.benchmark}</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    {/* The recap of failures and missing figures that used to
                        sit here is gone: the reading above names both, with
                        what each one means, and printing the same two lists a
                        second time only made the panel longer. */}
                    <p className="text-[11px] text-ink-ghost">
                      הבדיקות נגזרות מהדוח המוגש האחרון ומחציון {result.sectorLabel}.
                    </p>
                    <Link
                      href={`/company/${result.company.ticker}`}
                      className="btn btn-ghost"
                    >
                      לניתוח המלא
                    </Link>
                  </div>
                </div>
              </details>
            );
          })}
        </div>

        {pages > 1 && (
          /* Plain links, not a control. The register is server-rendered and
             a reader who wants page four should be able to link someone to
             page four. */
          <nav className="screen-pages" aria-label="עמודי הרשימה">
            {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
              <a
                key={number}
                href={number === 1 ? "/opportunities" : `/opportunities?page=${number}`}
                aria-current={number === current ? "page" : undefined}
              >
                {number}
              </a>
            ))}
          </nav>
        )}
      </Section>

      {/* The horizon before the glossary. Above it the scanner has already
          named the companies; below it is the test that named them. The
          band carries the one caveat the whole page rests on, and no
          figure sits on the footage. */}
      <FilmBand
        src="/band/cloudfloor.mp4"
        poster="/band/cloudfloor.webp"
        eyebrow="MARKET / SCREEN"
        line="סורק מוצא מועמדים. הוא לא מוצא תשובות."
        height="48vh"
      />

      {/* ---- The glossary ----
           Every criterion, explained once. Taken from the first result
           rather than from a second table, because the explanations are a
           property of the test and not of the company — deriving them here
           means the wording on this page cannot drift from the wording the
           screener actually ran. */}
      <Section
        eyebrow="מה נבדק"
        title="עשרת הקריטריונים, ומה כל אחד שואל"
        description={'הרוב נמדדים מול חציון הסקטור ולא מול סף מוחלט, כי מכפיל של 15 אומר דבר אחד בבנק ודבר אחר בחברת שבבים. קריטריון שאי אפשר לחשב מסומן כ"אין נתון" ואינו נספר ככישלון.'}
      >
        <Band columns={2}>
          {results[0].criteria.map((criterion) => (
            <Field
              key={criterion.key}
              label={criterion.label}
              value={
                <span className="text-[13px] leading-snug text-ink-muted">
                  {criterion.explanation}
                </span>
              }
              context={`${results.filter((r) => r.criteria.find((c) => c.key === criterion.key)?.status === "pass").length} עוברות · ${results.filter((r) => r.criteria.find((c) => c.key === criterion.key)?.status === "insufficient-data").length} ללא נתון`}
            />
          ))}
        </Band>
      </Section>

      <Disclaimer />
    </Page>
  );
}