import type { ExpectationGap } from "@/lib/analysis/expectation-gap";

/**
 * Two columns, facing each other.
 *
 * The layout is the argument: what the price is saying on one side, what
 * the filings reported on the other, and the reader's eye crosses between
 * them. A single merged list would let the site decide which figures
 * matter; two columns let the reader see that the premium is 80% and the
 * growth gap is negative, and reach the conclusion themselves.
 *
 * No colour on the verdict. "Priced above delivery" is not bad news — it
 * is a statement about what has to happen next, and whether that is a
 * problem depends on what the reader thinks will happen.
 */

const DIRECTION_LABELS: Record<ExpectationGap["direction"], string> = {
  "priced-above-delivery": "המחיר מקדים את הביצועים",
  "priced-below-delivery": "הביצועים מקדימים את המחיר",
  aligned: "המחיר והביצועים מסתדרים",
  unknown: "לא ניתן למדוד",
};

export function ExpectationGapPanel({ gap }: { gap: ExpectationGap }) {
  return (
    <div className="space-y-4">
      <div className="surface p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="badge" style={{ color: "var(--color-insight)" }}>
            {DIRECTION_LABELS[gap.direction]}
          </span>
        </div>

        <p className="mt-4 text-[16px] leading-relaxed text-ink">
          {gap.headline}
        </p>
      </div>

      {(gap.market.length > 0 || gap.delivered.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="surface p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="section-mark" aria-hidden="true" />
              <span className="eyebrow">מה המחיר מגלם</span>
            </div>
            <dl className="space-y-4">
              {gap.market.map((side) => (
                <div key={side.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-[12px] text-ink-muted">{side.label}</dt>
                    <dd className="num text-[15px] text-ink">{side.figure}</dd>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
                    {side.body}
                  </p>
                </div>
              ))}
            </dl>
          </section>

          <section className="surface p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="section-mark" aria-hidden="true" />
              <span className="eyebrow">מה הדוחות מראים</span>
            </div>
            <dl className="space-y-4">
              {gap.delivered.map((side) => (
                <div key={side.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-[12px] text-ink-muted">{side.label}</dt>
                    <dd className="num text-[15px] text-ink">{side.figure}</dd>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
                    {side.body}
                  </p>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}

      {gap.record && (
        <section className="surface p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="section-mark" aria-hidden="true" />
              <span className="eyebrow">מול תחזיות האנליסטים</span>
            </div>
            <span className="num text-[13px] text-ink">
              {gap.record.beats} הכאות · {gap.record.misses} פספוסים ·{" "}
              {gap.record.quarters} רבעונים
            </span>
          </div>
          <p className="text-[12px] leading-relaxed text-ink-muted">
            {gap.record.note}
          </p>
        </section>
      )}

      {gap.wouldClose.length > 0 && (
        <section className="surface p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="section-mark" aria-hidden="true" />
            <span className="eyebrow">מה היה סוגר את הפער</span>
          </div>
          <ul className="space-y-2">
            {gap.wouldClose.map((item, i) => (
              <li key={i} className="text-[13px] leading-relaxed text-ink-muted">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-[11px] leading-relaxed text-ink-ghost">{gap.caveat}</p>
    </div>
  );
}
