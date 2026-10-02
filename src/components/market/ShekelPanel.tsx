import { GradeChip, DerivedMark } from "@/components/SignalCard";
import { Empty, Field } from "@/components/ui";
import { directionClass, fmtPercent } from "@/lib/format";
import type { ShekelRead } from "@/lib/analysis/tel-aviv";

/**
 * How far from the midpoint of the year a rate has to sit before this panel
 * will call it high or low.
 *
 * It exists because the claim was previously made off `position >= 0.5`,
 * and a hard split at the midpoint asserts a direction for a reading that
 * has none: at 0.502 — three agorot above the middle of a 54-agorot range —
 * the panel declared the dollar expensive. Ten points either side of the
 * middle is the band where the honest sentence is that there is no
 * direction, and the band itself is printed beside the figure rather than
 * left as a threshold only the code knows about.
 */
const MID_BAND = 0.1;

/**
 * The exchange rate, as half the return rather than as a widget.
 *
 * The page had the rate, the year's range and a sentence about it, and the
 * sentence was doing all the work. What it could not do was the arithmetic
 * the reader actually wants: an Israeli investor holding an American index
 * earns the index's move *and* the dollar's move, compounded, and the
 * second one is invisible in every figure the rest of this site prints.
 *
 * So the table restates each dollar asset in shekels and puts the local
 * index beside it unconverted, because the local index was already in the
 * reader's currency and saying so is the point of the comparison.
 *
 * What the panel does not do is tell anyone to hedge. It prints the
 * translation, names the two prints it rests on, and says in the footer
 * that the two measurements do not cover the same hours — Tel Aviv locks
 * about five hours before New York, and the rate trades through both.
 * Rule 8: the reader gets the argument, not a verdict.
 */
export function ShekelPanel({ read }: { read: ShekelRead }) {
  const rows = read.translated.filter((row) => row.localPercent !== null);

  return (
    <>
      {/* The rate itself, in context rather than alone: today's move, the
          year's range, and where in that range it currently sits. */}
      <div className="tase-readings surface" data-cols="3">
        <Field
          label="דולר / שקל"
          value={read.rate === null ? "—" : `₪${read.rate.toFixed(3)}`}
          context={
            read.changePercent === null ? (
              "השינוי היומי לא התקבל"
            ) : (
              /* Which way is which has to be said. "The shekel
                 strengthened" and "the rate fell" are the same event, and
                 a reader who mixes them up reads the sign backwards.

                 The figure gets its own `.num` element rather than being
                 interpolated into the string. The sentence is Hebrew and
                 the sign leads the figure, so without the isolate bidi
                 moves the "−" to the far side of the digits and the
                 sentence prints a different number from the one computed.
                 `.num` carries `unicode-bidi: isolate`; the Hebrew around
                 it must stay outside, because the same rule applied to a
                 phrase reorders the words. */
              <>
                <span className={`num ${directionClass(read.changePercent)}`}>
                  {fmtPercent(read.changePercent)}
                </span>{" "}
                היום —{" "}
                {read.changePercent > 0
                  ? "הדולר התחזק, והשקל נחלש מולו"
                  : read.changePercent < 0
                    ? "הדולר נחלש, והשקל התחזק מולו"
                    : "ללא שינוי מהותי"}
              </>
            )
          }
        />

        <Field
          label="טווח 52 השבועות"
          value={
            read.yearLow === null || read.yearHigh === null
              ? "—"
              : `${read.yearLow.toFixed(2)} – ${read.yearHigh.toFixed(2)}`
          }
          context="השער עצמו, לא מדד — אין כאן ממוצע סקטור להשוות אליו"
        />

        {/* A percentage of the range, not a meter.

            `Meter` prints "value/max", so a 0-to-1 position scaled by ten
            came out as "5/10" — which on a page of financial figures reads
            as a rating out of ten, and this site does not score anything:
            rule 8. It also quantised to tenths the same quantity the
            masthead prints to the percent, so the two said different things
            about one rate. The percentage is the figure, phrased the way the
            index strip phrases it, and the sentence under it is a reading
            rather than a verdict. */}
        <Field
          label="מקום השער בטווח השנה"
          value={
            read.position === null ? "—" : `${Math.round(read.position * 100)}%`
          }
          context={
            read.position === null
              ? "אין מספיק נתונים למקם את השער בטווח השנה"
              : Math.abs(read.position - 0.5) <= MID_BAND
                ? "מטווח 52 השבועות שלו — בתוך עשר נקודות מאמצע הטווח, ולכן אין כאן כיוון לטעון: השער אינו גבוה ואינו נמוך ביחס לשנה שלו"
                : read.position > 0.5
                  ? "מטווח 52 השבועות שלו, כלומר בחצי העליון: דולר יקר יחסית, ומי שקונה נכסים דולריים עכשיו משלם יותר שקלים עליהם"
                  : "מטווח 52 השבועות שלו, כלומר בחצי התחתון: דולר זול יחסית, ונכס דולרי שנקנה קודם שווה פחות שקלים כרגע"
          }
        />
      </div>

      {/* A table header over no rows is the shape this project treats as a
          failure rather than as minimalism: it tells a reader the figure
          should be there and does not say why it is not. When neither side
          of the comparison arrived, the panel says so instead of drawing
          its own frame around nothing. */}
      {rows.length === 0 && read.local === null ? (
        <div className="mt-4">
          <Empty
            title="אין כרגע מה להמיר"
            reason="ההמרה דורשת שני מחירים — מדד דולרי ושער חליפין — ולפחות אחד מהם לא התקבל בריענון הזה. השער עצמו, אם הגיע, מוצג למעלה."
            links={[
              { href: "/macro", label: "לוח המאקרו" },
              { href: "/heatmap", label: "מפת השוק" },
            ]}
            compact
          />
        </div>
      ) : (
        <div className="surface mt-4 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-5 py-3.5">
            <DerivedMark title="הומר בקוד משני מחירים — המדד ושער החליפין" />
            <span className="text-[12px] text-ink-muted">{read.headline}</span>
            <span className="ms-auto">
              <GradeChip grade={read.claim.grade} />
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="dt min-w-[520px]">
              <caption className="sr-only">
                תשואת נכסים דולריים היום, לפני ואחרי השינוי בשער הדולר, לצד מדד
                תל אביב שנמדד בשקלים מלכתחילה.
              </caption>
              <thead>
                <tr>
                  <th scope="col">נכס</th>
                  <th scope="col" className="n">
                    במטבע שלו
                  </th>
                  <th scope="col" className="n">
                    בשקלים
                  </th>
                  {/* The unit lives in the header, not in every cell. A
                    numeric column that repeats "נק׳ אחוז" fourteen times is
                    a column the eye stops reading as figures. */}
                  <th scope="col" className="n">
                    תרומת השער · נק׳ אחוז
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const added =
                    row.shekelPercent !== null && row.localPercent !== null
                      ? row.shekelPercent - row.localPercent
                      : null;

                  return (
                    <tr key={row.symbol}>
                      <td>
                        <span className="block text-[13px] text-ink">
                          {row.name}
                        </span>
                        <span className="num block text-[10px] text-ink-faint">
                          {row.symbol} · נסחר בדולר
                        </span>
                      </td>
                      <td className={`n ${directionClass(row.localPercent)}`}>
                        {fmtPercent(row.localPercent)}
                      </td>
                      <td className={`n ${directionClass(row.shekelPercent)}`}>
                        {fmtPercent(row.shekelPercent)}
                      </td>
                      {/* Never coloured. The currency contribution is not good
                        or bad news on its own — it depends entirely on which
                        side of the trade the reader is on. */}
                      <td className="n text-ink-muted">
                        {added === null
                          ? "—"
                          : `${added > 0 ? "+" : added < 0 ? "−" : ""}${Math.abs(added).toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })}

                {read.local && (
                  <tr>
                    <td>
                      <span className="block text-[13px] text-ink">
                        {read.local.name}
                      </span>
                      <span className="num block text-[10px] text-ink-faint">
                        נסחר בשקלים
                      </span>
                    </td>
                    <td className={`n ${directionClass(read.local.percent)}`}>
                      {fmtPercent(read.local.percent)}
                    </td>
                    <td className={`n ${directionClass(read.local.percent)}`}>
                      {fmtPercent(read.local.percent)}
                    </td>
                    <td className="n text-ink-muted">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {read.difference !== null && (
            <div className="border-t border-line px-5 py-3.5">
              <p className="text-[12px] leading-relaxed text-ink-muted">
                אחרי המרה, הפער בין שני הצדדים היום הוא{" "}
                <span className="num text-ink">
                  {Math.abs(read.difference).toFixed(2)}
                </span>{" "}
                נקודות אחוז לטובת{" "}
                <span className="text-ink">
                  {read.difference > 0
                    ? (read.leadName ?? "הצד הדולרי")
                    : (read.local?.name ?? "הצד המקומי")}
                </span>
                . זהו הפרש של יום מסחר אחד בלבד, ואין בו דבר על אף טווח ארוך
                ממנו.
              </p>
            </div>
          )}

          <div className="border-t border-line bg-element/70 px-5 py-4">
            <p className="num text-[11px] text-ink-faint">{read.claim.basis}</p>
            <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-ink-ghost">
              {read.claim.limits}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
