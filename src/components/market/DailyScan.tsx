import Link from "next/link";
import { DIRECTION_NAME, HORIZON_NAME, SELECTION_CAVEAT } from "@/lib/analysis/stance";
import { ScanChange } from "@/components/market/ScanChange";
import type { ScanFile } from "@/lib/signals/scan-store";

/**
 * Which names had a counted condition fire today.
 *
 * The chart reader answers "what is true about this one", and the
 * watchlist answers it for names already chosen. Neither answers the
 * question that comes before both: of everything the site measures,
 * where is there anything to look at at all.
 *
 * WHAT THIS IS NOT, AND THE PAGE HAS TO SAY SO. It is not a ranking and
 * it is not a list of the best ideas. The first real run put 21 of 123
 * names here — more than the ten `measure-selection.ts` implied, because
 * that measured one horizon and this counts a name when either fires.
 * Expect a comparable number every day whatever the market did. The
 * denominator is printed in the same sentence as the count for exactly
 * that reason: "21 names" is a leaderboard, "21 of 123" is a filter.
 *
 * SORTED BY TICKER, DELIBERATELY. Sorting by the size of the gap would
 * make the top row look like the best idea, and the measurement says the
 * gap is close to what the best of thirteen conditions looks like on an
 * arbitrary stock. Alphabetical order makes no claim.
 */
export function DailyScan({ scan }: { scan: ScanFile | null }) {
  if (!scan) {
    return (
      <p className="text-[13px] leading-relaxed text-ink-ghost">
        הסריקה היומית עוד לא נבנתה. היא נכתבת בריצה הלילית, יחד עם הדירוג
        ומטריצת המתאמים.
      </p>
    );
  }

  const names = [...scan.names].sort((a, b) => a.symbol.localeCompare(b.symbol));

  return (
    <div>
      <p className="text-[13px] leading-relaxed text-ink-muted">
        <span className="num">{scan.withDirection}</span> מתוך{" "}
        <span className="num">{scan.universe}</span> הניירות שנמדדו היה בהם
        תנאי נמדד שפעל בנר של{" "}
        <span className="num" dir="ltr">
          {scan.asOf}
        </span>
        , עם מדגם והפרש מול הבסיס שמצדיקים הדפסה. זו רשימת סינון ולא דירוג:
        מספר דומה יופיע כאן כמעט בכל יום.
      </p>

      {/* ABOVE THE LIST, because it is the reason to come back. The
          list itself is largely the same twenty-one names every
          morning; the difference is the new information. */}
      <div className="mt-3 border-s-2 border-line ps-3">
        <ScanChange scan={scan} />
      </div>

      {names.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-ghost">
          אף נייר ביקום לא עמד בתנאים האלה היום. זו תשובה, לא תקלה.
        </p>
      ) : (
        <div className="mt-4 grid gap-px overflow-hidden rounded border border-line bg-line">
          {names.map((name) => (
            <div key={name.symbol} className="bg-surface px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <Link
                  href={`/company/${name.symbol}`}
                  className="num text-[15px] text-ink"
                  dir="ltr"
                >
                  {name.symbol}
                </Link>
                <span className="num text-[12px] text-ink-faint" dir="ltr">
                  {name.lastClose.toFixed(2)}
                </span>
              </div>

              {name.horizons.map((h) => (
                <div key={h.horizon} className="mt-2">
                  <span className="text-[13px] text-ink">
                    {HORIZON_NAME[h.horizon]} · {DIRECTION_NAME[h.direction]}
                  </span>
                  {h.lead && (
                    <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-muted">
                      {h.lead.label} —{" "}
                      <span className="num" dir="ltr">
                        {Math.round(h.lead.upShareHist * 100)}%
                      </span>{" "}
                      מול בסיס{" "}
                      <span className="num" dir="ltr">
                        {Math.round(h.lead.baselineUpShare * 100)}%
                      </span>{" "}
                      <span className="num" dir="ltr">
                        ({h.lead.liftPp >= 0 ? "+" : ""}
                        {Math.round(h.lead.liftPp)} נק׳, n={h.lead.n})
                      </span>
                    </span>
                  )}
                  {/* Same size and colour as the line above it. A
                      direction in full contrast over a grey objection is
                      a recommendation with a disclaimer attached. */}
                  {h.against && (
                    <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-muted">
                      {h.against}
                    </span>
                  )}
                  {h.ends && (
                    <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-ghost">
                      מסתיים אם: {h.ends}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* The measurement that embarrasses the list travels with the list,
          on the same contract as every other caveat in this project. */}
      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-ghost">
        {SELECTION_CAVEAT}
      </p>
    </div>
  );
}
