import Link from "next/link";
import { GRADE_LABELS, GRADE_MEANING, type Grade } from "@/lib/intel/confidence";
import { SIGNAL_KIND_LABELS, type Signal } from "@/lib/intel/signals";

/**
 * A finding the site derived, with the evidence attached.
 *
 * Every signal on this site opens. That is the whole design: a headline
 * that says "momentum shift" and cannot be unfolded into the price, the
 * volume, the sector and the indicator behind it is a horoscope, and the
 * difference between this product and a generic dashboard is that the
 * unfolding is a contract rather than a feature.
 *
 * Three things are always visible before anything is clicked — what
 * happened, why it matters, and how well evidenced it is. The fourth,
 * what the claim does *not* establish, sits one level in. That ordering
 * is deliberate: a limit shown at the same weight as a finding makes
 * every finding look doubtful, and a limit hidden entirely makes every
 * finding look certain.
 *
 * The violet mark says a machine derived this in code, as opposed to the
 * cyan mark that says a model wrote it. The reader can check the first
 * one; the second one they have to judge.
 */

export function GradeChip({ grade }: { grade: Grade }) {
  return (
    <span className="grade" data-grade={grade} title={GRADE_MEANING[grade]}>
      {GRADE_LABELS[grade]}
    </span>
  );
}

/** The glyph that marks a conclusion the code produced. */
export function DerivedMark({ title = "נגזר בקוד מנתוני האתר" }: { title?: string }) {
  return (
    <span className="derived-mark" title={title}>
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M2.5 6h2l1.5-3 1.5 6 1-3h1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only">{title}</span>
    </span>
  );
}

export function SignalCard({
  signal,
  /** Drops the kind label — for a list that is already one kind. */
  bare = false,
}: {
  signal: Signal;
  bare?: boolean;
}) {
  const title = (
    <span className="text-[14px] font-medium leading-snug text-ink">
      {signal.headline}
    </span>
  );

  return (
    <article className="surface lift p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <DerivedMark />
        {!bare && (
          <span className="badge">{SIGNAL_KIND_LABELS[signal.kind]}</span>
        )}
        <GradeChip grade={signal.claim.grade} />
        {signal.ticker && (
          <Link
            href={`/company/${signal.ticker}`}
            className="num rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-faint transition-colors hover:border-line-strong hover:text-ink"
          >
            {signal.ticker}
          </Link>
        )}
        <span
          className="num ms-auto text-[10px] text-ink-ghost"
          title="ציון מהותיות — כמה הממצא הזה אמור לדחוק משהו אחר מהמסך"
        >
          {signal.materiality}
        </span>
      </div>

      {signal.href ? (
        <Link href={signal.href} className="block hover:text-accent">
          {title}
        </Link>
      ) : (
        title
      )}

      {signal.soWhat && (
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
          {signal.soWhat}
        </p>
      )}

      {/* The evidence. Closed by default, because a briefing of eight open
          signals is a wall — and present on every card, because a signal
          without it would not have been published. */}
      <details className="group mt-3.5 border-t border-line pt-3">
        <summary className="flex cursor-pointer items-center justify-between gap-3 text-[11px] text-ink-ghost transition-colors hover:text-ink-muted">
          <span>
            על מה זה נשען · {signal.evidence.length}{" "}
            {signal.evidence.length === 1 ? "נתון" : "נתונים"}
          </span>
          <span
            className="transition-transform group-open:rotate-180"
            aria-hidden="true"
          >
            ▾
          </span>
        </summary>

        <div className="mt-3 space-y-3">
          <div>
            <p className="eyebrow mb-1.5">המדידה</p>
            <p className="num text-[12px] leading-relaxed text-ink-muted">
              {signal.claim.basis}
            </p>
          </div>

          {signal.evidence.length > 0 && (
            <dl className="space-y-2 border-t border-line pt-3">
              {signal.evidence.map((item, index) => (
                <div key={`${index}-${item.label}`}>
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                    <dt className="text-[11px] text-ink-faint">{item.label}</dt>
                    <dd className="num text-[12px] text-ink">{item.value}</dd>
                    <dd className="text-[10px] text-ink-ghost">
                      ({item.source.origin}
                      {item.source.asOf && ` · ${item.source.asOf}`})
                    </dd>
                  </div>
                  {item.note && (
                    <dd className="mt-0.5 text-[11px] leading-relaxed text-ink-ghost">
                      {item.note}
                    </dd>
                  )}
                </div>
              ))}
            </dl>
          )}

          {/* Required by the type, and printed for the same reason it is
              required: a claim that cannot say what it fails to prove has
              not been thought about. */}
          <div className="border-t border-line pt-3">
            <p className="eyebrow mb-1.5">מה זה לא מוכיח</p>
            <p className="text-[11px] leading-relaxed text-ink-ghost">
              {signal.claim.limits}
            </p>
          </div>
        </div>
      </details>
    </article>
  );
}
