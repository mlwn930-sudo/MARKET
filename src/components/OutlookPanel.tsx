import Link from "next/link";
import {
  OUTLOOK_LABELS,
  type Outlook,
  type Scenario,
} from "@/lib/analysis/outlook";
import { CONFIDENCE_LABELS } from "@/lib/agents/types";
import { fmtPercent, fmtPrice } from "@/lib/format";

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

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const positive = (scenario.impliedReturn ?? 0) > 0;

  return (
    <article className="inset flex flex-col p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] text-ink-muted">{scenario.label}</span>
        <span
          className={`num text-[13px] ${
            scenario.impliedReturn === null
              ? "text-ink-faint"
              : positive
                ? "text-up"
                : "text-down"
          }`}
        >
          {scenario.impliedReturn === null
            ? "—"
            : fmtPercent(scenario.impliedReturn)}
        </span>
      </div>

      <div className="num mt-1 text-[20px] text-ink">
        {fmtPrice(scenario.impliedPrice)}
      </div>

      <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
        {scenario.assumptions.map((assumption, i) => (
          <li key={i} className="text-[11px] leading-relaxed text-ink-faint">
            {assumption}
          </li>
        ))}
      </ul>

      <ul className="mt-2 space-y-1">
        {scenario.drivers.map((driver, i) => (
          <li key={i} className="text-[11px] leading-relaxed text-ink-ghost">
            {driver}
          </li>
        ))}
      </ul>
    </article>
  );
}

export function OutlookPanel({
  outlook,
  ticker,
}: {
  outlook: Outlook;
  ticker: string;
}) {
  const stance = OUTLOOK_LABELS[outlook.stance];

  return (
    <div className="space-y-4">
      {/* The position */}
      <div className="surface p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="badge" style={{ color: "var(--color-accent)" }}>
            {stance.label}
          </span>
          <span className="text-[11px] text-ink-faint">{stance.note}</span>
          <span className="ms-auto badge" title={outlook.confidenceReason}>
            {CONFIDENCE_LABELS[outlook.confidence]}
          </span>
        </div>

        <p className="mt-4 text-[17px] leading-relaxed text-ink">
          {outlook.headline}
        </p>

        <div className="mt-4 space-y-2.5 border-t border-line pt-4">
          {outlook.argument.map((line, i) => (
            <p key={i} className="text-[13px] leading-relaxed text-ink-muted">
              {line}
            </p>
          ))}
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-ink-ghost">
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
                <li key={i} className="text-[13px] leading-relaxed text-ink-muted">
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
                <li key={i} className="text-[13px] leading-relaxed text-ink-muted">
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
                <span className="num text-[11px] text-ink-faint">
                  {event.window ?? "החברה טרם מסרה מועד מאושר"}
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                {event.why}
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                <span className="text-ink-muted">מה לבדוק: </span>
                {event.watch}
              </p>
              <p className="mt-2 text-[10px] text-ink-ghost">
                מקור: {event.source} · רשומה שהוזנה ידנית, לא נתון מחושב
              </p>
            </article>
          ))}

          {outlook.catalysts.length > 0 && (
            <ul className={outlook.knownEvents.length > 0 ? "mt-4 space-y-3 border-t border-line pt-4" : "space-y-3"}>
              {outlook.catalysts.map((catalyst) => (
                <li key={catalyst.title}>
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="text-[13px] text-ink">{catalyst.title}</span>
                    {catalyst.when && (
                      <span className="num text-[11px] text-ink-faint">
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

      {/* Scenarios */}
      {outlook.scenarios.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="section-mark" aria-hidden="true" />
              <span className="eyebrow">שלושה תרחישים לשנה קדימה</span>
            </div>
            <span className="text-[11px] text-ink-ghost">
              חישוב מכני מהמספרים שבעמוד — לא תחזית
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {outlook.scenarios.map((scenario) => (
              <ScenarioCard key={scenario.key} scenario={scenario} />
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-ink-ghost">
            כל תרחיש הוא משפט אריתמטי אחד: מחיר × (1 + צמיחה) × (מכפיל יעד ÷
            מכפיל נוכחי). ההנחות מודפסות מתחת לכל מספר כדי שאפשר יהיה לחלוק
            עליהן. הן אינן תחזית של האתר ואינן מחיר יעד.
          </p>
        </section>
      )}

      {/* Limits */}
      {outlook.caveats.length > 0 && (
        <section className="surface p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="section-mark" aria-hidden="true" />
            <span className="eyebrow">גבולות הניתוח</span>
          </div>
          <ul className="space-y-1.5">
            {outlook.caveats.map((caveat, i) => (
              <li key={i} className="text-[12px] leading-relaxed text-ink-faint">
                {caveat}
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-line pt-3 text-[11px] text-ink-ghost">
            רוצה את הטיעון המלא, מפורק לשאלות משנה?{" "}
            <Link
              href={`/research?ticker=${ticker}`}
              className="text-ink-muted transition-colors hover:text-ink"
            >
              מחקר עומק על {ticker} ←
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
