import type { CapitalQuality } from "@/lib/metrics/capital";
import { Gauge } from "./Gauge";
import { fmtCompact } from "@/lib/format";

/**
 * The quality of the earnings, as opposed to their size.
 *
 * Four questions a ratio table does not answer: does the return clear the
 * cost of the capital, what does the profit cost in ownership, how long is
 * cash tied up, and where does it go once it arrives.
 *
 * The cost-of-capital block prints its own assumptions underneath it. That
 * is not a disclaimer in the legal sense — it is the most important part of
 * the number. A WACC is four estimates multiplied together, and a reader who
 * cannot see that the equity risk premium was assumed at 5% has no way to
 * know how much weight the spread can carry.
 */

const number = (value: number | null, digits = 1, suffix = "") =>
  value === null ? "—" : `${value.toFixed(digits)}${suffix}`;

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <span className="text-[13px] text-ink-muted">
        {label}
        {hint && <span className="mr-1.5 text-[10px] text-ink-faint">{hint}</span>}
      </span>
      <span className="num shrink-0 text-[13px] text-ink">{value}</span>
    </div>
  );
}

export function CapitalPanel({ capital }: { capital: CapitalQuality }) {
  const { costOfCapital, stockComp, cashCycle, leverage, allocation, unitEconomics } =
    capital;

  // The spread bar is drawn against a fixed 30-point scale rather than
  // against the larger of the two values. A scale that rescales itself makes
  // a two-point spread and a twenty-point spread look identical, which is
  // the opposite of the surface's purpose.
  const SCALE = 30;
  const barWidth = (value: number | null) =>
    value === null ? 0 : Math.min(Math.abs(value) / SCALE, 1) * 100;

  // The cost-of-capital figures are fractions; everything on screen is a
  // percentage. Converted once here so the dials and the bars below cannot
  // end up on different scales.
  const roicPercent =
    costOfCapital.roic === null ? null : costOfCapital.roic * 100;
  const waccPercent =
    costOfCapital.wacc === null ? null : costOfCapital.wacc * 100;

  return (
    <section className="enter">
      <h2 className="mb-3 text-base">איכות הרווח</h2>

      {/* ---- The three dials ---- */}
      <div className="stagger mb-4 grid gap-3 sm:grid-cols-3">
        <Gauge
          label="ROIC מול WACC"
          value={roicPercent}
          reference={waccPercent}
          referenceLabel={
            waccPercent === null ? undefined : `WACC ${waccPercent.toFixed(1)}%`
          }
          min={0}
          max={40}
          display={number(roicPercent, 1, "%")}
          bands={[
            { from: 0, to: 8, color: "#e24b4a" },
            { from: 8, to: 15, color: "#f59e0b" },
            { from: 15, to: 40, color: "#1baf7a" },
          ]}
          meaning={
            costOfCapital.spread === null
              ? "לא ניתן לחשב את המרווח."
              : costOfCapital.spread > 2
                ? `מרווח חיובי של ${costOfCapital.spread.toFixed(1)} נקודות — כל דולר מושקע מחזיר יותר ממה שהוא עולה.`
                : costOfCapital.spread < -2
                  ? `מרווח שלילי של ${Math.abs(costOfCapital.spread).toFixed(1)} נקודות — צמיחה כאן הורסת ערך.`
                  : "התשואה מכסה את עלות ההון וכמעט לא מעבר."
          }
        />

        <Gauge
          label="מחזור המרת מזומנים"
          value={cashCycle.cycle}
          min={-60}
          max={180}
          display={
            cashCycle.cycle === null ? "—" : `${cashCycle.cycle.toFixed(0)}d`
          }
          bands={[
            { from: -60, to: 0, color: "#1baf7a" },
            { from: 0, to: 90, color: "#f59e0b" },
            { from: 90, to: 180, color: "#e24b4a" },
          ]}
          meaning={
            cashCycle.financedBySuppliers
              ? "מחזור שלילי — הלקוחות משלמים לפני הספקים, וצמיחה מייצרת מזומן."
              : cashCycle.cycle === null
                ? "הדוחות אינם כוללים את כל הרכיבים."
                : `כל דולר כבול ${Math.round(cashCycle.cycle)} ימים. ככל שגבוה יותר, צמיחה דורשת יותר הון חוזר.`
          }
        />

        <Gauge
          label="תגמול במניות מתוך FCF"
          value={stockComp.shareOfFcf}
          min={0}
          max={60}
          display={number(stockComp.shareOfFcf, 0, "%")}
          bands={[
            { from: 0, to: 15, color: "#1baf7a" },
            { from: 15, to: 30, color: "#f59e0b" },
            { from: 30, to: 60, color: "#e24b4a" },
          ]}
          meaning={
            stockComp.shareOfFcf === null
              ? "התגמול במניות אינו מדווח בנפרד."
              : stockComp.verdict === "diluting"
                ? "ספירת המניות עולה — העלות מגולגלת לבעלי המניות בדילול."
                : stockComp.verdict === "creating"
                  ? "ספירת המניות יורדת בפועל — הרכישות גדולות מההנפקה."
                  : "הרכישות העצמיות בעיקר סופגות את ההנפקה לעובדים."
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---- ROIC against WACC ---- */}
        <div className="surface border-s-2 border-accent p-4">
          <h3 className="text-sm">תשואה על ההון מול עלות ההון</h3>

          <div className="mt-4 space-y-3">
            <div>
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="text-ink-muted">ROIC</span>
                <span className="num text-ink">
                  {number(roicPercent, 1, "%")}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-overlay">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${barWidth(roicPercent)}%`,
                    background: "var(--color-measure)",
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="text-ink-muted">WACC</span>
                <span className="num text-ink">
                  {number(waccPercent, 1, "%")}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-overlay">
                <div
                  className="h-full rounded-full bg-ink-faint"
                  style={{ width: `${barWidth(waccPercent)}%` }}
                />
              </div>
            </div>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-ink">
            {costOfCapital.note}
          </p>

          <details className="mt-3">
            <summary className="cursor-pointer text-[11px] text-ink-faint hover:text-ink-muted">
              על מה החישוב מבוסס
            </summary>
            <ul className="mt-2 space-y-1">
              {costOfCapital.assumptions.map((assumption) => (
                <li key={assumption} className="text-[11px] leading-relaxed text-ink-faint">
                  — {assumption}
                </li>
              ))}
            </ul>
          </details>
        </div>

        {/* ---- Stock-based compensation ---- */}
        <div className="surface p-4">
          <h3 className="text-sm">תגמול במניות מול תזרים</h3>

          <div className="mt-2">
            <Row
              label="תגמול במניות"
              value={stockComp.expense === null ? "—" : `$${fmtCompact(stockComp.expense)}`}
            />
            <Row
              label="כאחוז מההכנסות"
              value={number(stockComp.shareOfRevenue, 1, "%")}
            />
            <Row
              label="כאחוז מהתזרים החופשי"
              value={number(stockComp.shareOfFcf, 0, "%")}
            />
            <Row
              label="FCF בניכוי התגמול"
              value={
                stockComp.fcfAfterComp === null
                  ? "—"
                  : `$${fmtCompact(stockComp.fcfAfterComp)}`
              }
              hint="התזרים אחרי שהעלות נספרת"
            />
            <Row
              label="שינוי בספירת המניות"
              value={
                stockComp.shareCountChange === null
                  ? "—"
                  : `${stockComp.shareCountChange > 0 ? "+" : "−"}${Math.abs(stockComp.shareCountChange).toFixed(1)}%`
              }
              hint="3 שנים"
            />
          </div>

          <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
            {stockComp.note}
          </p>
        </div>

        {/* ---- Cash cycle ---- */}
        <div className="surface p-4">
          <h3 className="text-sm">מחזור המרת המזומנים</h3>

          <div className="mt-2">
            <Row
              label="ימי גבייה"
              value={number(cashCycle.daysSalesOutstanding, 0)}
              hint="DSO"
            />
            <Row
              label="ימי מלאי"
              value={
                cashCycle.daysInventoryOutstanding === null
                  ? "אין מלאי"
                  : cashCycle.daysInventoryOutstanding.toFixed(0)
              }
              hint="DIO"
            />
            <Row
              label="ימי תשלום לספקים"
              value={number(cashCycle.daysPayablesOutstanding, 0)}
              hint="DPO"
            />
            <Row
              label="מחזור כולל"
              value={cashCycle.cycle === null ? "—" : `${cashCycle.cycle.toFixed(0)} ימים`}
              hint="CCC"
            />
          </div>

          <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
            {cashCycle.note}
          </p>
        </div>

        {/* ---- Operating leverage ----
             Called a signal, not a margin, and the distinction is the
             point. The reading is a change measured between two fiscal
             years; presenting it as "X cents of every additional dollar"
             implied a cost function the filings do not contain, and when
             the base year was a loss it produced readings over 400% that
             described an economy that does not exist. */}
        <div className="surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm">אות מינוף תפעולי</h3>
            {!leverage.meaningful && leverage.incrementalMargin !== null && (
              <span
                className="badge"
                style={{ color: "var(--color-warning)" }}
                title="היחס חושב אך אינו מתאר מרווח"
              >
                לא מוצג כמרווח
              </span>
            )}
          </div>

          <div className="mt-2">
            <Row
              label="מרווח תפעולי נוכחי"
              value={number(leverage.currentMargin, 1, "%")}
              hint="מדווח"
            />
            {/* The incremental reading is only shown as a margin when it
                can be one. Otherwise the row says so rather than printing
                a number the reader would have to know to distrust. */}
            <Row
              label="מרווח על ההכנסה שנוספה"
              value={
                leverage.meaningful
                  ? number(leverage.incrementalMargin, 1, "%")
                  : "לא ישים"
              }
              hint={
                leverage.periods
                  ? `${leverage.periods.from} ← ${leverage.periods.to}`
                  : undefined
              }
            />
            {leverage.meaningful && (
              <Row
                label="אותו מדד שנה קודם"
                value={number(leverage.previousIncrementalMargin, 1, "%")}
              />
            )}
          </div>

          <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
            {leverage.note}
          </p>

          <details className="group mt-3 border-t border-line pt-2.5">
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-[11px] text-ink-ghost transition-colors hover:text-ink-muted">
              <span>הנוסחה, התקופות והמגבלות</span>
              <span
                className="transition-transform group-open:rotate-180"
                aria-hidden="true"
              >
                ▾
              </span>
            </summary>

            <div className="mt-2.5 space-y-2.5">
              <div>
                <p className="eyebrow mb-1">נוסחה</p>
                <p className="text-[11px] leading-relaxed text-ink-faint">
                  {leverage.formula}
                </p>
              </div>

              {leverage.periods && (
                <div>
                  <p className="eyebrow mb-1">נמדד בין</p>
                  <p className="num text-[11px] text-ink-faint">
                    {leverage.periods.from} ← {leverage.periods.to}
                  </p>
                </div>
              )}

              <div>
                <p className="eyebrow mb-1">מה זה לא אומר</p>
                <ul className="space-y-1.5">
                  {leverage.limits.map((limit, index) => (
                    <li
                      key={`${index}-${limit.slice(0, 16)}`}
                      className="text-[11px] leading-relaxed text-ink-ghost"
                    >
                      — {limit}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </details>
        </div>
      </div>

      {/* ---- Capital allocation ---- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="surface p-4">
          <h3 className="text-sm">לאן הולך התזרים</h3>
          <p className="mt-1 text-[11px] text-ink-faint">
            סך שלוש השנים האחרונות, כאחוז מהתזרים התפעולי
          </p>

          {allocation.allocations.length > 0 ? (
            <div className="mt-3 space-y-2">
              {allocation.allocations.map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-[12px] text-ink-muted">
                    {row.label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-overlay">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(row.share, 100)}%`,
                        background: "var(--color-measure)",
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="num w-10 shrink-0 text-left text-[11px] text-ink">
                    {row.share.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
            {allocation.note}
          </p>
        </div>

        {/* ---- Unit economics ---- */}
        <div className="surface p-4">
          <h3 className="text-sm">יחידת כלכלה</h3>

          <div className="mt-2">
            <Row
              label="מחקר ופיתוח מההכנסות"
              value={number(unitEconomics.researchShare, 1, "%")}
            />
            <Row
              label="מכירה ושיווק מההכנסות"
              value={number(unitEconomics.marketingShare, 1, "%")}
            />
            <Row
              label="רווח גולמי לכל דולר שיווק"
              value={number(unitEconomics.grossProfitPerMarketingDollar, 2, "$")}
            />
            <Row
              label="שינוי בהכנסה נדחית"
              value={
                unitEconomics.deferredGrowth === null
                  ? "—"
                  : `${unitEconomics.deferredGrowth > 0 ? "+" : "−"}${Math.abs(unitEconomics.deferredGrowth).toFixed(0)}%`
              }
              hint="מדד מקדים להזמנות"
            />
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
            {unitEconomics.caveat}
          </p>
        </div>
      </div>
    </section>
  );
}
