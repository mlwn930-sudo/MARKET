import type { TechnicalRead } from "@/lib/metrics/technical";
import { fmtPrice } from "@/lib/format";

/**
 * The technical frameworks, shown as their working rather than as a score.
 *
 * Three choices here are worth explaining, because each of them costs space
 * and each is the reason the surface is worth having.
 *
 * The trend template is listed criterion by criterion with its measurement
 * beside it. "Six of eight" is a number a reader can neither check nor use;
 * "everything met except that the stock sits 31% below its high" is a fact
 * they can weigh against what they already know.
 *
 * The contractions are drawn as bars, at the depth they actually occurred.
 * The entire claim of the pattern is that the pullbacks are getting
 * shallower, and a row of numbers hides the one thing the reader needs to
 * see to judge whether that claim is true.
 *
 * The risk arithmetic leads with the stop, not the target. That is the
 * framework's own discipline and reversing it is how a 3% risk becomes a
 * 15% loss: decide where you are wrong first, and let the reward follow
 * from it.
 */

function Check({
  pass,
  label,
  detail,
}: {
  pass: boolean | null;
  label: string;
  detail: string;
}) {
  const mark = pass === null ? "–" : pass ? "✓" : "✕";

  return (
    <li className="flex items-start justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <span className="flex items-start gap-2">
        <span
          className={`num mt-px text-xs ${
            pass === null ? "text-ink-faint" : pass ? "text-ink" : "text-ink-faint"
          }`}
          aria-hidden="true"
        >
          {mark}
        </span>
        <span className={`text-[13px] ${pass ? "text-ink" : "text-ink-muted"}`}>
          {label}
        </span>
      </span>
      <span className="num shrink-0 text-[11px] text-ink-faint">{detail}</span>
    </li>
  );
}

export function TechnicalPanel({
  technical,
  currency = "$",
}: {
  technical: TechnicalRead;
  currency?: string;
}) {
  const { stage, template, vcp, volume, risk, relative, averages } = technical;

  const deepest =
    vcp.contractions.length > 0
      ? Math.max(...vcp.contractions.map((c) => c.depthPercent))
      : 0;

  return (
    <section className="enter">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base">קריאה טכנית</h2>
        <p className="text-[11px] text-ink-faint">{technical.headline}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---- Stage and averages ---- */}
        <div className="surface border-s-2 border-accent p-4">
          <h3 className="text-sm">{stage.label}</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
            {stage.note}
          </p>
          {stage.daysInStage !== null && (
            <p className="mt-2 text-[11px] text-ink-faint">
              נמשך <span className="num">{stage.daysInStage}</span> ימי מסחר
            </p>
          )}

          <div className="mt-4 grid grid-cols-4 gap-2">
            {averages.map((average) => (
              <div key={average.period} className="rounded-lg bg-surface px-2 py-2">
                <div className="num text-[10px] text-ink-faint">
                  MA{average.period}
                </div>
                <div className="num mt-0.5 text-[13px]">
                  {average.value === null ? "—" : `${currency}${fmtPrice(average.value)}`}
                </div>
              </div>
            ))}
          </div>

          {relative && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-[11px] text-ink-faint">מול S&amp;P 500, בנקודות אחוז</p>
              <div className="mt-1.5 flex gap-4">
                {[
                  { label: "חודש", value: relative.oneMonth },
                  { label: "3 חודשים", value: relative.threeMonth },
                  { label: "6 חודשים", value: relative.sixMonth },
                ].map((window) => (
                  <div key={window.label}>
                    <div className="text-[10px] text-ink-faint">{window.label}</div>
                    <div className="num text-[13px]">
                      {window.value === null
                        ? "—"
                        : `${window.value >= 0 ? "+" : "−"}${Math.abs(window.value).toFixed(1)}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ---- Trend template ---- */}
        <div className="surface p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm">תבנית המגמה</h3>
            <span className="num text-[11px] text-ink-faint">
              {template.passed}/{template.evaluated}
            </span>
          </div>
          <ul className="mt-2">
            {template.checks.map((check) => (
              <Check
                key={check.key}
                pass={check.pass}
                label={check.label}
                detail={check.detail}
              />
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
            הקריטריון האחרון הוא תשואה עודפת מול המדד, ולא דירוג כוח יחסי —
            דירוג אמיתי דורש השוואה לכל מניות השוק, ויקום ההשוואה של האתר
            כולל 48 חברות בלבד.
          </p>
        </div>
      </div>

      {/* ---- Contraction pattern ---- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="surface p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm">התכווצות תנודתיות</h3>
            <span className="text-[11px] text-ink-faint">
              {vcp.verdict === "tight"
                ? "מהודק"
                : vcp.verdict === "forming"
                  ? "בבנייה"
                  : vcp.verdict === "loose"
                    ? "נפתח"
                    : "לא זוהה"}
            </span>
          </div>

          {vcp.contractions.length > 0 ? (
            <div className="mt-3 space-y-2">
              {vcp.contractions.map((contraction, i) => (
                <div key={contraction.lowDate} className="flex items-center gap-3">
                  <span className="num w-4 shrink-0 text-[10px] text-ink-faint">
                    {i + 1}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-overlay">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${deepest > 0 ? (contraction.depthPercent / deepest) * 100 : 0}%`,
                        background: "var(--color-measure)",
                        opacity: 0.35 + (i / Math.max(1, vcp.contractions.length)) * 0.5,
                      }}
                    />
                  </div>
                  <span className="num w-12 shrink-0 text-left text-[11px] text-ink">
                    {contraction.depthPercent.toFixed(1)}%
                  </span>
                  <span className="num w-16 shrink-0 text-left text-[10px] text-ink-faint">
                    {contraction.lowDate.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">{vcp.note}</p>

          {vcp.pivot !== null && (
            <p className="mt-2 text-[11px] text-ink-faint">
              רמת ייחוס{" "}
              <span className="num text-ink">
                {currency}
                {fmtPrice(vcp.pivot)}
              </span>
              {vcp.toPivotPercent !== null && (
                <>
                  {" · "}
                  <span className="num">
                    {vcp.toPivotPercent > 0
                      ? `${vcp.toPivotPercent.toFixed(1)}% מעל המחיר`
                      : `${Math.abs(vcp.toPivotPercent).toFixed(1)}% מתחת למחיר`}
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        {/* ---- Volume and risk ---- */}
        <div className="surface p-4">
          <h3 className="text-sm">מחזורים וסיכון</h3>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
            {volume.note}
          </p>

          {risk ? (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-[11px] text-ink-faint">
                חשבון הסיכון של המסגרת, סביב רמת הייחוס
              </p>

              <dl className="mt-2 space-y-1.5 text-[12px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">עצירה</dt>
                  <dd className="num text-ink">
                    {currency}
                    {fmtPrice(risk.stop)}
                    <span className="text-ink-faint"> · {risk.stopReason}</span>
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">סיכון</dt>
                  <dd className="num text-ink">{risk.riskPercent.toFixed(1)}%</dd>
                </div>
                {risk.targets.map((target) => (
                  <div key={target.multiple} className="flex justify-between gap-3">
                    <dt className="text-ink-muted">
                      יעד <span className="num">{target.multiple}R</span>
                    </dt>
                    <dd className="num text-ink">
                      {currency}
                      {fmtPrice(target.price)}
                      <span className="text-ink-faint">
                        {" "}
                        · +{(risk.riskPercent * target.multiple).toFixed(1)}%
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
                {risk.note}
              </p>
            </div>
          ) : (
            <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-faint">
              אין רמת ייחוס שניתן לבנות סביבה חשבון סיכון — התבנית לא זוהתה.
            </p>
          )}
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
        כל המספרים כאן מתארים את מה שהמחיר כבר עשה. המסגרות האלה אינן חוזות
        תנועה עתידית, והרמות המוצגות הן חשבון אריתמטי על הכללים שלהן — לא
        המלצה להיכנס, לצאת או להחזיק.
      </p>
    </section>
  );
}
