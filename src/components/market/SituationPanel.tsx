import type { Situation } from "@/lib/analysis/situation";

/** Hebrew weekday names, indexed the way `getUTCDay` returns them. The
 *  date is parsed at midday UTC so a timezone cannot roll it a day. */
const DAY_NAME = [
  "ראשון",
  "שני",
  "שלישי",
  "רביעי",
  "חמישי",
  "שישי",
  "שבת",
];

/**
 * The picture, before the evidence for it.
 *
 * A company page opened with eleven correct sections and no sentence.
 * Each panel refused to conclude — correctly, on its own terms — and
 * nothing was left to do the concluding, so the reader assembled it
 * themselves or gave up. This is the sentence, and it is allowed to be
 * one because it adds no measurement: every line is a selection out of
 * readings the panels below compute and show in full.
 *
 * Which is also why it links down rather than explaining. Four lines
 * that each try to justify themselves are the wall again.
 */
export function SituationPanel({
  situation,
  ticker,
}: {
  situation: Situation | null;
  ticker: string;
}) {
  if (!situation) return null;
  const { state, strength, weakness, balance, watch, outlook, asOf } = situation;

  return (
    <section className="read-block situation">
      <h3>
        תמונת מצב
        <span className="read-check-sym num" dir="ltr">
          {ticker}
        </span>
      </h3>

      <p className="situation-state">{state}</p>

      <dl className="situation-rows">
        {strength && (
          <div>
            <dt>הכי חזק בעד</dt>
            <dd>{strength}</dd>
          </div>
        )}
        {weakness && (
          <div>
            <dt>הכי חזק נגד</dt>
            <dd>{weakness}</dd>
          </div>
        )}
        {balance && (
          <div>
            <dt>בעד מול נגד</dt>
            <dd>{balance.verdict}</dd>
          </div>
        )}
        {watch && (
          <div>
            <dt>מה שעוד לא קרה</dt>
            <dd>{watch}</dd>
          </div>
        )}
      </dl>

      {/* WHAT FOLLOWED THIS, OUT TO HALF A YEAR.
          Asked for as "forecasts six months ahead". It is not a
          forecast and the copy says so twice — once here and once in
          the row that runs out of sample — because a table of
          percentages beside a date is read as a prediction unless it is
          stopped from being. Each rate sits against the baseline for
          the same window on the same instrument, which is the only
          thing that makes it mean anything. */}
      {outlook && (() => {
        /* When nothing fired, the rate IS the baseline and the two
           columns print the same number twice, which reads as a bug
           rather than as the point. */
        const isBaseline = outlook.condition === "יום אקראי על הנייר הזה";
        return (
        <div className="situation-outlook">
          <h4>
            {outlook.condition === "יום אקראי על הנייר הזה"
              ? "מה קרה בעבר מיום אקראי על הנייר הזה"
              : `מה קרה בעבר אחרי ${outlook.condition}`}
          </h4>
          <table>
            <thead>
              <tr>
                <th>אופק</th>
                <th>סגרו גבוה</th>
                {!isBaseline && <th>בסיס</th>}
                <th>תנועה חציונית</th>
                <th>מדגם</th>
              </tr>
            </thead>
            <tbody>
              {outlook.rows.map((row) => (
                <tr key={row.days} data-thin={row.thin ? "true" : undefined}>
                  <td>{row.label}</td>
                  <td className="num" dir="ltr">
                    {row.upPercent}%
                  </td>
                  {!isBaseline && (
                    <td className="num" dir="ltr">
                      {row.baselinePercent}%
                    </td>
                  )}
                  <td className="num" dir="ltr">
                    {row.medianPct >= 0 ? "+" : "−"}
                    {Math.abs(row.medianPct).toFixed(1)}%
                  </td>
                  <td className="num" dir="ltr">
                    n={row.n}
                    {row.thin && " ⚠"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <small>
            זו לא תחזית. זו ספירה של מה שכבר קרה על הנייר הזה עצמו, כל
            שיעור מול הבסיס של אותו חלון. כשאין תנאי נמדד שפעל, השורות
            האלה הן הבסיס עצמו — מה שקרה מיום אקראי — וזו תשובה, לא
            היעדר נתונים. ככל שהאופק ארוך יותר
            המדגם קטן — לאירוע צריך להיות חצי שנה של היסטוריה אחריו כדי
            להימדד בכלל — ולכן שורה עם{" "}
            <span dir="ltr">⚠</span> היא שורה שהמדגם שלה קטן מכדי להישען
            עליה, ומודפסת כדי שתדע שהספירה נגמרה ולא שהיא אומרת אפס.
          </small>
        </div>
        );
      })()}

      <p className="situation-note">
        ארבע השורות האלה לא מודדות כלום — כל אחת נבחרה מתוך הפאנלים שלמטה,
        שם היא מופיעה עם המספרים המלאים שלה
        {asOf && (
          /* NAMED AS THE LAST SESSION, NOT AS A DATE.
             It read "as of 2026-10-23" on a Sunday and the owner took
             it for stale data. It was not — the 23rd was Friday, and
             Friday is the last close there is until Monday opens. A
             bare date cannot say that, so the label does: the figure is
             anchored to a trading session, and a weekend is not one. */
          <>
            {" "}
            (נמדד על יום המסחר האחרון שנסגר,{" "}
            <span className="num" dir="ltr">
              {asOf}
            </span>
            {DAY_NAME[new Date(`${asOf}T12:00:00Z`).getUTCDay()]
              ? ` — יום ${DAY_NAME[new Date(`${asOf}T12:00:00Z`).getUTCDay()]}`
              : ""}
            )
          </>
        )}
        .
      </p>
    </section>
  );
}
