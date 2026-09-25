import { STANCE_LABEL, type Verdict } from "@/lib/analysis/verdict";

/**
 * The blunt answer, at the top of the page.
 *
 * Laid out so the verdict is legible in about two seconds: a score, a
 * sentence, then the reasons on the left and what is stopping it on the
 * right. Everything below that is the working.
 *
 * The stance is NOT colour-coded green and red. Those two colours mean
 * price direction on every other surface of this site, and a green
 * "passes" badge would read as a buy signal — which is exactly the reading
 * this surface is built to avoid. The stance is carried by the word, the
 * score and the weight of the type instead.
 *
 * The caveat sits inside the surface rather than in the page footer. A reader
 * who takes the score at face value should have to pass the sentence
 * explaining what the score does not know.
 */

function CheckRow({
  question,
  detail,
  passed,
  why,
  core,
}: {
  question: string;
  detail: string;
  passed: boolean | null;
  why: string;
  core: boolean;
}) {
  const mark = passed === null ? "–" : passed ? "✓" : "✕";

  return (
    <details className="group border-b border-line last:border-b-0">
      <summary className="flex cursor-pointer items-start justify-between gap-3 py-2.5">
        <span className="flex items-start gap-2.5">
          <span
            className={`num mt-px w-3 shrink-0 text-xs ${
              passed === null ? "text-ink-faint" : "text-ink"
            }`}
            aria-hidden="true"
          >
            {mark}
          </span>
          <span
            className={`text-[13px] leading-snug ${
              passed === false ? "text-ink" : "text-ink-muted"
            }`}
          >
            {question}
            {core && (
              <span className="mr-1.5 text-[9px] text-ink-faint">ליבה</span>
            )}
          </span>
        </span>
        <span className="num shrink-0 text-[11px] text-ink-faint">{detail}</span>
      </summary>
      <p className="pb-3 ps-[22px] text-[11px] leading-relaxed text-ink-faint">
        {why}
      </p>
    </details>
  );
}

export function VerdictPanel({ verdict }: { verdict: Verdict }) {
  const share =
    verdict.evaluated > 0 ? verdict.passed / verdict.evaluated : 0;

  return (
    /* One surface, divided — not five stacked panels.
       The score, the reasons, the checklist and the falsification are one
       argument read top to bottom, and giving each of them its own rounded
       card was what made a single verdict look like five findings that
       happened to be printed near each other. */
    <section className="enter surface overflow-hidden">
      {/* No coloured bar across the top. It was drawn in the page tint,
          which on a company page is that company's brand colour — a band
          of NVIDIA green over "10 of 11 passed" is an endorsement, and
          this panel's whole design is built to not give one. The border
          and the spacing carry the panel on their own. */}

      {/* ---- The score ---- */}
      <div className="p-6">
        <p className="eyebrow">האם החברה עוברת את הבדיקות</p>

        <div className="mt-4 flex flex-wrap items-end gap-x-7 gap-y-3">
          <div className="flex items-baseline gap-1">
            <span className="figure-xl text-ink">{verdict.passed}</span>
            <span className="num text-2xl text-ink-ghost">
              /{verdict.evaluated}
            </span>
          </div>

          <div className="pb-1.5">
            <div className="badge inline-block rounded-full px-3 py-1 text-xs">
              {STANCE_LABEL[verdict.stance]}
            </div>
            <p className="num mt-2 text-[11px] text-ink-faint">
              בדיקות ליבה: {verdict.corePassed}/{verdict.coreEvaluated}
            </p>
          </div>
        </div>

        {/* The score as a bar, so the proportion registers before the
            numbers are read. */}
        <div
          className="mt-5 h-1.5 overflow-hidden rounded-full bg-overlay"
          role="img"
          aria-label={`${verdict.passed} מתוך ${verdict.evaluated} בדיקות עברו`}
        >
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${share * 100}%`, background: "var(--color-measure)" }}
          />
        </div>

        <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-ink">
          {verdict.headline}
        </p>
      </div>

      {/* ---- Reasons and blockers, side by side ---- */}
      <div className="grid border-t border-line lg:grid-cols-2">
        <div className="border-b border-line p-6 lg:border-b-0 lg:border-e">
          <h3 className="eyebrow">מה עובד כאן</h3>
          {verdict.reasonsFor.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-faint">
              אף אחת מבדיקות הליבה לא עברה.
            </p>
          ) : (
            <ul className="mt-3.5 space-y-2.5">
              {verdict.reasonsFor.map((reason, index) => (
                <li
                  key={`${index}-${reason}`}
                  className="flex gap-2.5 text-[13px] leading-relaxed text-ink-muted"
                >
                  <span
                    className="num mt-px shrink-0 text-ink"
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-6">
          <h3 className="eyebrow">מה עוצר</h3>
          {verdict.blockers.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-faint">
              אף בדיקה לא נכשלה.
            </p>
          ) : (
            <ul className="mt-3.5 space-y-2.5">
              {verdict.blockers.map((blocker, index) => (
                <li
                  key={`${index}-${blocker}`}
                  className="flex gap-2.5 text-[13px] leading-relaxed text-ink"
                >
                  <span
                    className="num mt-px shrink-0 text-ink-faint"
                    aria-hidden="true"
                  >
                    ✕
                  </span>
                  <span>{blocker}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ---- The full checklist ---- */}
      <div className="border-t border-line p-6">
        <h3 className="eyebrow">כל הבדיקות</h3>
        <p className="mt-1.5 text-[11px] text-ink-faint">
          לחיצה על שורה מסבירה למה השאלה הזו נמצאת ברשימה.
        </p>
        <div className="mt-3">
          {verdict.checks.map((check) => (
            <CheckRow
              key={check.key}
              question={check.question}
              detail={check.detail}
              passed={check.passed}
              why={check.why}
              core={check.core}
            />
          ))}
        </div>
      </div>

      {/* ---- What would make this wrong ---- */}
      <div className="border-t border-line bg-base/40 p-6">
        <h3 className="eyebrow">מה היה הופך את הקריאה הזו לשגויה</h3>
        <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
          {verdict.falsification}
        </p>
        <p className="mt-4 border-t border-line pt-3.5 text-[11px] leading-relaxed text-ink-ghost">
          {verdict.caveat}
        </p>
      </div>
    </section>
  );
}
