import { isPrivateBuild, PRIVATE_NOTE } from "@/lib/private-mode";
import {
  buildChartStance,
  quantileRows,
  directionLabel,
  HORIZON_NAME,
  HORIZON_SPAN,
} from "@/lib/analysis/stance";
import { ROUTE_KIND_NAME } from "@/lib/analysis/stance";
import type { ConditionCite, HorizonStance } from "@/lib/analysis/stance";
import type { Corroboration } from "@/lib/analysis/chart-corroborate";

/**
 * Which way the counted record leans, for two horizons.
 *
 * The private build's one addition, and the only panel on the site that
 * states a direction. It renders nothing in a public build.
 *
 * NOT BY DEAD-CODE ELIMINATION, which is what the first version of this
 * comment claimed before anyone looked. `isPrivateBuild()` is a call into
 * another module, so no bundler can fold it: the compiled output is
 * `return "1" === env.NEXT_PUBLIC_PRIVATE_MODE`, and the Hebrew below
 * ships inside the public bundle as code that never runs. Measured by
 * grepping the built chunks, not assumed.
 *
 * What IS guaranteed, and was checked the same way: the value is baked at
 * build time, so a public deployment serves the public copy and changing
 * the variable in a dashboard without rebuilding does nothing at all.
 *
 * THE EMPTY STATE IS THE DEFAULT AND WAS BUILT FIRST. Run the engine's
 * rule over all 123 names in the research universe and ten of them
 * produce a direction. So the layout below is designed around "no
 * counted condition fired", with the unconditional baseline in its
 * place, and the directional case is the exception that slots into the
 * same frame. Designing it the other way round produces a panel that
 * looks broken four days in five, which is a panel that gets loosened
 * until something lights up.
 *
 * WHAT IS DELIBERATELY ABSENT: a score, a single implied price, and a
 * blended probability. `stance.ts` explains each; the one that matters
 * here is the price. A median rendered alone reads as a target however
 * it is labelled, so the five quantiles are rendered together and the
 * two that describe what went wrong carry `emphasis`. The dip is never
 * smaller or quieter than the move — a panel can mislead by composition
 * while every number in it is correct.
 */

const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
const share = (v: number) => `${Math.round(v * 100)}%`;

/** The count, in words with its samples. Never an integer on a scale:
 *  two of the four levels of the score this replaced never occurred in
 *  the whole universe, and a scale with dead levels gets relaxed until
 *  they light up. */
function countedIn(stance: HorizonStance): string {
  const { agreeing } = stance;
  /* THE HEADING ABOVE THIS HAS ALREADY SAID IT.
     With nothing counted, `directionLabel` prints "the structure leans
     down — with no counted record", and this line used to follow it
     with "no measured condition fired on the last bar", which is the
     same fact in different words. Two restatements of an absence,
     stacked, before the panel has said anything a reader can use. */
  if (agreeing.length === 0) return "";
  if (agreeing.length === 1) {
    return `תנאי נמדד אחד פעל (n=${agreeing[0].n})`;
  }
  return `${agreeing.length} תנאים נמדדים פעלו (${agreeing
    .map((c) => `n=${c.n}`)
    .join(", ")})`;
}

function Prices({ cite, lastClose }: { cite: ConditionCite; lastClose: number }) {
  const rows = quantileRows(cite, lastClose);
  return (
    <div className="mt-3">
      <p className="read-watch-note">
        חמשת המספרים של {cite.label}, על {cite.n} מופעים — לא יעד ולא סטופ.
        כל אחד הוא רבעון בהתפלגות של מה שכבר קרה.
      </p>
      <div className="grid gap-px overflow-hidden rounded border border-line bg-line">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-wrap items-baseline justify-between gap-x-3 bg-surface px-3 py-2"
          >
            <span
              className={`text-[12px] ${
                row.emphasis ? "text-ink" : "text-ink-muted"
              }`}
            >
              {row.label}
            </span>
            <span className="flex items-baseline gap-2">
              <span
                className={`num text-[14px] ${
                  row.emphasis ? "text-ink" : "text-ink-muted"
                }`}
                dir="ltr"
              >
                {pct(row.percent)}
              </span>
              <span className="num text-[14px] text-ink" dir="ltr">
                {row.price.toFixed(2)}
              </span>
              {row.baselinePercent !== null && (
                <span className="num text-[11px] text-ink-faint" dir="ltr">
                  {`בסיס ${pct(row.baselinePercent)}`}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Horizon({ stance }: { stance: HorizonStance }) {
  const best = stance.agreeing.find((c) => c.key === stance.bestKey) ?? null;

  return (
    <div className="border-t border-line pt-4 first:border-t-0 first:pt-0 sm:border-t-0 sm:border-s sm:ps-5 sm:pt-0 sm:first:border-s-0 sm:first:ps-0">
      <span className="block text-[11px] tracking-[0.06em] text-ink-ghost">
        {HORIZON_NAME[stance.horizon]} · {HORIZON_SPAN[stance.horizon]}
      </span>

      <p className="mt-1 text-[15px] font-semibold text-ink">
        {directionLabel(stance)}
      </p>
      {countedIn(stance) && (
        <p className="num mt-0.5 text-[12px] text-ink-faint">
          {countedIn(stance)}
        </p>
      )}

      {/* The sentence the engine writes so its strength matches its
          evidence — three different sentences for a counted lean, a
          structural one and none at all. It was being written and
          printed nowhere, which left the heading above to carry the
          whole claim on its own and left a reader to infer how much
          was behind it. */}
      <p className="mt-2 text-[13px] leading-relaxed text-ink">
        {stance.verdict}
      </p>

      {/* And the question a person actually brings to a chart. The
          panel had every ingredient of the answer — the rate, the
          drawdown, the events still to come — and never said which
          window had already started. */}
      <p className="read-watch-note mt-2">{stance.timing}</p>

      {/* The unconditional record, always. When nothing fired it is the
          only number there is; when something did, it is what the
          conditional rate has to be read against. */}
      {stance.baseline && (
        <p className="read-watch-note mt-2">
          יום שרירותי על הנייר הזה באותו חלון:{" "}
          <span className="num" dir="ltr">
            {share(stance.baseline.upShare)}
          </span>{" "}
          סגרו גבוה יותר, תנועה חציונית{" "}
          <span className="num" dir="ltr">
            {pct(stance.baseline.medianPct)}
          </span>
          {stance.baseline.adversePct !== null && (
            <>
              , ירידה חציונית בדרך{" "}
              <span className="num" dir="ltr">
                {pct(stance.baseline.adversePct)}
              </span>
            </>
          )}
          .
        </p>
      )}

      <ul className="mt-3">
        {stance.because.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      {best && <Prices cite={best} lastClose={stance.lastClose} />}

      {stance.against.length > 0 && (
        <div className="read-block mt-4" data-tone="conflict">
          <h3>מה מושך לכיוון השני</h3>
          <ul>
            {stance.against.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {/* THE ROUTE, BEFORE THE TWO LISTS IT IS MADE OF.

          Asked for as a route, and the honest version is a sequence of
          checkable states: what is true, what would add to it, what
          ends it, when it expires. Every row is an observable close,
          so the whole thing can be scored afterwards rather than
          remembered favourably. There is no step that says to buy. */}
      {stance.route.length > 0 && (
        <ol className="mt-4 grid gap-px overflow-hidden rounded border border-line bg-line">
          {stance.route.map((s) => (
            <li key={s.order} className="bg-surface px-3 py-2">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="num text-[11px] text-ink-ghost">{s.order}</span>
                <span
                  className={`text-[10px] tracking-[0.06em] ${
                    s.kind === "end" || s.kind === "expires"
                      ? "text-ink"
                      : "text-ink-ghost"
                  }`}
                >
                  {ROUTE_KIND_NAME[s.kind]}
                </span>
                <span className="text-[13px] text-ink">{s.label}</span>
              </span>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-faint">
                {s.detail}
              </span>
            </li>
          ))}
        </ol>
      )}

      {/* ONLY WHEN THE ROUTE DID NOT ALREADY SAY IT.

          The route is built from `agreeing` and `invalidation` put in
          order, so rendering both printed every refutation twice and
          made the panel 3,500 pixels tall. Seen by looking at it, not
          by reading the code: the two blocks are assembled in different
          functions and neither knows about the other. */}
      {stance.route.length === 0 && (
        <div className="read-block mt-4" data-tone="invalidation">
          <h3>מה יפריך את זה</h3>
          <ul>
            {stance.invalidation.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {/* The notes that are NOT already in the counter-column above.
          `against` pulls in every structural observation that opposes
          the direction, and listing them again under "context" said the
          same sentence twice in one panel. */}
      {(() => {
        const shown = new Set(stance.against);
        const rest = stance.structure.filter(
          (s) => !shown.has(`${s.label} (${s.detail})`),
        );
        if (rest.length === 0) return null;
        return (
          <p className="read-watch-note mt-4">
            הקשר מהמבנה, שלא נספר ולא נכנס לכיוון:{" "}
            {rest.map((s) => s.label).join(" · ")}.
          </p>
        );
      })()}

      <p className="read-watch-note mt-3">{stance.basis}</p>
    </div>
  );
}

export function StancePanel({ checked }: { checked: Corroboration }) {
  if (!isPrivateBuild()) return null;

  const stance = buildChartStance({
    setup: checked.setup,
    baseRates: checked.baseRates,
    lastClose: checked.lastClose,
  });

  /* No base rates means the ticker is outside the research universe and
     the site has counted nothing about it. `ChartScenarios` already says
     so for the same reason; saying it twice on one page is noise, so
     this renders nothing and lets that panel carry it. */
  if (!stance) return null;

  return (
    <section className="read-block">
      <h3>
        לאן הרשומה נוטה
        <span className="read-check-sym num" dir="ltr">
          {stance.symbol}
        </span>
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <Horizon stance={stance.swing} />
        <Horizon stance={stance.position} />
      </div>

      {/* FOLDED, NOT DROPPED.
          Eight paragraphs of methodology, identical on every chart,
          printed in full under every answer. Each one is true and the
          set is the reason this panel can be trusted — and a reader who
          meets the same eight walls every time stops reading all of
          them, including the one that matters for the chart in front of
          them. The count is on the summary so nothing is hidden, and a
          `details` element needs no JavaScript and no state. */}
      {(() => {
        const caveats = [
          ...new Set([...stance.swing.caveats, ...stance.position.caveats]),
        ];
        if (caveats.length === 0) return null;
        return (
          <details className="stance-caveats mt-5">
            <summary>
              איך לקרוא את המספרים האלה — {caveats.length} הסתייגויות
            </summary>
            <ul data-tone="missing">
              {caveats.map((line) => (
                <li key={line} className="text-[12px] text-ink-faint">
                  {line}
                </li>
              ))}
            </ul>
          </details>
        );
      })()}

      <p className="setup-measured mt-3">{PRIVATE_NOTE}</p>
    </section>
  );
}
