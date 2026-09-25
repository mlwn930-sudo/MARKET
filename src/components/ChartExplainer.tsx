import type { ChartReading } from "@/lib/analysis/chart-read";

/**
 * The chart, read out loud.
 *
 * Sits directly under the chart rather than in a separate section, because
 * it is a caption and not a chapter: the reader should be able to look at
 * the line, then at the sentence about the line, without scrolling between
 * them.
 *
 * Each observation carries its figure on the left. That is the whole
 * discipline of this panel — a sentence about a chart with no number beside
 * it is an opinion, and there are enough of those on the internet.
 */
export function ChartExplainer({ reading }: { reading: ChartReading }) {
  return (
    <section className="surface p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="section-mark" aria-hidden="true" />
        <span className="eyebrow">מה הגרף הזה אומר</span>
      </div>

      <p className="text-[15px] leading-relaxed text-ink">{reading.headline}</p>

      <dl className="mt-5 grid gap-x-8 gap-y-4 border-t border-line pt-4 md:grid-cols-2">
        {reading.observations.map((observation) => (
          <div key={observation.title} className="flex gap-3">
            {observation.figure && (
              <span className="num shrink-0 pt-0.5 text-[13px] text-ink">
                {observation.figure}
              </span>
            )}
            <div>
              <dt className="text-[12px] text-ink-muted">{observation.title}</dt>
              <dd className="mt-1 text-[12px] leading-relaxed text-ink-faint">
                {observation.body}
              </dd>
            </div>
          </div>
        ))}
      </dl>

      <ul className="mt-5 space-y-1.5 border-t border-line pt-4">
        {reading.limits.map((limit, i) => (
          <li key={i} className="text-[11px] leading-relaxed text-ink-ghost">
            {limit}
          </li>
        ))}
      </ul>
    </section>
  );
}
