import {
  CHANGE_LABELS,
  getInstitutional,
  type PositionChange,
} from "@/lib/institutional-store";
import {
  Disclaimer,
  Hero,
  Page,
  Section,
  StatBar,
  StatCell,
} from "@/components/ui";
import { fmtCompact, fmtDate } from "@/lib/format";

export const revalidate = 3600;

export const metadata = {
  title: "מעקב מוסדי",
  description:
    "מה הגופים הגדולים מחזיקים ומה השתנה מהרבעון הקודם, לפי דוחות 13F שהוגשו ל-SEC.",
};

/**
 * Moves are shown without colour on purpose. A fund increasing a position
 * is not "good news" — it is information, and the fund's reasons are not in
 * the filing. Green and red here would read as a recommendation.
 */
function ChangeRow({ change }: { change: PositionChange }) {
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-line py-2.5 last:border-0">
      <span className="text-[13px] leading-snug text-ink-muted" dir="auto">
        {change.issuer}
      </span>
      <span className="flex shrink-0 items-baseline gap-2 text-[11px]">
        <span className="badge">{CHANGE_LABELS[change.kind]}</span>
        {change.sharesChangePercent !== null &&
          change.kind !== "exited" &&
          change.kind !== "new" && (
            <span className="num text-ink-faint">
              {change.sharesChangePercent > 0 ? "▲" : "▼"}
              {Math.abs(change.sharesChangePercent).toFixed(0)}%
            </span>
          )}
      </span>
    </li>
  );
}

export default async function InstitutionalPage() {
  const { institutions } = await getInstitutional();

  if (institutions.length === 0) {
    return (
      <Page width="read">
        <Hero
          eyebrow="מעקב מוסדי"
          title="הנתונים עדיין לא נבנו"
          lede="הרץ npm run build:institutional כדי למשוך את דוחות ה-13F."
        />
        <Disclaimer />
      </Page>
    );
  }

  const totalValue = institutions.reduce(
    (sum, inst) => sum + inst.totalValue,
    0,
  );
  const newest = institutions
    .map((inst) => inst.filedAt)
    .sort()
    .at(-1);

  /* The period the positions describe, not the day the form was filed.
     Those are two different dates and the gap between them is the whole
     point of the caveat below. */
  const newestReport = institutions
    .map((inst) => inst.reportDate)
    .sort()
    .at(-1);

  const positionsAgeDays = newestReport
    ? Math.round((Date.now() - Date.parse(newestReport)) / 86_400_000)
    : null;

  return (
    <Page tint="#0a84ff">
      <Hero
        eyebrow="מעקב מוסדי"
        title="מי עוד קונה את זה"
        lede="מה הגופים הגדולים מחזיקים ומה השתנה מהרבעון הקודם, מתוך דוחות 13F שמוגשים ל-SEC."
        stats={
          <StatBar>
            <StatCell label="גופים במעקב" value={institutions.length} />
            <StatCell
              label="שווי מצטבר"
              value={`$${fmtCompact(totalValue)}`}
            />
            <StatCell
              label="פוזיציות"
              value={institutions.reduce(
                (sum, inst) => sum + inst.positionCount,
                0,
              )}
            />
            <StatCell
              label="הגשה אחרונה"
              value={
                <span className="text-base">
                  {newest ? fmtDate(newest) : "—"}
                </span>
              }
            />
          </StatBar>
        }
      />

      {/* The rule was already stated here. What was missing is the figure
          it produces today — "up to 45 days" is a regulation, and "these
          positions are 96 days old" is the thing a reader can act on. The
          site's own principle: a number never appears without the context
          that turns it into knowledge, and a caveat without one is a
          sentence the eye learns to skip. */}
      <p
        className="surface mt-10 border-s-2 px-5 py-4 text-[13px] leading-relaxed text-ink-muted"
        style={{ borderInlineStartColor: "var(--color-warning)" }}
      >
        <strong className="font-medium text-ink">
          דוח 13F מוגש עד 45 יום אחרי סוף הרבעון.
        </strong>{" "}
        כלומר התמונה תמיד מאחרת, וייתכן שהגוף כבר שינה את הפוזיציה. זו מגבלת
        רגולציה, לא באג — והיא הסיבה שהעמוד הזה מתאר מה נעשה, לא מה לעשות.
        {positionsAgeDays !== null && (
          <span className="mt-2 block text-[12px] text-ink-faint">
            בפועל: הפוזיציות כאן נכונות ל-
            <span className="num">{fmtDate(newestReport!)}</span>, כלומר לפני{" "}
            <span className="num">{positionsAgeDays}</span> ימים.
            {positionsAgeDays > 120 &&
              " זה יותר מרבעון שלם — סביר שכבר הוגש דוח חדש שטרם נקלט כאן."}
          </span>
        )}
      </p>

      {institutions.map((inst) => (
        <Section key={inst.cik} eyebrow={inst.note} title={inst.name}>
          <div className="mb-5 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[11px] text-ink-faint">
            <span>
              <span className="num text-ink-muted">{inst.positionCount}</span>{" "}
              פוזיציות
            </span>
            <span>
              שווי{" "}
              <span className="num text-ink-muted">
                ${fmtCompact(inst.totalValue)}
              </span>
            </span>
            <span>
              רבעון שהסתיים{" "}
              <span className="num text-ink-muted">
                {fmtDate(inst.reportDate)}
              </span>
            </span>
            <span>
              הוגש{" "}
              <span className="num text-ink-muted">{fmtDate(inst.filedAt)}</span>
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="surface p-5">
              <h3 className="eyebrow">אחזקות מובילות</h3>
              <ul className="mt-3">
                {inst.topHoldings.map((holding) => (
                  <li
                    key={holding.issuer}
                    className="flex items-baseline justify-between gap-3 border-b border-line py-2.5 last:border-0"
                  >
                    <span
                      className="text-[13px] leading-snug text-ink-muted"
                      dir="auto"
                    >
                      {holding.issuer}
                    </span>
                    <span className="num shrink-0 text-[12px] text-ink">
                      {holding.weight !== null
                        ? `${holding.weight.toFixed(1)}%`
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="surface p-5">
              <h3 className="eyebrow">שינויים מהרבעון הקודם</h3>
              {!inst.hasComparison ? (
                <p className="mt-3 text-[12px] text-ink-ghost">
                  אין דוח קודם להשוואה.
                </p>
              ) : inst.changes.length === 0 ? (
                <p className="mt-3 text-[12px] text-ink-ghost">
                  לא נרשמו שינויים מהותיים.
                </p>
              ) : (
                <ul className="mt-3">
                  {inst.changes.map((change) => (
                    <ChangeRow
                      key={`${change.issuer}-${change.kind}`}
                      change={change}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Section>
      ))}

      <Disclaimer extra="דוחות 13F כוללים מניות אמריקאיות בלבד ואינם כוללים פוזיציות שורט, אג״ח או מזומן — כלומר הם מראים חלק מהתמונה, לא את כולה." />
    </Page>
  );
}
