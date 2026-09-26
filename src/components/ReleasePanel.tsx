import type { KnownEvent } from "@/lib/analysis/known-events";
import { ageText } from "@/lib/intel/integrity";

/**
 * A dated event the company has committed to.
 *
 * This exists because the single most important fact about Take-Two is
 * not in any filing and no financial API carries it — and because the
 * page used to say, in effect, that no date had been given. A stated
 * date rendered as an absence is worse than no panel at all.
 *
 * The three things it insists on:
 *
 * **The status is a word, not an implication.** "Confirmed" means the
 * company named a day. "Indicated" means it named a period. The
 * difference decides how much weight a reader puts on the calendar, and
 * a page that prints both the same way has taken that decision for them.
 *
 * **The scope is printed, including what it excludes.** Rockstar's
 * statement covers two consoles. It says nothing about PC, and that
 * absence is a fact — the most common way this gets reported wrongly is
 * by assuming a PC version ships alongside.
 *
 * **The history is shown.** This date has moved twice. A date given once
 * and a date given third carry different weight, and hiding the previous
 * two would present the current one as firmer than the record supports.
 */
export function ReleasePanel({ event }: { event: KnownEvent }) {
  if (!event.window && event.status === "unannounced") {
    return (
      <div className="surface p-6">
        <p className="eyebrow mb-2.5">מועד</p>
        <p className="text-[15px] text-ink">החברה טרם מסרה מועד.</p>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ink-faint">
          כשאין תאריך מוצהר, האתר אומר זאת ואינו מציג אומדן — תאריך שהומצא
          כאן היה נראה זהה לתאריך שנלקח מהחברה.
        </p>
      </div>
    );
  }

  const confirmed = event.status === "confirmed";

  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-6 py-3.5">
        <span className="eyebrow">{event.title}</span>
        <span
          className="badge"
          style={confirmed ? { color: "var(--color-up)" } : undefined}
        >
          {confirmed ? "מועד מאושר" : "חלון מוצהר"}
        </span>
        <span className="num ms-auto text-[10px] text-ink-ghost">
          אומת {ageText(event.verifiedAt)}
        </span>
      </div>

      <div className="grid gap-px bg-line md:grid-cols-[1.2fr_1fr]">
        <div className="bg-surface p-6">
          <p className="text-[11px] text-ink-faint">מועד ההשקה</p>
          <p className="figure-lg mt-2 text-ink">{event.window}</p>

          {event.scope && event.scope.length > 0 && (
            <ul className="mt-5 space-y-1.5">
              {event.scope.map((line) => (
                <li
                  key={line}
                  className="flex gap-2.5 text-[12px] leading-relaxed text-ink-muted"
                >
                  <span
                    className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-ghost"
                    aria-hidden="true"
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-surface p-6">
          <p className="eyebrow mb-3">המועד כבר זז</p>
          {event.history && event.history.length > 0 ? (
            <ol className="space-y-2.5">
              {event.history.map((step) => (
                <li key={step.date} className="flex items-baseline gap-3">
                  <span className="num shrink-0 text-[12px] text-ink-faint">
                    {step.date}
                  </span>
                  <span className="text-[12px] leading-relaxed text-ink-ghost">
                    {step.note}
                  </span>
                </li>
              ))}
              <li className="flex items-baseline gap-3 border-t border-line pt-2.5">
                <span className="num shrink-0 text-[12px] text-ink">
                  {event.window}
                </span>
                <span className="text-[12px] leading-relaxed text-ink-muted">
                  המועד הנוכחי
                </span>
              </li>
            </ol>
          ) : (
            <p className="text-[12px] text-ink-ghost">
              לא תועדו שינויי מועד קודמים.
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-line bg-base/40 px-6 py-3.5">
        <p className="text-[11px] leading-relaxed text-ink-ghost">
          מקור:{" "}
          {event.sourceUrl ? (
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-faint underline decoration-line underline-offset-2 transition-colors hover:text-ink"
            >
              {event.source}
            </a>
          ) : (
            <span className="text-ink-faint">{event.source}</span>
          )}{" "}
          · המועד הוא הצהרת החברה ולא תחזית של האתר. דחייה נוספת אפשרית, והיא
          כבר קרתה פעמיים.
        </p>
      </div>
    </div>
  );
}
