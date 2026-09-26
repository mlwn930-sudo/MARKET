import type { ExpectationEngine } from "@/lib/intel/surprise";
import type { EarningsRead } from "@/lib/intel/earnings";
import { GradeChip, DerivedMark } from "./SignalCard";

/**
 * What the market expects, what would surprise it, and what the last
 * report actually said.
 *
 * Two panels that belong together, because the second is how the first
 * gets tested. An expectation with no measurement that would falsify it
 * is a mood; a report with no expectation to measure it against is
 * trivia.
 *
 * The assumptions block at the bottom of the first panel is not a
 * disclaimer. The arithmetic that turns a multiple premium into a
 * required growth rate has three assumptions baked into it, and a number
 * whose assumptions are not printed beside it is exactly what rule 9 of
 * this project forbids. They are set at caption weight and they are never
 * folded away.
 */

/* ------------------------------------------------------------------ */
/* What the market expects                                             */
/* ------------------------------------------------------------------ */

export function ExpectationEnginePanel({
  engine,
}: {
  engine: ExpectationEngine;
}) {
  const upside = engine.surprises.filter((s) => s.direction === "up");
  const downside = engine.surprises.filter((s) => s.direction === "down");

  return (
    <div className="surface overflow-hidden">
      <div className="border-b border-line p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <DerivedMark title="חושב בקוד ממכפילים וחציוני סקטור" />
          <span className="eyebrow">מה השוק מגלם</span>
          <GradeChip grade={engine.claim.grade} />
        </div>
        <p className="max-w-3xl text-[15px] leading-relaxed text-ink">
          {engine.headline}
        </p>
      </div>

      <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
        {engine.expects.map((expectation, index) => (
          <div key={`${index}-${expectation.label}`} className="bg-surface p-5">
            <div className="text-[11px] text-ink-faint">{expectation.label}</div>
            <div className="num mt-1.5 text-[17px] text-ink">
              {expectation.figure}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
              {expectation.body}
            </p>
          </div>
        ))}
      </div>

      {/* The falsifiable half. This is the part a reader can actually
          check next quarter, which is why it gets the larger share of the
          panel. */}
      {engine.surprises.length > 0 && (
        <div className="border-t border-line p-6">
          <h3 className="eyebrow mb-1">מה היה מפתיע את השוק</h3>
          <p className="mb-5 max-w-3xl text-[12px] leading-relaxed text-ink-faint">
            כל שורה היא מדידה עם סף. זה מה שהופך את הציפייה למשהו שאפשר
            להפריך — ״יקרה״ היא דעה שאיש לא יכול לבדוק, ״הצמיחה העודפת צריכה
            להיות 12% ובפועל היא 4%״ היא טענה שהרבעון הבא מזיז או לא.
          </p>

          <div className="grid gap-x-10 gap-y-7 lg:grid-cols-2">
            {[
              { title: "לרעת התמחור", items: downside },
              { title: "לטובת התמחור", items: upside },
            ]
              .filter((column) => column.items.length > 0)
              .map((column) => (
                <div key={column.title}>
                  <h4 className="eyebrow mb-3">{column.title}</h4>
                  <div className="space-y-4">
                    {column.items.map((surprise, index) => (
                      <div
                        key={`${index}-${surprise.trigger}`}
                        className="border-s-2 ps-4"
                        style={{
                          borderColor:
                            surprise.direction === "down"
                              ? "var(--color-warning)"
                              : "var(--color-data)",
                        }}
                      >
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-[13px] leading-snug text-ink">
                            {surprise.trigger}
                          </span>
                          <GradeChip grade={surprise.grade} />
                        </div>

                        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                          <div className="flex items-baseline gap-1.5">
                            <dt className="text-[10px] text-ink-ghost">היום</dt>
                            <dd className="num text-[11px] text-ink-muted">
                              {surprise.measuredNow}
                            </dd>
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <dt className="text-[10px] text-ink-ghost">הסף</dt>
                            <dd className="num text-[11px] text-ink">
                              {surprise.threshold}
                            </dd>
                          </div>
                        </dl>

                        <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                          {surprise.why}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="border-t border-line bg-base/40 p-6">
        <h3 className="eyebrow mb-2.5">ההנחות שהחישוב נשען עליהן</h3>
        <ul className="space-y-1.5">
          {engine.assumptions.map((assumption, index) => (
            <li
              key={`${index}-${assumption.slice(0, 20)}`}
              className="text-[11px] leading-relaxed text-ink-ghost"
            >
              — {assumption}
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-ghost">
          {engine.claim.limits}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* What the last report said                                           */
/* ------------------------------------------------------------------ */

const DIRECTION_MARK: Record<string, string> = {
  better: "▲",
  worse: "▼",
  flat: "—",
  unknown: "·",
};

export function EarningsReadPanel({ read }: { read: EarningsRead }) {
  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-5 py-3.5">
        <DerivedMark title="הושווה בקוד מול ארבעה אמות מידה" />
        <span className="text-[12px] font-medium text-ink">
          רבעון {read.period}
        </span>
        <GradeChip grade={read.claim.grade} />
        {read.record && (
          <span className="num ms-auto text-[11px] text-ink-ghost">
            {read.record.beats}/{read.record.quarters} הכאות
          </span>
        )}
      </div>

      {/* Four yardsticks, not one. A beat against a consensus that was cut
          twice in the quarter is not the same event as a beat against the
          number analysts held all along, and one row cannot say which. */}
      <div className="divide-y divide-line">
        {read.yardsticks.map((yardstick, index) => (
          <div
            key={`${index}-${yardstick.label}`}
            className="grid gap-2 px-5 py-4 sm:grid-cols-[180px_1fr] sm:gap-6"
          >
            <div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`num text-[11px] ${
                    yardstick.direction === "better"
                      ? "text-up"
                      : yardstick.direction === "worse"
                        ? "text-down"
                        : "text-ink-ghost"
                  }`}
                  aria-hidden="true"
                >
                  {DIRECTION_MARK[yardstick.direction]}
                </span>
                <span className="text-[12px] text-ink-muted">
                  {yardstick.label}
                </span>
              </div>
              <div className="num mt-1 text-[13px] text-ink">
                {yardstick.figure}
              </div>
            </div>
            <p className="text-[12px] leading-relaxed text-ink-faint">
              {yardstick.body}
            </p>
          </div>
        ))}
      </div>

      {read.record && (
        <div className="border-t border-line px-5 py-4">
          <p className="text-[12px] leading-relaxed text-ink-muted">
            {read.record.note}
          </p>
        </div>
      )}

      {/* Stated, not filled. Guidance is usually what moves the price more
          than the result, and the free tier does not carry it — so the
          absence is named rather than replaced with an estimate. */}
      <div className="border-t border-line bg-base/40 px-5 py-4">
        <h3 className="eyebrow mb-2.5">מה לא נמדד כאן</h3>
        <ul className="space-y-1.5">
          {read.missing.map((item, index) => (
            <li
              key={`${index}-${item.slice(0, 20)}`}
              className="text-[11px] leading-relaxed text-ink-ghost"
            >
              — {item}
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-ghost">
          {read.claim.limits}
        </p>
      </div>
    </div>
  );
}
