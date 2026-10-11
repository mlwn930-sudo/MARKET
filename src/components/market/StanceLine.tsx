import { HORIZON_NAME, directionLabel } from "@/lib/analysis/stance";
import { isPrivateBuild } from "@/lib/private-mode";
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
  /* THE SWITCH HAS TO COVER THIS TOO, AND IT DID NOT.
     `StancePanel` returns null in a public build and this did not, so
     the one env var that was supposed to remove every stated direction
     from the site before it is opened to other people would have left
     them on the watchlist — the one page a visitor with a list of names
     would actually be on. The flag was tested on the chart reader,
     where it was written, and the second surface was added later
     without it. Gated here rather than at the call site, the same way
     `StancePanel` does it, so a third surface cannot repeat this by
     forgetting a wrapper.

     The alert mail is deliberately NOT gated and is not an exception to
     this: it has one recipient, `ALERT_OWNER_EMAIL`, and gating it
     would take the direction out of the owner's own inbox while
     removing it from nowhere a visitor can reach. */
  if (!isPrivateBuild()) return null;

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
              {HORIZON_NAME[h.horizon]} · {directionLabel(h)}
            </span>

            {/* WHAT THE LEAN IS MADE OF, in the structural case.
                A counted lean has the rate line below. A structural one
                had nothing, so the row was a direction with no evidence
                under it — which is the shape this project exists to
                refuse. The notes are what the lean is actually resting
                on, so they are what gets printed. */}
            {!lead && h.structure.length > 0 && (
              <span className="cover-stance-why">
                {h.structure
                  .slice(0, 3)
                  .map((note) => note.label)
                  .join(" · ")}
              </span>
            )}

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
