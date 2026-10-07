import type { Observation, SetupRead } from "@/lib/analysis/setup";

/**
 * What is converging on this chart, and what argues against it.
 *
 * The chart reader was four panels each reporting one true thing: the
 * levels it could corroborate, the base rates for the conditions it
 * named, the volume read, the model's prose. Every one of them correct,
 * and none of them answering the question a person brings to a chart,
 * which is whether any of it adds up. Doing that arithmetic was left to
 * the reader — and it is the arithmetic the site exists to do.
 *
 * So this goes FIRST, above everything the reader already had. It is the
 * summary the other panels are the evidence for, and a summary printed
 * after its evidence is a footnote.
 *
 * IT COUNTS INDEPENDENT FAMILIES, NOT OBSERVATIONS. Price above the
 * fifty-day and price above the twenty-day are one thing said twice, and
 * a convergence number that counted them separately would inflate itself
 * toward a recommendation. The families are printed next to the count so
 * it can be checked rather than believed.
 *
 * AND THE DISAGREEMENT IS A SECTION, NOT A FOOTNOTE. A list of only the
 * supportive observations is an argument wearing a reading's clothes.
 * Rule 8 is explicit that this site says where the frameworks disagree,
 * and on a real chart they usually do — a stock can sit on a support that
 * has held eleven times while its rank is 11 of 99 and its trend is
 * stage 4, and a reader shown only the support has been misled by
 * omission.
 */

const SIDE_LABEL: Record<Observation["side"], string> = {
  constructive: "תומך",
  cautionary: "מושך לכיוון השני",
  neutral: "עובדה",
};

function Line({ observation }: { observation: Observation }) {
  const { record } = observation;
  const quiet = record ? Math.abs(record.liftPp) < 10 : false;

  return (
    <li className="setup-line">
      <div className="setup-line-head">
        <span className="setup-label">{observation.label}</span>
        <span className={`setup-side setup-side--${observation.side}`}>
          {SIDE_LABEL[observation.side]}
        </span>
      </div>
      <p className="setup-detail">{observation.detail}</p>
      {record ? (
        <p className="setup-record">
          <span className="num">{record.occurrences}</span> מופעים בעשר שנים ·
          חודש אחרי, המחיר היה גבוה יותר ב-
          <span className="num">{Math.round(record.upRate * 100)}%</span> מהם מול
          בסיס של{" "}
          <span className="num">{Math.round(record.baselineRate * 100)}%</span>
          {quiet ? (
            <span className="setup-verdict"> — התנאי לא הוסיף מידע.</span>
          ) : (
            <span
              className={
                record.liftPp > 0
                  ? "setup-verdict tape-up"
                  : "setup-verdict tape-down"
              }
            >
              {" "}
              — הפרש של {record.liftPp > 0 ? "+" : ""}
              {Math.round(record.liftPp)} נקודות.
            </span>
          )}
        </p>
      ) : (
        <p className="setup-record setup-record--thin">
          אין שיעור בסיס מדוד לתצפית הזו — היא ספירה של מה שקרה, לא שיעור.
        </p>
      )}
    </li>
  );
}

export function SetupPanel({ setup }: { setup: SetupRead | null }) {
  if (!setup) return null;

  const nothing = setup.observations.length === 0 && setup.tension.length === 0;

  return (
    <section className="read-block">
      <h3>
        מה מתכנס כאן
        <span className="read-check-sym num" dir="ltr">
          {setup.symbol}
        </span>
      </h3>

      {nothing ? (
        <p className="read-check-note">
          אף תנאי נמדד אינו נכון על הנייר הזה כרגע. זו תשובה ולא חוסר — רוב
          הימים אינם אירוע, ולוח שמראה משהו בכל יום מראה רעש.
        </p>
      ) : (
        <>
          <p className="read-check-note">
            <span className="num">{setup.convergence}</span> משפחות נמדדות
            נכונות בו-זמנית — {setup.families.join(" · ")}. הספירה היא של
            משפחות ולא של תצפיות, כי ״מעל ממוצע 50״ ו״מעל ממוצע 20״ הם דבר אחד
            שנאמר פעמיים. נכון ל-
            <span className="num" dir="ltr">
              {setup.asOf}
            </span>
            . זו ספירה של מה שנכון עכשיו, לא ציון ולא המלצה.
          </p>

          {setup.observations.length > 0 && (
            <>
              <h4 className="tape-heading">מה נכון עכשיו</h4>
              <ul className="setup-list">
                {setup.observations.map((o) => (
                  <Line key={o.key} observation={o} />
                ))}
              </ul>
            </>
          )}

          {setup.tension.length > 0 && (
            <>
              <h4 className="tape-heading">מה שמושך לכיוון השני</h4>
              <p className="setup-tension-note">
                זה החלק שרשימה של ראיות תומכות בלבד הייתה משמיטה. כשהמסגרות לא
                מסכימות, ההבדל ביניהן הוא הדבר שכדאי לקרוא.
              </p>
              <ul className="setup-list">
                {setup.tension.map((o) => (
                  <Line key={o.key} observation={o} />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {setup.caveats.length > 0 && (
        <ul className="tape-caveats">
          {setup.caveats.map((c) => (
            <li key={c}>· {c}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
