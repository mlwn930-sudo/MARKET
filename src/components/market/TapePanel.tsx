import { Fragment } from "react";
import type { BaseRateRead } from "@/lib/metrics/base-rates";
import { MIN_SAMPLE } from "@/lib/metrics/base-rates";
import { CHARACTER_LABELS, type BarRead, type TapeRead } from "@/lib/metrics/tape";

/**
 * The volume, read.
 *
 * The part of a chart that gets looked at least and argued about most. A
 * reader can see that one bar in the strip is taller than its neighbours;
 * what they cannot see is whether that is the ninety-eighth percentile of
 * the year or an ordinary Tuesday on a quiet name, and the answer changes
 * the meaning completely. This panel supplies the rank.
 *
 * THREE RULES IT IS BUILT ON, AND THEY ARE THE SAME THREE AS EVERYWHERE.
 *
 * No number appears without its context. A bar's volume is shown as a
 * multiple AND as a percentile of the instrument's own trailing year,
 * because 2.1x means one thing on a stock that trades in a narrow band and
 * another on one that routinely triples its volume into earnings.
 *
 * No reading appears without what it has been worth. Every character the
 * tape can assign is also a condition `base-rates.ts` measures, from one
 * shared definition, so the line that says "today is a climax bar" is
 * followed by the line that says how the last twelve climax bars on this
 * name resolved — against the baseline of a random day. On most names,
 * most of the time, that difference is small, and the panel prints the
 * small number rather than hiding it.
 *
 * And nothing here names a participant or suggests an action. "Extreme
 * volume in a narrow range" is what the bar did. Who was absorbing whom,
 * and whether any of it is worth acting on, stays with the reader.
 */

/** The horizon the rates are quoted at, matching `ChartScenarios` so a
 *  reader comparing the two panels is comparing the same thing. */
const HORIZON = 21;

const PERCENT = (value: number) => `${Math.round(value * 100)}%`;

const ordinal = (p: number | null) =>
  p === null ? "—" : `אחוזון ${Math.round(p * 100)}`;

/* Which base-rate condition reports on which bar character. The pairing is
   the whole point of the panel, so it lives in one place rather than being
   spelled out at each call site. */
const CHARACTER_CONDITION: Record<string, string> = {
  climax: "climax-bar",
  absorption: "absorption-bar",
  thrust: "thrust-bar",
  "no-demand": "no-demand-bar",
};

function TrackRecord({
  character,
  rates,
}: {
  character: string;
  rates: BaseRateRead | null;
}) {
  const key = CHARACTER_CONDITION[character];
  if (!key || !rates) return null;
  const condition = rates.conditions.find((c) => c.key === key);
  const outcome = condition?.outcomes.find((o) => o.days === HORIZON);
  if (!condition || !outcome) return null;

  if (outcome.n < MIN_SAMPLE) {
    return (
      <p className="tape-record tape-record--thin">
        הנר הזה הופיע {condition.occurrences} פעמים בעשר השנים האחרונות —
        מעט מדי לשיעור. הצורה מדווחת, המשמעות לא נמדדה.
      </p>
    );
  }

  const quiet = Math.abs(outcome.liftPp) < 10;
  return (
    <p className="tape-record">
      <span className="num">{outcome.n}</span> מופעים בעשר שנים · חודש אחרי,
      המחיר היה גבוה יותר ב-<span className="num">{PERCENT(outcome.up)}</span>{" "}
      מהם מול בסיס של <span className="num">{PERCENT(outcome.baselineUp)}</span>
      {quiet ? (
        <span className="tape-record-verdict"> — התנאי לא הוסיף מידע.</span>
      ) : (
        <span
          className={
            outcome.liftPp > 0
              ? "tape-record-verdict tape-up"
              : "tape-record-verdict tape-down"
          }
        >
          {" "}
          — הפרש של {outcome.liftPp > 0 ? "+" : ""}
          {Math.round(outcome.liftPp)} נקודות.
        </span>
      )}
    </p>
  );
}

function Bar({
  bar,
  rates,
  headline = false,
}: {
  bar: BarRead;
  rates: BaseRateRead | null;
  headline?: boolean;
}) {
  return (
    <li className={headline ? "tape-bar tape-bar--lead" : "tape-bar"}>
      <div className="tape-bar-head">
        <span className="tape-char">{bar.character === "quiet" ? "יום רגיל" : CHARACTER_LABELS[bar.character]}</span>
        <span className="num tape-date" dir="ltr">
          {bar.date}
        </span>
      </div>
      <dl className="tape-figures">
        <div>
          <dt>מחזור</dt>
          <dd className="num">
            ×{bar.volumeRatio.toFixed(1)}
            <span className="tape-rank"> {ordinal(bar.volumePercentile)}</span>
          </dd>
        </div>
        <div>
          <dt>טווח הנר</dt>
          <dd className="num">
            {bar.rangePercent.toFixed(1)}%
            <span className="tape-rank"> {ordinal(bar.rangePercentile)}</span>
          </dd>
        </div>
        <div>
          <dt>סגירה בתוך הטווח</dt>
          <dd className="num">{PERCENT(bar.closePosition)}</dd>
        </div>
        <div>
          <dt>מאמץ מול תוצאה</dt>
          <dd className="num">
            {bar.effortZ >= 0 ? "+" : ""}
            {bar.effortZ.toFixed(1)} / {bar.resultZ >= 0 ? "+" : ""}
            {bar.resultZ.toFixed(1)}
          </dd>
        </div>
      </dl>
      {headline && <TrackRecord character={bar.character} rates={rates} />}
    </li>
  );
}

/**
 * Where the year's volume actually traded.
 *
 * Drawn rather than described, because the shape is the finding: a year
 * that piled into one band and a year that spread evenly are different
 * markets, and no list of four numbers conveys which one a reader is
 * looking at. The bars run from the lowest price the window covered to the
 * highest, the value area is marked, and the close sits on the same axis.
 */
function Profile({ profile, lastClose }: { profile: NonNullable<TapeRead["profile"]>; lastClose: number }) {
  const peak = Math.max(...profile.histogram);
  const span = profile.high - profile.low;
  const at = (price: number) => ((price - profile.low) / span) * 100;

  return (
    <div className="tape-profile">
      <div className="tape-profile-frame">
        <div className="tape-profile-chart">
          <div
            className="tape-value-area"
            style={{
              insetBlockEnd: `${at(profile.valueAreaLow)}%`,
              blockSize: `${at(profile.valueAreaHigh) - at(profile.valueAreaLow)}%`,
            }}
          />
          {profile.histogram.map((share, i) => (
            <div
              key={i}
              className="tape-profile-row"
              style={{
                insetBlockEnd: `${(i / profile.bins) * 100}%`,
                blockSize: `${100 / profile.bins}%`,
                inlineSize: `${peak > 0 ? (share / peak) * 100 : 0}%`,
              }}
            />
          ))}
          <div className="tape-poc" style={{ insetBlockEnd: `${at(profile.poc)}%` }} />
          <div className="tape-close" style={{ insetBlockEnd: `${at(lastClose)}%` }} />
        </div>
        {/* The axis. A profile without prices on it is a decorative shape:
            the whole claim is that a particular price traded more than its
            neighbours, and a reader cannot check that against their own
            chart without the number. Four marks rather than a full scale,
            because the two that matter are the heaviest price and the
            current one. */}
        <div className="tape-axis" aria-hidden>
          <span className="num tape-axis-mark" style={{ insetBlockEnd: "100%" }} dir="ltr">
            {profile.high.toFixed(0)}
          </span>
          <span
            className="num tape-axis-mark tape-axis-poc"
            style={{ insetBlockEnd: `${at(profile.poc)}%` }}
            dir="ltr"
          >
            {profile.poc.toFixed(0)} ◀ POC
          </span>
          <span
            className="num tape-axis-mark tape-axis-close"
            style={{ insetBlockEnd: `${at(lastClose)}%` }}
            dir="ltr"
          >
            {lastClose.toFixed(0)} ◀ עכשיו
          </span>
          <span className="num tape-axis-mark" style={{ insetBlockEnd: "0%" }} dir="ltr">
            {profile.low.toFixed(0)}
          </span>
        </div>
      </div>
      <dl className="tape-profile-legend">
        <div>
          <dt>מחיר עם הכי הרבה מחזור</dt>
          <dd className="num" dir="ltr">
            {profile.poc.toFixed(2)}
          </dd>
        </div>
        <div>
          <dt>אזור הערך ({PERCENT(profile.valueAreaShare)} מהמחזור)</dt>
          <dd className="num" dir="ltr">
            {profile.valueAreaLow.toFixed(2)} – {profile.valueAreaHigh.toFixed(2)}
          </dd>
        </div>
        <div>
          <dt>המחיר כעת</dt>
          <dd>
            {profile.position === "above-value"
              ? "מעל אזור הערך"
              : profile.position === "below-value"
                ? "מתחת לאזור הערך"
                : "בתוך אזור הערך"}
          </dd>
        </div>
      </dl>
      {profile.thin.length > 0 && (
        <p className="tape-thin">
          מתחי מחיר שכמעט לא נסחרו בחלון:{" "}
          {profile.thin.map((gap, i) => (
            <Fragment key={gap.from}>
              {/* The separator stays OUTSIDE the ltr run. Inside it, bidi
                  reorders the dot to the far end of the number and two
                  ranges render as one eleven-digit figure — which is what
                  this line did before. */}
              {i > 0 ? " · " : ""}
              <span className="num" dir="ltr">
                {gap.from.toFixed(2)}–{gap.to.toFixed(2)}
              </span>
            </Fragment>
          ))}
          . זה תיאור של איפה החלון לא עשה עסקים, לא תחזית שהמחיר יחצה אותם מהר.
        </p>
      )}
      <p className="tape-caveat">{profile.caveat}</p>
    </div>
  );
}

/**
 * The report date, and the far more important sentence about what cannot
 * be said about it.
 *
 * A volume climax the day before a quarterly report and one in a quiet
 * week are not the same event, and every reading in this panel is blind to
 * the difference. The honest fix would be to classify each historical bar
 * by its distance from that quarter's report — which needs a history of
 * report dates, and Finnhub's free calendar does not have one. Measured
 * directly rather than assumed: a request for the coming quarter returns
 * 1,500 rows, and the identical request for any window in the past returns
 * zero.
 *
 * So the base rates above are NOT conditioned on earnings and this says
 * so, rather than letting a reader assume a measurement that was never
 * made. What the calendar does carry is the NEXT date, which is the piece
 * a reader looking at today's tape actually needs: a quiet bar eight
 * sessions before a report is a different quiet bar.
 *
 * Rule 9, in both directions at once — print what the data supports, and
 * name what it does not.
 */
function Earnings({ date, sessionsAway }: { date: string; sessionsAway: number | null }) {
  return (
    <div className="tape-earnings">
      <div className="tape-earnings-head">
        <span>הדוח הבא</span>
        <span className="num" dir="ltr">
          {date}
        </span>
        {sessionsAway !== null && (
          <span className="tape-rank">
            {sessionsAway <= 0
              ? "היום או חלף"
              : `בעוד ${sessionsAway} ימי מסחר`}
          </span>
        )}
      </div>
      <p className="tape-earnings-note">
        {sessionsAway !== null && sessionsAway > 0 && sessionsAway <= 10
          ? "הדוח קרוב. מחזור חריג בימים שלפני דוח נפוץ, ולא בהכרח אומר את מה שאותה צורה אומרת בשבוע רגיל."
          : "שיעורי הבסיס שלמעלה אינם מותנים בקרבה לדוח."}{" "}
        לוח הדוחות החינמי מוסר תאריכים עתידיים בלבד ולא היסטוריה, ולכן אי
        אפשר לסווג נרות מהעבר לפי המרחק שלהם מדוח — וזה לא נמדד כאן.
      </p>
    </div>
  );
}

export function TapePanel({
  tape,
  rates,
  ticker,
  lastClose,
  earnings,
}: {
  tape: TapeRead | null;
  rates: BaseRateRead | null;
  ticker: string;
  lastClose: number;
  /** The next scheduled report, when the calendar carries one. */
  earnings?: { date: string; sessionsAway: number | null } | null;
}) {
  if (!tape || !tape.latest) {
    return (
      <section className="read-block">
        <h3>קריאת מחזור</h3>
        <p className="read-check-note">
          אין די היסטוריה כדי לדרג מחזור מול ההתפלגות של{" "}
          <span className="num" dir="ltr">
            {ticker}
          </span>
          . כל סף כאן הוא אחוזון מתוך שנה של אותו נייר, ובלי שנה אין מול מה
          לדרג.
        </p>
      </section>
    );
  }

  const { latest, notable, profile, obv, trend } = tape;
  /* The lead bar is already first in `notable` when it was abnormal; this
     keeps it from being printed twice. */
  const rest = notable.filter((b) => b.date !== latest.date);

  return (
    <section className="read-block">
      <h3>
        קריאת מחזור
        <span className="read-check-sym num" dir="ltr">
          {ticker}
        </span>
      </h3>
      <p className="read-check-note">
        כל סף כאן הוא דירוג בתוך השנה האחרונה של הנייר עצמו ולא מספר קבוע —
        ״כבד״ על מגה-קאפ ו״כבד״ על מניה דלילה הם אותו אחוזון ולא אותו מספר
        מניות. הקריאה מתארת צורה של נר; היא לא מזהה מי עמד בצד השני, כי
        הטייפ לא מוסר את זה.
      </p>

      <h4 className="tape-heading">
        {tape.droppedPartial ? "הנר האחרון שנסגר" : "הנר האחרון"}
      </h4>
      {tape.droppedPartial && (
        <p className="tape-partial">
          המסחר היום עדיין פתוח, ולכן הנר של היום לא נקרא. מחזור של יום חלקי
          תמיד ייפול לתחתית ההתפלגות — זה היה אומר ״אין עניין״ על כל נייר, כל
          היום, בלי קשר למה שקורה בו.
        </p>
      )}
      <ul className="tape-list">
        <Bar bar={latest} rates={rates} headline />
      </ul>

      <h4 className="tape-heading">
        ימים חריגים ב-<span className="num">{tape.notableWindow}</span> ימי
        המסחר האחרונים
      </h4>
      {rest.length === 0 ? (
        <p className="tape-empty">
          אף נר בחלון לא היה חריג במחזור או בטווח. זו תשובה ולא חוסר — רוב
          הימים אינם אירוע.
        </p>
      ) : (
        <ul className="tape-list">
          {rest.map((bar) => (
            <Bar key={bar.date} bar={bar} rates={rates} />
          ))}
        </ul>
      )}

      {earnings && (
        <Earnings date={earnings.date} sessionsAway={earnings.sessionsAway} />
      )}

      <h4 className="tape-heading">כיוון ההשתתפות</h4>
      <dl className="tape-figures tape-figures--wide">
        {trend !== null && (
          <div>
            <dt>מחזור 10 ימים מול 50 שלפניהם</dt>
            <dd className="num">
              ×{trend.toFixed(2)}
              <span className="tape-rank">
                {" "}
                {trend < 0.85 ? "התכווצות" : trend > 1.15 ? "התרחבות" : "ללא שינוי"}
              </span>
            </dd>
          </div>
        )}
        {obv && (
          <div>
            <dt>מחיר מול מחזור מצטבר ({obv.window} ימים)</dt>
            <dd>
              {obv.divergence === "bearish"
                ? "המחיר עשה שיא גבוה יותר, המחזור המצטבר לא"
                : obv.divergence === "bullish"
                  ? "המחיר עשה שפל נמוך יותר, המחזור המצטבר לא"
                  : "השניים נעים באותו כיוון"}
            </dd>
          </div>
        )}
      </dl>

      {profile && (
        <>
          <h4 className="tape-heading">
            איפה המחזור נסחר בפועל ({profile.window} ימים)
          </h4>
          <Profile profile={profile} lastClose={lastClose} />
        </>
      )}

      <ul className="tape-caveats">
        {tape.caveats.map((caveat) => (
          <li key={caveat}>· {caveat}</li>
        ))}
      </ul>
    </section>
  );
}
