import type { BaseRateRead, ConditionRead } from "@/lib/metrics/base-rates";
import { MIN_SAMPLE } from "@/lib/metrics/base-rates";
import { readOutcome } from "@/lib/metrics/base-rate-store";

/**
 * The two questions a reader brings to a chart, answered with counted
 * numbers instead of with a feeling.
 *
 *   WHAT IS TRUE NOW, and what did that turn into?
 *   WHAT AM I WAITING FOR, and what has it been worth when it happened?
 *
 * Both are scenarios and neither is a position. The difference is not
 * decoration: "if it closes back above the fifty-day, that has been
 * followed by a higher price 62% of the time against a baseline of 59%"
 * is a measurement with a sample. "Enter on a close above the fifty-day"
 * is a trade, and this project does not give those — rule 8, enforced in
 * the chart reader by deleting any sentence that slips one through.
 *
 * WHY THE WAITING LIST IS THE MORE USEFUL HALF. A chart a reader has
 * stopped to photograph is usually one they are already leaning toward,
 * and the thing they have not done is write down in advance what would
 * change their mind. Each row here is a sentence that can be checked
 * later: either the close happened or it did not. That is the only form
 * of chart reading nobody can argue with afterwards.
 *
 * AND THE NUMBER IS NEVER ALONE. Every rate is rendered against the
 * baseline of a random day in the same window, because on a stock that
 * tripled almost every bullish condition "works" and almost every bearish
 * one does too. The honest headline on most rows is that the difference is
 * small — and the component says that in words rather than letting a 62%
 * sit there looking like an edge.
 */

/** The horizon the scenario rows speak to. A month is long enough for a
 *  daily-chart structure to resolve and short enough that a reader can
 *  still remember what they were looking at. */
const HORIZON = 21;

function Rate({ condition }: { condition: ConditionRead }) {
  const outcome = condition.outcomes.find((o) => o.days === HORIZON);
  if (!outcome) return null;

  const enough = outcome.n >= MIN_SAMPLE;
  const reading = readOutcome(condition.label, outcome);
  const quiet = Math.abs(outcome.liftPp) < 10;

  return (
    <li className="border-t border-line py-3 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[14px] text-ink">{condition.label}</span>
        {enough ? (
          <span className="num shrink-0 text-[13px]">
            <span className="text-ink">{Math.round(outcome.up * 100)}%</span>
            <span className="text-ink-ghost"> · בסיס {Math.round(outcome.baselineUp * 100)}%</span>
            <span
              className={
                quiet
                  ? " text-ink-ghost"
                  : outcome.liftPp > 0
                    ? " text-up"
                    : " text-down"
              }
            >
              {" "}
              {outcome.liftPp >= 0 ? "+" : ""}
              {Math.round(outcome.liftPp)} נק׳
            </span>
          </span>
        ) : (
          <span className="num shrink-0 text-[12px] text-ink-ghost">
            {outcome.n} מופעים — מעט מדי
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-faint">
        {reading.sentence}
      </p>
    </li>
  );
}

export function ChartScenarios({
  read,
  ticker,
}: {
  read: BaseRateRead | null;
  ticker: string;
}) {
  if (!read) {
    return (
      <section className="read-block">
        <h3>תרחישים לפי ההיסטוריה</h3>
        <p className="read-check-note">
          אין מדידה עבור <span className="num" dir="ltr">{ticker}</span>. שיעורי
          הבסיס נמדדים מראש על יקום המחקר של האתר בלבד, ועל נייר שאינו בו לא
          מוצג מספר — עדיף בלי מדידה מאשר מדידה על מה שבמקרה היה זמין.
        </p>
      </section>
    );
  }

  const active = read.conditions.filter((c) => c.activeNow);
  /* Only the conditions with a sample worth reporting get to be something
     to wait for. A trigger measured on three occurrences is not a plan, it
     is a coincidence with a name. */
  const waiting = read.conditions.filter(
    (c) =>
      !c.activeNow &&
      (c.outcomes.find((o) => o.days === HORIZON)?.n ?? 0) >= MIN_SAMPLE,
  );

  return (
    <section className="read-block">
      <h3>
        תרחישים לפי ההיסטוריה
        <span className="read-check-sym num" dir="ltr">{ticker}</span>
      </h3>
      <p className="read-check-note">
        נספר מ-<span className="num">{read.sessions}</span> ימי מסחר של הנייר
        עצמו, {read.from} עד {read.to}. כל שיעור מוצג מול שיעור הבסיס — כמה
        פעמים יום אקראי באותו חלון הסתיים גבוה יותר אחרי חודש. ההפרש ביניהם
        הוא כל מה שהתנאי הוסיף, ולרוב הוא קטן.
      </p>

      <h4 className="mt-5 text-[13px] font-semibold text-ink">
        מה נכון בגרף הזה עכשיו
      </h4>
      {active.length === 0 ? (
        <p className="mt-1 text-[13px] text-ink-faint">
          אף אחד מהתנאים הנמדדים לא התרחש בנר האחרון. זו תשובה ולא חוסר: רוב
          הימים אינם אירוע.
        </p>
      ) : (
        <ul className="mt-2">
          {active.map((c) => (
            <Rate key={c.key} condition={c} />
          ))}
        </ul>
      )}

      <h4 className="mt-6 text-[13px] font-semibold text-ink">
        מה שאפשר להמתין לו, ומה הוא היה שווה
      </h4>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
        כל שורה היא אירוע נצפה שאפשר לבדוק בדיעבד — הסגירה קרתה או לא קרתה.
        זו אינה הוראה להיכנס או לצאת, וגם לא טענה שהאירוע יקרה.
      </p>
      {waiting.length === 0 ? (
        <p className="mt-2 text-[13px] text-ink-faint">
          לאף תנאי שעוד לא התרחש אין מדגם מספיק בנייר הזה.
        </p>
      ) : (
        <ul className="mt-2">
          {waiting.map((c) => (
            <Rate key={c.key} condition={c} />
          ))}
        </ul>
      )}

      <ul className="mt-5 space-y-1 text-[11px] leading-relaxed text-ink-ghost">
        {read.caveats.map((caveat) => (
          <li key={caveat}>· {caveat}</li>
        ))}
      </ul>
    </section>
  );
}
