import type { BaseRateRead, ConditionRead } from "@/lib/metrics/base-rates";
import { HORIZONS, MIN_SAMPLE } from "@/lib/metrics/base-rates";
import { readOutcome } from "@/lib/metrics/base-rate-store";
import { Empty, Section } from "@/components/ui";

/**
 * What this chart's own history did after the signal it is showing today.
 *
 * The site already names the state — the stage, the trend template, the
 * distance to the fifty-day. This is the sentence that was always missing
 * after it: and then what happened.
 *
 * EVERY RATE IS SHOWN AGAINST ITS OWN BASELINE, always, in the same row.
 * That is not a disclaimer bolted on, it is the measurement. Counted over
 * ten years, "NVDA closed back above its fifty-day" was followed by a
 * higher price 67% of the time — and a RANDOM day in the same window was
 * higher 66% of the time. The signal was worth two points. Shown alone
 * the 67% is a number about a chart pattern; shown beside the 66% it is
 * a number about a stock that went up, which is what it always was.
 *
 * The strongest thing this panel does is print "no signal" in full. A
 * reader who learns that the setup they were about to act on has
 * historically been worth nothing on this name has got the most valuable
 * thing the page can give them, and it is exactly what no site that sells
 * signals will ever show.
 */

const HEAD = ["+שבוע", "+שבועיים", "+חודש", "+רבעון"] as const;

function Row({ condition }: { condition: ConditionRead }) {
  const month = condition.outcomes.find((o) => o.days === 21);
  const reading = month ? readOutcome(condition.label, month) : null;

  return (
    <div className="border-t border-line py-4 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4 className="text-[15px] font-semibold text-ink">
          {condition.label}
          {condition.activeNow && (
            <span className="ms-2 align-middle text-[11px] font-normal text-accent">
              · קרה היום
            </span>
          )}
        </h4>
        <span className="num text-[12px] text-ink-faint">
          {condition.occurrences} מופעים
          {condition.lastAt && ` · אחרון ${condition.lastAt}`}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-px overflow-hidden rounded border border-line bg-line">
        {HORIZONS.map((days, i) => {
          const outcome = condition.outcomes.find((o) => o.days === days)!;
          const enough = outcome.n >= MIN_SAMPLE;
          return (
            <div key={days} className="bg-surface px-3 py-2">
              <span className="block text-[10px] text-ink-ghost">{HEAD[i]}</span>
              {enough ? (
                <>
                  <span className="num block text-[17px] text-ink">
                    {Math.round(outcome.up * 100)}%
                  </span>
                  {/* The baseline is never in a tooltip and never a
                      footnote. It sits under the figure it qualifies,
                      because a reader who sees only the top line has been
                      told the wrong thing. */}
                  <span className="num block text-[11px] text-ink-faint">
                    בסיס {Math.round(outcome.baselineUp * 100)}%
                  </span>
                  <span
                    className={`num block text-[11px] ${
                      Math.abs(outcome.liftPp) < 10
                        ? "text-ink-ghost"
                        : outcome.liftPp > 0
                          ? "text-up"
                          : "text-down"
                    }`}
                  >
                    {outcome.liftPp >= 0 ? "+" : ""}
                    {Math.round(outcome.liftPp)} נק׳
                  </span>
                </>
              ) : (
                <span className="block pt-1 text-[11px] text-ink-ghost">
                  {outcome.n} מופעים — מעט מדי
                </span>
              )}
            </div>
          );
        })}
      </div>

      {reading && (
        <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
          {reading.sentence}
        </p>
      )}
    </div>
  );
}

export function BaseRatePanel({ read }: { read: BaseRateRead | null }) {
  if (!read) {
    return (
      <Section
        eyebrow="שיעורי בסיס"
        title="מה קרה בעבר אחרי מצב כזה"
        description="נמדד מההיסטוריה של המניה עצמה."
      >
        <Empty
          title="אין מספיק היסטוריה למדידה"
          reason="חישוב שיעור בסיס דורש עשר שנות נרות יומיים, ממוצע 200 שעומד על רגליו, ועוד רבעון אחרי כל מופע כדי שיהיה מה למדוד. חברה צעירה מכך לא מקבלת מספר במקום מדידה."
        />
      </Section>
    );
  }

  /* What fired today first — it is the only part of the panel that is
     about now. Everything after it is a reference table. */
  const active = read.conditions.filter((c) => c.activeNow);
  const rest = read.conditions.filter((c) => !c.activeNow);

  return (
    <Section
      eyebrow="שיעורי בסיס"
      title="מה קרה בעבר אחרי מצב כזה"
      description={`נספר מ-${read.sessions} ימי מסחר של ${read.symbol} עצמה, ${read.from} עד ${read.to}. כל שיעור מוצג מול שיעור הבסיס של אותה מניה — כמה פעמים יום אקראי באותו חלון הסתיים גבוה יותר. ההפרש ביניהם הוא כל מה שהתנאי הוסיף.`}
    >
      {active.length > 0 && (
        <div className="surface mb-5 p-5">
          <span className="micro-label">מה שקרה היום</span>
          <div className="mt-2">
            {active.map((c) => (
              <Row key={c.key} condition={c} />
            ))}
          </div>
        </div>
      )}

      <details className="surface p-5">
        <summary className="cursor-pointer text-[14px] text-ink">
          כל התנאים שנמדדו ({read.conditions.length})
        </summary>
        <div className="mt-3">
          {(active.length > 0 ? rest : read.conditions).map((c) => (
            <Row key={c.key} condition={c} />
          ))}
        </div>
      </details>

      <ul className="mt-5 space-y-1.5 text-[12px] leading-relaxed text-ink-faint">
        {read.caveats.map((caveat) => (
          <li key={caveat}>· {caveat}</li>
        ))}
      </ul>
    </Section>
  );
}
