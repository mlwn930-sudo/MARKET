import { isPrivateBuild } from "@/lib/private-mode";
import { buildTradePlan } from "@/lib/analysis/trade-plan";
import { buildChartStance } from "@/lib/analysis/stance";
import type { Corroboration } from "@/lib/analysis/chart-corroborate";

/**
 * Where the idea is wrong, in price.
 *
 * The page refused this for a long time under one rule — "the site does
 * not measure entries or stops" — and the rule was covering three
 * different things, only one of which was actually uncomputable. The
 * reference price and the bands around it were already printed two
 * panels up. The stop is a distance, and the site measures both inputs
 * a stop needs: the bands price has turned at, and the average true
 * range. Only the position size needs a number the site does not have,
 * and that one is still named rather than guessed.
 *
 * The order is the discipline and it is not negotiable: where this is
 * wrong comes first, and the targets are multiples of that risk. A
 * target chosen first with the risk backed into it afterwards is how a
 * three percent stop becomes a fifteen percent loss.
 *
 * PRIVATE BUILD ONLY. Everything here is measured, but it is measured
 * *for a decision*, and a public reader arriving at a stop level has
 * been handed something that looks like advice no matter how it is
 * labelled. Same switch as `StancePanel`, same reason.
 */

const money = (value: number) => value.toFixed(2);
const pct = (value: number) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;

export function TradePlanPanel({ checked }: { checked: Corroboration }) {
  if (!isPrivateBuild()) return null;

  const stance = buildChartStance({
    setup: checked.setup,
    baseRates: checked.baseRates,
    lastClose: checked.lastClose,
  });

  /* The condition the direction rests on, so the survival check below
     compares the stop against the right excursion. Swing first, because
     that is the horizon a stop is actually exposed to. */
  const lead =
    stance?.swing.agreeing[0] ?? stance?.position.agreeing[0] ?? null;

  const plan = buildTradePlan({
    lastClose: checked.lastClose,
    asOf: checked.baseRates?.to ?? "",
    levels: checked.realLevels,
    atr: checked.atr,
    lead,
  });

  if (!plan) return null;

  return (
    <section className="read-block read-check trade-plan">
      <h3>
        איפה זה נשבר, ובאיזה מחיר
        <span className="read-check-sym num" dir="ltr">
          {checked.ticker}
        </span>
      </h3>
      <p className="read-check-note">
        הסדר כאן הוא המשמעת: קודם איפה הרעיון שגוי, ורק אחר כך כמה הוא
        שווה אם הוא נכון. היעדים למטה הם כפולות של הסיכון ולא מחירים
        שמישהו מדד — <strong>האתר לא מדד לאן המחיר הולך.</strong> הכל נגזר
        מהסגירה היומית של{" "}
        <span className="num" dir="ltr">
          {plan.asOf}
        </span>
        , לא ממחיר חי.
      </p>

      <div className="plan-rows">
        <div className="plan-row">
          <span className="plan-label">הפניה</span>
          <b className="num" dir="ltr">
            {money(plan.reference)}
          </b>
          <span className="plan-detail">הסגירה היומית האחרונה</span>
        </div>

        <div className="plan-row is-stop">
          <span className="plan-label">סטופ</span>
          <b className="num" dir="ltr">
            {money(plan.stop)}
          </b>
          <span className="plan-detail">
            <span className="num" dir="ltr">
              {pct(-plan.riskPercent)}
            </span>{" "}
            — {plan.stopReason}
          </span>
        </div>

        {plan.targets.map((t) => (
          <div key={t.multiple} className="plan-row">
            <span className="plan-label num" dir="ltr">
              {t.multiple}R
            </span>
            <b className="num" dir="ltr">
              {money(t.price)}
            </b>
            <span className="plan-detail">
              {t.multiple === 1
                ? "כפולה אחת של הסיכון. לא תחזית."
                : `${t.multiple} כפולות של הסיכון`}
            </span>
          </div>
        ))}

        {plan.measuredMove && (
          <div className="plan-row is-measured">
            <span className="plan-label">תנועה חציונית</span>
            <b className="num" dir="ltr">
              {money(plan.measuredMove.price)}
            </b>
            <span className="plan-detail">
              <span className="num" dir="ltr">
                {pct(plan.measuredMove.percent)}
              </span>{" "}
              — זה כן נמדד: החציון של מה שקרה אחרי התנאי הזה בעבר, בניגוד
              לכפולות שמעליו.
            </span>
          </div>
        )}
      </div>

      {/* The sentence no chart tool can produce. */}
      {plan.survival && (
        <div
          className="read-check-extra"
          data-ok={plan.survival.clearsMedian ? "true" : "false"}
        >
          <strong>האם הסטופ הזה היה שורד</strong>
          <p>{plan.survival.note}</p>
          <small>
            זה הדבר שאף כלי גרפים אחר לא יכול לומר לך: הוא דורש את הירידה
            שקרתה <em>בתוך</em> החלונות ההיסטוריים שמהם נספר השיעור, ולא רק
            את מה שקרה בסופם.
          </small>
        </div>
      )}

      <p className="read-check-note plan-sizing">{plan.sizing}</p>
    </section>
  );
}
