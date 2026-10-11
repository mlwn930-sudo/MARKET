import { DIRECTION_NAME, HORIZON_NAME } from "@/lib/analysis/stance";
import type { ChartStance } from "@/lib/analysis/stance";

/**
 * The direction, in four lines instead of a panel.
 *
 * `StancePanel` on the chart reader is 1,378 pixels tall: two horizons,
 * five quantiles, a route, the caveats. That is right for one chart
 * somebody has stopped to study, and wrong for a list of holdings being
 * scanned — where the only question is which of these names has anything
 * true today.
 *
 * So this prints, per horizon that has a direction: which way the record
 * leans, the one count behind it, the single strongest thing arguing the
 * other way, and the event that would end it. The rest is a click away,
 * and both places call the same function, so they cannot disagree.
 *
 * WHY IT BELONGS ON THE WATCHLIST AT ALL. Every input — the setup, the
 * base rates, the rank, the candles — was already being loaded for each
 * followed company. The direction was computed only for somebody who
 * uploaded a screenshot of a chart they were already looking at. Opening
 * a watchlist is when the question is actually asked.
 *
 * NOTHING FIRING IS THE NORMAL ANSWER. On the measured universe, ten
 * names in a hundred and twenty-three produce a direction at all, so the
 * quiet case gets a sentence rather than an empty box — and the sentence
 * says it is a measurement rather than a gap.
 */
export function StanceLine({ stance }: { stance: ChartStance }) {
  const rows = [stance.swing, stance.position].filter(
    (h) => h.direction !== "none",
  );

  if (rows.length === 0) {
    return (
      <p className="cover-quiet">
        אין תנאי נמדד שפעל בנר האחרון, בשני האופקים. רוב הימים אינם אירוע —
        זו המדידה ולא חוסר.
      </p>
    );
  }

  return (
    <div className="cover-stance">
      {rows.map((h) => {
        const lead = h.agreeing[0];
        const counter = h.against[0];
        const ends = h.route.find((r) => r.kind === "end");
        const sign = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v)}`;

        return (
          <div key={h.horizon} className="cover-stance-row">
            <span className="cover-stance-head">
              {HORIZON_NAME[h.horizon]} · {DIRECTION_NAME[h.direction]}
            </span>

            {/* The rate never appears without its baseline. The whole
                file is built on the finding that a conditional rate
                alone describes the stock's drift, not the signal. */}
            {lead && (
              <span className="cover-stance-why">
                {lead.label} —{" "}
                <span className="num" dir="ltr">
                  {Math.round(lead.upShareHist * 100)}%
                </span>{" "}
                מול בסיס{" "}
                <span className="num" dir="ltr">
                  {Math.round(lead.baselineUpShare * 100)}%
                </span>{" "}
                <span className="num" dir="ltr">
                  ({sign(lead.liftPp)} נק׳, n={lead.n})
                </span>
              </span>
            )}

            {/* Never optional. A direction with no counter-column reads
                as an endorsement, and on this data there is always
                something pulling the other way. */}
            {counter && <span className="cover-stance-against">{counter}</span>}

            {ends && (
              <span className="cover-stance-ends">מסתיים אם: {ends.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
