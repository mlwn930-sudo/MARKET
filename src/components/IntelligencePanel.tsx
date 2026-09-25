import {
  CONFIDENCE_LABELS,
  MATRIX_LABELS,
  THESIS_LABELS,
  type CompanyIntelligence,
} from "@/lib/agents";
import { Section } from "./ui";

/**
 * The Investment Thesis, and the reason it is a separate panel from the
 * Core Test above it.
 *
 * The Core Test is a checklist over what was reported. The thesis is the
 * forward-looking question, and the two genuinely disagree on the companies
 * most worth thinking about — anything in the middle of a heavy investment
 * cycle fails a checklist built on trailing figures. Showing one verdict
 * for both is what makes a screener useless exactly where it matters.
 *
 * The status is a word and a mark, never a colour. Green and red mean price
 * direction on every other surface of this site, and a green "positive
 * thesis" badge would read as a buy signal — which is the reading this
 * panel exists to prevent.
 *
 * Every sentence here traces back to a finding that carried evidence. This
 * component composes; it does not assert.
 */

const MATRIX_MARK: Record<string, string> = {
  strong: "▰▰▰",
  adequate: "▰▰▱",
  watch: "▰▱▱",
  weak: "▱▱▱",
  unknown: "···",
};

function List({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div>
      <h4 className="eyebrow">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-2.5 text-[12px] text-ink-ghost">{empty}</p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {/* Keyed by position as well as by text. Two agents can reach the
              same sentence — "העדיפות מול המדד כבר ארוכה" arrives from both
              the contrarian and the catalyst pass — and a list keyed on the
              string alone silently drops the second one. */}
          {items.map((item, index) => (
            <li
              key={`${index}-${item}`}
              className="flex gap-2.5 text-[13px] leading-relaxed text-ink-muted"
            >
              <span
                className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-ghost"
                aria-hidden="true"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function IntelligencePanel({
  intelligence,
}: {
  intelligence: CompanyIntelligence;
}) {
  const { thesis, matrix, quadrant, catalysts, gaps, reports } = intelligence;
  const status = THESIS_LABELS[thesis.status];

  return (
    <>
      {/* ---- The thesis ---- */}
      <div className="surface overflow-hidden">
        <div className="border-b border-line p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-[13px] text-accent" aria-hidden="true">
                  {status.mark}
                </span>
                <span className="text-[15px] font-bold tracking-tight">
                  {status.label}
                </span>
              </div>
              <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink">
                {thesis.headline}
              </p>
            </div>

            <span className="badge shrink-0">
              {CONFIDENCE_LABELS[thesis.confidence]}
            </span>
          </div>

          <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-ghost">
            {thesis.confidenceReason}
          </p>
        </div>

        {/* The point of the whole module: why a company that failed the
            Core Test is still worth tracking. */}
        {thesis.whyStillTracked && (
          <div className="border-b border-line bg-base/40 p-6">
            <h3 className="eyebrow">למה החברה עדיין במעקב</h3>
            <p className="mt-2.5 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
              {thesis.whyStillTracked}
            </p>
          </div>
        )}

        <div className="grid gap-8 p-6 lg:grid-cols-2">
          <List
            title="למה החברה מעניינת"
            items={thesis.whyInteresting}
            empty="לא נמצא בנתונים ממצא שתומך בקריאה קדימה."
          />
          <List
            title="למה עכשיו"
            items={thesis.whyNow}
            empty="לא זוהה אירוע או שינוי שמייחד את התקופה הנוכחית."
          />
          <List
            title="מה צריך לקרות כדי שהתזה תעבוד"
            items={thesis.conditions}
            empty="לא הוגדרו תנאים — התזה אינה תלויה באירוע מסוים."
          />
          <List
            title="מה יכול לשבור אותה"
            items={thesis.breakers}
            empty="לא נמצא בנתונים גורם שסותר את הקריאה."
          />
        </div>
      </div>

      {/* ---- Business or price ---- */}
      <Section
        eyebrow="האבחנה"
        title="הבעיה היא העסק, או המחיר?"
        description="שתי שאלות שונות לגמרי. עסק חלש בכל מחיר הוא שאלה על החברה; עסק חזק במחיר גבוה הוא שאלה על סבלנות."
      >
        <div className="surface p-6">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
            <div>
              <div className="text-[11px] text-ink-faint">איכות העסק</div>
              <div className="mt-1 text-[17px] font-bold tracking-tight">
                {quadrant.businessQuality === "strong"
                  ? "חזק"
                  : quadrant.businessQuality === "weak"
                    ? "חלש"
                    : quadrant.businessQuality === "mixed"
                      ? "מעורב"
                      : "לא ידוע"}
              </div>
            </div>

            <div className="hidden h-9 w-px bg-line sm:block" aria-hidden="true" />

            <div>
              <div className="text-[11px] text-ink-faint">רמת המחיר</div>
              <div className="mt-1 text-[17px] font-bold tracking-tight">
                {quadrant.priceLevel === "cheap"
                  ? "נמוך"
                  : quadrant.priceLevel === "rich"
                    ? "גבוה"
                    : quadrant.priceLevel === "fair"
                      ? "סביר"
                      : "לא ידוע"}
              </div>
            </div>

            <div className="hidden h-9 w-px bg-line sm:block" aria-hidden="true" />

            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-ink-faint">הצירוף</div>
              <div className="mt-1 text-[15px] font-medium text-accent">
                {quadrant.verdict}
              </div>
            </div>
          </div>

          <p className="mt-5 border-t border-line pt-4 text-[13px] leading-relaxed text-ink-muted">
            {quadrant.implication}
          </p>
        </div>
      </Section>

      {/* ---- Decision matrix ---- */}
      <Section
        eyebrow="מטריצת החלטה"
        title="כל גורם, עם הראיה שמאחוריו"
        description="הסטטוס לעולם אינו התשובה המלאה. עמודת הראיה היא מה שמאפשר להתווכח איתו."
      >
        <div className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] text-ink-faint">
                  <th scope="col" className="px-5 py-3 text-start font-normal">
                    גורם
                  </th>
                  <th scope="col" className="px-5 py-3 text-start font-normal">
                    סטטוס
                  </th>
                  <th scope="col" className="px-5 py-3 text-start font-normal">
                    ראיה
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr
                    key={row.factor}
                    className="border-b border-line last:border-0"
                  >
                    <td className="px-5 py-3 text-[13px] text-ink">
                      {row.factor}
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2">
                        <span
                          className="num text-[11px] tracking-tighter text-accent"
                          aria-hidden="true"
                        >
                          {MATRIX_MARK[row.status]}
                        </span>
                        <span className="text-[12px] text-ink-muted">
                          {MATRIX_LABELS[row.status]}
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[12px] text-ink-faint">
                      {row.evidence}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* ---- Catalysts ---- */}
      {catalysts.length > 0 && (
        <Section
          eyebrow="זרזים"
          title="אירועים שאפשר להמתין להם"
          description="רק דברים עם תאריך או רמה מדודה. ציפייה בלי תאריך נמצאת בתזה, לא ברשימה שמרמזת על לוח שנה."
        >
          <div className="surface divide-y divide-line">
            {catalysts.map((catalyst) => (
              <div
                key={catalyst.title}
                className="grid gap-3 p-5 sm:grid-cols-[190px_1fr] sm:gap-6"
              >
                <div>
                  <div className="text-[13px] font-medium text-ink">
                    {catalyst.title}
                  </div>
                  <div className="mt-1 text-[12px] text-accent">
                    {catalyst.when}
                  </div>
                  {catalyst.date && (
                    <div className="num mt-0.5 text-[10px] text-ink-ghost">
                      {catalyst.date}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[13px] leading-relaxed text-ink-muted">
                    {catalyst.why}
                  </p>
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                    {catalyst.impact}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ---- Audit trail ---- */}
      <Section
        eyebrow="שקיפות"
        title="איך הגענו למסקנה"
        description="כל סוכן, מה מצא, ומה לא הצליח לבדוק. פער אינו מסקנה — מדד שלא ניתן לחשב נשאר חסר ואינו מוחלף בהערכה."
      >
        <div className="space-y-2">
          {reports.map((report) => (
            <details key={report.agent} className="surface interactive group">
              <summary className="flex cursor-pointer items-center justify-between gap-4 p-4">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[13px] font-medium text-ink">
                    {report.label}
                  </span>
                  <span className="num text-[11px] text-ink-ghost">
                    {report.findings.length} ממצאים
                  </span>
                  {report.gaps.length > 0 && (
                    <span className="num text-[11px] text-ink-ghost">
                      · {report.gaps.length} פערים
                    </span>
                  )}
                </span>
                <span
                  className="text-[11px] text-ink-ghost transition-transform group-open:rotate-180"
                  aria-hidden="true"
                >
                  ▾
                </span>
              </summary>

              <div className="border-t border-line bg-base/40 p-5">
                {report.findings.length > 0 && (
                  <div className="space-y-5">
                    {report.findings.map((finding) => (
                      <div key={finding.id}>
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-[13px] font-medium text-ink">
                            {finding.title}
                          </span>
                          <span className="badge">
                            {CONFIDENCE_LABELS[finding.confidence]}
                          </span>
                        </div>

                        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
                          {finding.body}
                        </p>

                        {finding.evidence.length > 0 && (
                          <dl className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1.5">
                            {finding.evidence.map((item) => (
                              <div
                                key={`${item.label}-${item.value}`}
                                className="flex items-baseline gap-1.5"
                              >
                                <dt className="text-[10px] text-ink-ghost">
                                  {item.label}
                                </dt>
                                <dd className="num text-[11px] text-ink-faint">
                                  {item.value}
                                </dd>
                                <dd className="text-[10px] text-ink-ghost">
                                  ({item.source.origin}
                                  {item.source.asOf && ` · ${item.source.asOf}`}
                                  )
                                </dd>
                              </div>
                            ))}
                          </dl>
                        )}

                        <p className="mt-2 text-[10px] leading-relaxed text-ink-ghost">
                          {finding.confidenceReason}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {report.gaps.length > 0 && (
                  <div
                    className={
                      report.findings.length > 0
                        ? "mt-5 border-t border-line pt-4"
                        : ""
                    }
                  >
                    <h4 className="eyebrow">מה לא נבדק</h4>
                    <ul className="mt-2 space-y-1.5">
                      {report.gaps.map((gap, index) => (
                        <li
                          key={`${index}-${gap}`}
                          className="text-[11px] leading-relaxed text-ink-ghost"
                        >
                          — {gap}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>

        {gaps.length > 0 && (
          <p className="mt-4 text-[11px] leading-relaxed text-ink-ghost">
            המערכת מדווחת על {gaps.length} פערי נתונים שונים. הם מוצגים
            במכוון: פער הוא מידע על גבולות הניתוח, והסתרתו גורמת לשאר להיראות
            שלם יותר משהוא.
          </p>
        )}
      </Section>
    </>
  );
}
