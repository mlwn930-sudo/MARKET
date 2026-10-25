import {
  OUTLOOK_LABELS,
  type Outlook,
} from "@/lib/analysis/outlook";
import { CONFIDENCE_LABELS } from "@/lib/agents/types";

/**
 * The view, at the top of the page.
 *
 * Laid out so a reader who stops after ten seconds still leaves with the
 * position and the single condition it rests on. Everything below that —
 * the scenarios, the catalysts, the caveats — is for the reader who wants
 * to argue with it, and that is the reader this site is built for.
 *
 * The stance badge carries no colour of its own. A green "positive" badge
 * would be read as a buy signal from across the room, which is exactly the
 * shortcut the whole design refuses: green and red on this site mean the
 * price moved up or down today, and nothing else.
 */


export function OutlookPanel({ outlook }: { outlook: Outlook }) {
  const stance = OUTLOOK_LABELS[outlook.stance];

  return (
    <div className="space-y-4">
      {/* The position */}
      <div className="surface p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="badge" style={{ color: "var(--color-accent)" }}>
            {stance.label}
          </span>
          <span className="text-[12px] text-ink-faint">{stance.note}</span>
          <span className="ms-auto badge" title={outlook.confidenceReason}>
            {CONFIDENCE_LABELS[outlook.confidence]}
          </span>
        </div>

        <p className="mt-4 text-[17px] leading-relaxed text-ink">
          {outlook.headline}
        </p>

        <div className="mt-4 space-y-2.5 border-t border-line pt-4">
          {outlook.argument.map((line, i) => (
            <p key={i} className="text-[15px] leading-relaxed text-ink-muted">
              {line}
            </p>
          ))}
        </div>

        <p className="mt-4 text-[12px] leading-relaxed text-ink-ghost">
          רמת הוודאות: {outlook.confidenceReason}
        </p>
      </div>

      {/* What you are actually betting on */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="surface p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="section-mark" aria-hidden="true" />
            <span className="eyebrow">התזה עובדת אם</span>
          </div>
          {outlook.worksIf.length === 0 ? (
            <p className="text-[12px] text-ink-faint">
              אין תנאי שניתן לנסח מהנתונים שיש.
            </p>
          ) : (
            <ul className="space-y-2">
              {outlook.worksIf.map((item, i) => (
                <li key={i} className="text-[15px] leading-relaxed text-ink-muted">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="section-mark" aria-hidden="true" />
            <span className="eyebrow">היא נשברת אם</span>
          </div>
          {outlook.breaksIf.length === 0 ? (
            <p className="text-[12px] text-ink-faint">
              אין תנאי שבירה שניתן לנסח מהנתונים שיש. זו חולשה של הניתוח, לא
              חוזק של החברה.
            </p>
          ) : (
            <ul className="space-y-2">
              {outlook.breaksIf.map((item, i) => (
                <li key={i} className="text-[15px] leading-relaxed text-ink-muted">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Forward */}
      {(outlook.knownEvents.length > 0 || outlook.catalysts.length > 0) && (
        <section className="surface p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="section-mark" aria-hidden="true" />
            <span className="eyebrow">מה עוד לא נמצא בדוחות</span>
          </div>

          {outlook.knownEvents.map((event) => (
            <article
              key={event.title}
              className="mb-4 border-b border-line pb-4 last:mb-0 last:border-0 last:pb-0"
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <h4 className="text-[14px] text-ink">{event.title}</h4>
                <span className="num text-[12px] text-ink-faint">
                  {event.window ?? "החברה טרם מסרה מועד מאושר"}
                </span>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
                {event.why}
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                <span className="text-ink-muted">מה לבדוק: </span>
                {event.watch}
              </p>
              <p className="mt-2 text-[12px] text-ink-ghost">
                מקור: {event.source} · רשומה שהוזנה ידנית, לא נתון מחושב
              </p>
            </article>
          ))}

          {outlook.catalysts.length > 0 && (
            <ul className={outlook.knownEvents.length > 0 ? "mt-4 space-y-3 border-t border-line pt-4" : "space-y-3"}>
              {outlook.catalysts.map((catalyst) => (
                <li key={catalyst.title}>
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="text-[15px] text-ink">{catalyst.title}</span>
                    {catalyst.when && (
                      <span className="num text-[12px] text-ink-faint">
                        {catalyst.when}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
                    {catalyst.why}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* REMOVED: the three scenarios and the limits list.
          The scenarios were one arithmetic sentence — price x (1 +
          growth) x (target multiple / current multiple) — printed as
          three cards under a headline of +94%. It was captioned "not
          a forecast" and read as one anyway: a number that large
          beside a date is a forecast whatever the caption says.
          The site now counts what actually followed, out to half a
          trading year, from this instrument own history. A measured
          row beside a mechanical extrapolation makes the
          extrapolation worse than useless, because a reader cannot
          tell by looking which of the two was counted.
          The limits list went with it: every caveat in it is already
          carried by the panel it belongs to, and the page still ends
          with the disclaimer rule 6 requires. */}
    </div>
  );
}
