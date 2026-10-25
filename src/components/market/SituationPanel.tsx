import type { Situation } from "@/lib/analysis/situation";

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
  const { state, strength, weakness, balance, watch, asOf } = situation;

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

      <p className="situation-note">
        ארבע השורות האלה לא מודדות כלום — כל אחת נבחרה מתוך הפאנלים שלמטה,
        שם היא מופיעה עם המספרים המלאים שלה
        {asOf && (
          <>
            {" "}
            (נכון ל-
            <span className="num" dir="ltr">
              {asOf}
            </span>
            )
          </>
        )}
        .
      </p>
    </section>
  );
}
