import type { Thesis, ThesisPoint } from "@/lib/analysis/thesis";

/**
 * The synthesis panel: what every framework on the page found, and where
 * they disagree.
 *
 * Findings are grouped by kind rather than scored. A count of three
 * strengths against two concerns is not a verdict and the layout does not
 * pretend otherwise — there is no total, no gauge and no colour scale from
 * bad to good, because those imply a comparability between findings that
 * does not exist. "Net debt at 3.4x EBITDA" and "share count rose 2%" are
 * both concerns and they are not the same size.
 *
 * The disagreement panel is placed above the findings deliberately. When the
 * frameworks conflict, that conflict is the most useful thing on the page,
 * and burying it under a list of bullet points is how a reader ends up
 * reading only the half that agrees with them.
 */

const KIND_STYLE: Record<
  ThesisPoint["kind"],
  { label: string; mark: string; className: string }
> = {
  strength: {
    label: "לטובה",
    mark: "▲",
    // Neutral ink, not green. Green means price direction on this site, and
    // a green "strength" badge would quietly turn an analytical finding into
    // a buy signal.
    className: "text-ink",
  },
  concern: { label: "סימן שאלה", mark: "▼", className: "text-ink" },
  watch: { label: "למעקב", mark: "◆", className: "text-ink-muted" },
};

function PointCard({ point }: { point: ThesisPoint }) {
  const style = KIND_STYLE[point.kind];

  return (
    <article className="panel accent-edge p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={`text-sm ${style.className}`}>
          <span className="num ml-1.5 text-[10px] text-ink-faint" aria-hidden="true">
            {style.mark}
          </span>
          {point.title}
        </h3>
        <span className="shrink-0 text-[10px] text-ink-faint">{point.source}</span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{point.body}</p>
    </article>
  );
}

export function ThesisPanel({ thesis }: { thesis: Thesis }) {
  const ordered: ThesisPoint["kind"][] = ["concern", "strength", "watch"];
  const groups = ordered
    .map((kind) => ({
      kind,
      label: KIND_STYLE[kind].label,
      points: thesis.points.filter((p) => p.kind === kind),
    }))
    .filter((group) => group.points.length > 0);

  return (
    <section className="reveal">
      <div className="panel overflow-hidden">
        <div className="h-0.5 w-full" style={{ background: "var(--accent)" }} aria-hidden="true" />

        <div className="p-5">
          <p className="text-[11px] tracking-wide text-ink-faint">השורה התחתונה</p>
          <h2 className="mt-1.5 text-xl">{thesis.headline}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink">
            {thesis.bottomLine}
          </p>

          {thesis.tension && (
            <div className="accent-chip mt-4 rounded-xl px-4 py-3">
              <p className="text-[11px] tracking-wide opacity-80">
                המסגרות לא מסכימות
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink">
                {thesis.tension}
              </p>
            </div>
          )}
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.kind} className="mt-5">
          <h3 className="mb-3 text-[11px] tracking-wide text-ink-faint">
            {group.label}
            <span className="num mr-1.5">({group.points.length})</span>
          </h3>
          <div className="stagger grid gap-3 md:grid-cols-2">
            {group.points.map((point) => (
              <PointCard key={point.title} point={point} />
            ))}
          </div>
        </div>
      ))}

      {thesis.unknowns.length > 0 && (
        <div className="panel mt-5 p-4">
          <h3 className="text-[11px] tracking-wide text-ink-faint">
            מה הנתונים לא יכולים לומר
          </h3>
          <ul className="mt-2 space-y-1.5">
            {thesis.unknowns.map((unknown) => (
              <li
                key={unknown}
                className="text-[12px] leading-relaxed text-ink-muted"
              >
                — {unknown}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
