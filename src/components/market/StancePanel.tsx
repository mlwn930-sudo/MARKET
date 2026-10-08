import { isPrivateBuild, PRIVATE_NOTE } from "@/lib/private-mode";
import {
  buildChartStance,
  quantileRows,
  DIRECTION_NAME,
  HORIZON_NAME,
  HORIZON_SPAN,
} from "@/lib/analysis/stance";
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
  if (agreeing.length === 0) return "אין תנאי נמדד שפעל בנר האחרון";
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
        {DIRECTION_NAME[stance.direction]}
      </p>
      <p className="num mt-0.5 text-[12px] text-ink-faint">
        {countedIn(stance)}
      </p>

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

      <div className="read-block mt-4" data-tone="invalidation">
        <h3>מה יפריך את זה</h3>
        <ul>
          {stance.invalidation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      {stance.structure.length > 0 && (
        <p className="read-watch-note mt-4">
          הקשר מהמבנה, שלא נספר ולא נכנס לכיוון:{" "}
          {stance.structure.map((s) => s.label).join(" · ")}.
        </p>
      )}

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

      {/* Both horizons' caveats, deduplicated — they overlap almost
          entirely, and printing each twice is how a reader learns to
          skip them. */}
      <ul className="mt-5" data-tone="missing">
        {[...new Set([...stance.swing.caveats, ...stance.position.caveats])].map(
          (line) => (
            <li key={line} className="text-[12px] text-ink-faint">
              {line}
            </li>
          ),
        )}
      </ul>

      <p className="setup-measured mt-3">{PRIVATE_NOTE}</p>
    </section>
  );
}
