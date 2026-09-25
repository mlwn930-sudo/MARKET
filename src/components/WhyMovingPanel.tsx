import type { WhyMoving } from "@/lib/analysis/why-moving";
import { directionClass, fmtPercent } from "@/lib/format";
import { Reading } from "@/components/ui";

/**
 * Why is this moving, shown as candidates rather than as an answer.
 *
 * Each row is a test the site could run and what it found, in the order
 * that makes the reader's next thought correct: the market first, then the
 * sector, then the coverage. A page that leads with a headline teaches the
 * reader to attribute a 1% day to whatever was published that morning.
 *
 * The share bar is the honest part. When the index moved most of the way,
 * the bar says so, and the remaining sliver is what is actually about this
 * company.
 */
export function WhyMovingPanel({ reading }: { reading: WhyMoving }) {
  return (
    <div className="surface p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="section-mark" aria-hidden="true" />
          <span className="eyebrow">למה זה זז היום</span>
        </div>
        <span
          className={`num text-[18px] ${directionClass(reading.changePercent)}`}
        >
          {fmtPercent(reading.changePercent)}
        </span>
      </div>

      <ul className="space-y-4">
        {reading.drivers.map((driver) => (
          <li key={driver.key}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[13px] text-ink">{driver.title}</span>
              <span className="num text-[12px] text-ink-muted">
                {driver.figure}
              </span>
            </div>

            {driver.share !== null && driver.share > 0 && (
              <span
                className="mt-1.5 block h-[4px] w-full max-w-[200px] overflow-hidden rounded-full bg-overlay"
                role="img"
                aria-label={`מסביר כ-${Math.round(driver.share * 100)}% מהתנועה`}
              >
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.round(driver.share * 100)}%`,
                    background: "var(--color-accent)",
                    opacity: 0.75,
                  }}
                />
              </span>
            )}

            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-faint">
              {driver.body}
            </p>
          </li>
        ))}
      </ul>

      {/* The residual, set as the panel's conclusion rather than as
          another footnote. It is the most interesting sentence here — the
          part of today's move that the index, the sector and the coverage
          together do not account for — and it was previously indented to
          the same weight as the caveat under it. */}
      {reading.unexplained && <Reading>{reading.unexplained}</Reading>}

      <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-ghost">
        אלה מועמדים להסבר, לא סיבות מוכחות. התאמה בכיוון בין מדד למניה אינה
        קשר סיבתי, וכתבה שהתפרסמה באותו יום אינה בהכרח מה שהזיז את המחיר.
      </p>
    </div>
  );
}
