import type { CompanyContext } from "@/lib/analysis/chart-corroborate";

/**
 * What is happening at the company, which a picture cannot show.
 *
 * The chart reader knew the candles and nothing else. It could count what
 * this instrument did after fifty-three trend-template completions and it
 * could not know that the company ships a game in February, so it read
 * every chart as if the next quarter were a blank page. A reader looking
 * at Take-Two is asking both questions at once, and only one of them was
 * on the page.
 *
 * THE TWO SIDES ARE NOT EQUALLY CERTAIN AND THE PANEL SAYS SO. Everything
 * in the measured panels was counted over ten years of this instrument's
 * own closes against the baseline of a random day. Everything here is
 * dated: the site knows when the report lands and it has not measured
 * what this company's stock did after its own launches, because there is
 * no sample — a company ships a flagship title once a decade. Printing a
 * catalyst beside a base rate without that distinction would dress a
 * calendar entry as a measurement, which is the one thing rule 9 exists
 * to prevent.
 *
 * It also does not discount anything. A report inside a 21-day window
 * does not make the 21-day rate wrong: the ten years that were counted
 * contained every report those instruments ever published, so the event
 * is already inside the number. What changes is what the reader is
 * agreeing to — a scheduled binary event, known in advance, inside a
 * window a technical condition is speaking for. Saying "the stance is
 * less reliable" would invent a correction nobody measured. See
 * `EarningsNote`, which makes the same argument on the watchlist.
 *
 * ONE HONEST LIMIT, PRINTED. The readings are written per article, and an
 * article can cover two companies: a piece on GameStop's warrant deadline
 * that also mentions Take-Two's launch arrives as one paragraph holding
 * both catalysts. The data cannot split it, so the headline is shown
 * above every reading and the reader can see whose story it was.
 */

const SIGNIFICANCE: Record<CompanyContext["stories"][number]["significance"], string> = {
  high: "השפעה גבוהה",
  medium: "השפעה בינונית",
  low: "השפעה נמוכה",
};

/** The horizons the measured panels quote, in calendar days.
 *
 *  Calendar and not the trading days the horizons are counted in,
 *  deliberately: a report lands on a date. 21 trading days is about 30
 *  calendar days, and using the trading count would place a report
 *  outside a window it is actually inside — the error that matters, in
 *  the direction that matters. */
const SWING_CALENDAR = 30;
const POSITION_CALENDAR = 91;

function ReportDate({
  report,
}: {
  report: NonNullable<CompanyContext["nextEarnings"]>;
}) {
  const { date, daysAway } = report;

  const when =
    daysAway < 0
      ? "דווח כבר"
      : daysAway === 0
        ? "מדווחת היום"
        : daysAway === 1
          ? "מדווחת מחר"
          : `בעוד ${daysAway} ימים`;

  const inside =
    daysAway < 0
      ? null
      : daysAway <= SWING_CALENDAR
        ? "נופל בתוך אופק הסווינג וגם בתוך אופק הרבעון"
        : daysAway <= POSITION_CALENDAR
          ? "נופל בתוך אופק הרבעון, מחוץ לאופק הסווינג"
          : "נופל מחוץ לשני האופקים שהאתר מודד";

  return (
    <div className="ctx-report">
      <div className="ctx-report-head">
        <span>הדוח הרבעוני הבא</span>
        <b className="num" dir="ltr">
          {date}
        </b>
        <span className="ctx-report-when">{when}</span>
      </div>
      {inside && (
        <p>
          הדוח {inside}. זה לא מוריד משיעורי הבסיס — עשר השנים שנספרו כוללות
          כל דוח שהנייר הזה פרסם, והאירוע כבר בתוך המספר. מה שזה כן אומר:
          בתוך החלון שהתנאי הטכני מדבר עליו יש אירוע מתוזמן שידוע מראש.
        </p>
      )}
    </div>
  );
}

export function CompanyContextPanel({
  context,
  ticker,
}: {
  context: CompanyContext | null | undefined;
  ticker: string;
}) {
  if (!context) return null;
  const { nextEarnings, stories } = context;
  if (!nextEarnings && stories.length === 0) {
    return (
      <section className="read-block read-check">
        <h3>
          מה שקורה בחברה
          <span className="read-check-sym num" dir="ltr">
            {ticker}
          </span>
        </h3>
        <p className="read-check-note">
          לאתר אין כרגע אירוע מתוזמן או כתבה מנותחת על הנייר הזה. זו תשובה
          ולא כשל: אין סיבה עסקית מתוארכת להוסיף למה שהגרף מראה, והמסקנה
          נשארת על המדידות בלבד.
        </p>
      </section>
    );
  }

  return (
    <section className="read-block read-check company-context">
      <h3>
        מה שקורה בחברה
        <span className="read-check-sym num" dir="ltr">
          {ticker}
        </span>
      </h3>
      <p className="read-check-note">
        הצד הזה מתוארך ולא ספור, וזה ההבדל שחשוב לשמור עליו. הפאנלים
        שמעליו נמדדו על עשר שנים של הנייר הזה מול יום אקראי; כאן האתר יודע{" "}
        <em>מתי</em> האירוע, ולא מה קרה למניה אחרי אירועים דומים — כי לאירוע
        כזה אין מדגם. אל תיתן לשורות למטה את הביטחון של שיעור בסיס.
      </p>

      {nextEarnings && <ReportDate report={nextEarnings} />}

      {stories.length > 0 && (
        <div className="ctx-stories">
          {stories.map((story) => (
            <article key={`${story.at}-${story.title}`} className="ctx-story">
              <div className="ctx-story-head">
                <span className="ctx-story-sig">
                  {SIGNIFICANCE[story.significance]}
                </span>
                {story.catalystKind === "catalyst" && (
                  <span className="ctx-story-kind">זרז</span>
                )}
                <time className="num" dir="ltr">
                  {story.at.slice(0, 10)}
                </time>
                {story.otherTickers.length > 0 && (
                  /* Whose story it also is. A catalyst paragraph is
                     written for the article, so a story naming three
                     companies may be carrying somebody else's reason to
                     move — and the only way to tell is to see the other
                     names next to it. */
                  <span className="ctx-story-also num" dir="ltr">
                    {story.otherTickers.slice(0, 4).join(" · ")}
                  </span>
                )}
              </div>
              <h4>{story.title}</h4>
              {story.catalyst && (
                <p className="ctx-story-catalyst">{story.catalyst}</p>
              )}
              <p className="ctx-story-impact">{story.impact}</p>
            </article>
          ))}
          <small className="ctx-note">
            הקריאות נכתבו לכתבה, לא לחברה. כתבה שמכסה שתי חברות נושאת את
            שני הזרזים באותה פסקה — הכותרת מופיעה מעל כל קריאה כדי שיהיה
            אפשר לראות של מי הסיפור.
          </small>
        </div>
      )}
    </section>
  );
}
