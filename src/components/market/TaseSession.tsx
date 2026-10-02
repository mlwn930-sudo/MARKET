import { GradeChip, DerivedMark } from "@/components/SignalCard";
import { Field } from "@/components/ui";
import { directionClass, fmtPercent } from "@/lib/format";
import type { SessionRead } from "@/lib/analysis/tel-aviv";

/**
 * What the local session actually did.
 *
 * The page it sits on used to answer this with one figure in the masthead
 * — "9/14 מניות בירוק" — which is a true statement that tells a reader
 * almost nothing. Nine of fourteen green on a day the index fell is a
 * different market from nine of fourteen green on a day it rose two
 * percent in three banks, and the strip could not tell those apart.
 *
 * Four readings, in the order they change what a reader thinks.
 *
 * Breadth, because it is the one thing an index cannot say. The
 * equal-weight average beside the index, because the gap between them *is*
 * the concentration story this market is known for, measured instead of
 * asserted. The month, because the audience here holds for quarters and a
 * single day's move is the least durable number on the page. And where the
 * names sit inside their own year, which is the only reading of the four
 * that still means something on a day the exchange was shut.
 *
 * Nothing here is scored or ranked. The panel ends with what the counting
 * does not establish, because a breadth figure off fourteen curated names
 * invites exactly one wrong conclusion — that it describes the exchange.
 */

/** Direction for a `Field`, which takes a tone rather than a class. */
function tone(value: number | null): "neutral" | "up" | "down" {
  if (value === null || !Number.isFinite(value) || value === 0) return "neutral";
  return value > 0 ? "up" : "down";
}

export function TaseSession({ read }: { read: SessionRead }) {
  const { spread, concentration } = read;

  /* The three bands are a share of what could be placed, not of the list.
     A name whose 52-week range did not arrive is absent from the bar
     rather than counted as mid-range, which would be inventing a position
     for it. */
  const band = (count: number) =>
    spread.scored > 0 ? `${(count / spread.scored) * 100}%` : "0%";

  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-5 py-3.5">
        <DerivedMark title="נספר בקוד מהציטוטים שהתקבלו" />
        <span className="text-[12px] text-ink-muted">{read.claim.basis}</span>
        <span className="ms-auto">
          <GradeChip grade={read.claim.grade} />
        </span>
      </div>

      {/* `Band`'s grid without `Band`'s frame. The group sits inside a panel
          that already draws one, and two borders a pixel apart is the thing
          that makes a dense page look assembled rather than designed. */}
      <div className="tase-readings">
        <Field
          label="רוחב המסחר"
          value={`${read.advancing}/${read.quoted}`}
          context={
            read.quoted === 0
              ? "לא התקבלו ציטוטים"
              : `${read.declining} בירידה · ${read.unchanged} ללא שינוי מהותי${
                  read.missing > 0 ? ` · ${read.missing} ללא נתון` : ""
                }`
          }
        />

        <Field
          label="ממוצע שווה-משקל"
          value={fmtPercent(read.averageMove)}
          tone={tone(read.averageMove)}
          context={
            concentration === null ? (
              "כל נייר נספר פעם אחת, בלי קשר לגודלו"
            ) : (
              /* The comparison is the point of the figure. A percentage on
                 its own would be a fifth number on a page of numbers;
                 against the cap-weighted index it becomes a sentence about
                 who moved the market.

                 Both figures get their own `.num` element rather than being
                 interpolated into the sentence. This is a Hebrew paragraph:
                 bidi takes a leading "+" or "−" that is not isolated and
                 moves it to the far side of the digits, so the index move
                 printed here read as a different number from the identical
                 figure in the panel's own basis line, which is isolated.
                 `.num` is the isolate, and it goes on the digits only — the
                 same rule applied to the Hebrew around them reorders the
                 words. */
              <>
                {concentration.indexName}{" "}
                <span
                  className={`num ${directionClass(concentration.indexMove)}`}
                >
                  {fmtPercent(concentration.indexMove)}
                </span>{" "}
                —{" "}
                {Math.abs(concentration.difference) < 0.1 ? (
                  "המדד והממוצע השווה זהים, כלומר התנועה התפרסה על כל הגדלים"
                ) : (
                  <>
                    {concentration.difference > 0
                      ? "המדד לפניו ב-"
                      : "הממוצע השווה לפני המדד ב-"}
                    {/* The gap is never coloured. It is a difference in
                        percentage points between two averages, not a price
                        direction, and green or red on it would say that
                        concentration is good or bad news. */}
                    <span className="num">
                      {Math.abs(concentration.difference).toFixed(2)}
                    </span>{" "}
                    נקודות אחוז, כלומר התנועה{" "}
                    {concentration.difference > 0
                      ? "מרוכזת בגדולות"
                      : "בקטנות יותר"}
                  </>
                )}
              </>
            )
          }
        />

        <Field
          label={
            read.windowSessions > 0
              ? `${read.windowSessions} המסחרים האחרונים`
              : "חלון החודש"
          }
          value={fmtPercent(read.windowAverage)}
          tone={tone(read.windowAverage)}
          context="אותן חברות, שווה-משקל, לאורך חלון החודש שהציטוט מחזיק — טווח שיום בודד לא מזיז"
        />

        <div>
          <div className="text-[12px] text-ink-faint">
            בחמישון העליון של טווח השנה
          </div>
          <div className="num mt-1.5 text-[17px] text-ink">
            {spread.scored === 0 ? "—" : `${spread.high}/${spread.scored}`}
          </div>
          {/* Three neutral steps, never green and red. "Near its high" is
              not good news and "near its low" is not bad news — colouring
              them would be the site holding an opinion it may not hold. */}
          <div
            className="tase-spread mt-2"
            role="img"
            aria-label={`${spread.high} בחמישון העליון של טווח השנה, ${spread.middle} באמצע, ${spread.low} בחמישון התחתון`}
          >
            <i data-band="high" style={{ width: band(spread.high) }} />
            <i data-band="mid" style={{ width: band(spread.middle) }} />
            <i data-band="low" style={{ width: band(spread.low) }} />
          </div>
          <div className="context-line mt-1.5">
            {spread.scored === 0
              ? "טווחי השנה לא התקבלו"
              : `מתוך ${spread.scored} שניתן למקם · ${spread.middle} באמצע הטווח · ${spread.low} בחמישון התחתון`}
          </div>
        </div>
      </div>

      {/* The ends of the list. Today's extreme is the headline a reader
          expects; the month's extreme is the one more likely to still be
          true next week, which is why both are here rather than one. */}
      {(read.best !== null || read.windowBest !== null) && (
        <div className="grid gap-x-8 gap-y-4 border-t border-line px-5 py-4 sm:grid-cols-2">
          {[
            { label: "הקצוות היום", up: read.best, down: read.worst },
            {
              label:
                read.windowSessions > 0
                  ? `הקצוות ב-${read.windowSessions} המסחרים`
                  : "הקצוות בחלון החודש",
              up: read.windowBest,
              down: read.windowWorst,
            },
          ].map((group) => (
            <div key={group.label}>
              <p className="eyebrow mb-2">{group.label}</p>
              <div className="space-y-1.5">
                {[group.up, group.down].map((entry, index) =>
                  entry === null ? null : (
                    <div
                      key={`${group.label}-${index}-${entry.symbol}`}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="truncate text-[12.5px] text-ink-muted">
                        {entry.name}
                        <span
                          className="num ms-2 text-[10px] text-ink-ghost"
                          dir="ltr"
                        >
                          {entry.symbol.replace(".TA", "")}
                        </span>
                      </span>
                      <span
                        className={`num shrink-0 text-[12.5px] ${directionClass(entry.percent)}`}
                      >
                        {fmtPercent(entry.percent)}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-line bg-element/70 px-5 py-4">
        <p className="max-w-3xl text-[11px] leading-relaxed text-ink-ghost">
          {read.claim.limits}
        </p>
      </div>
    </div>
  );
}
