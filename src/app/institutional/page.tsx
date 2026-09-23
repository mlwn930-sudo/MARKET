import Link from "next/link";
import {
  CHANGE_LABELS,
  getInstitutional,
  type PositionChange,
} from "@/lib/institutional-store";
import { fmtCompact, fmtDate } from "@/lib/format";
import { AccentTheme } from "@/components/AccentTheme";

export const revalidate = 3600;

/** Moves are shown without colour on purpose. A fund increasing a position
 *  is not "good news" — it is information. Green and red on this page would
 *  read as a recommendation. */
function ChangeRow({ change }: { change: PositionChange }) {
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-0">
      <span className="text-[13px] leading-snug" dir="auto">
        {change.issuer}
      </span>
      <span className="flex shrink-0 items-baseline gap-2 text-[11px] text-ink-muted">
        <span>{CHANGE_LABELS[change.kind]}</span>
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
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-xl">מעקב מוסדי</h1>
        <p className="mt-4 rounded-xl border border-line bg-surface px-4 py-4 text-sm text-ink-muted">
          הנתונים עדיין לא נבנו. הרץ{" "}
          <code className="num">npm run build:institutional</code>.
        </p>
      </main>
    );
  }

  return (
    <>
      <AccentTheme accent="#378add" />
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="border-b border-line pb-5">
        <h1 className="text-xl">מעקב מוסדי</h1>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          מה הגופים הגדולים מחזיקים, ומה השתנה מהרבעון הקודם. הנתונים מדוחות
          13F שמוגשים ל-SEC.{" "}
          <span className="text-ink">
            דוח 13F מוגש עד 45 יום אחרי סוף הרבעון
          </span>{" "}
          — כלומר התמונה תמיד מאחרת, וייתכן שהגוף כבר שינה את הפוזיציה. זו
          מגבלת רגולציה, לא באג.
        </p>
      </header>

      <div className="mt-6 space-y-4">
        {institutions.map((inst) => (
          <section
            key={inst.cik}
            className="rounded-xl border border-line bg-surface p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
              <div>
                <h2 className="text-sm text-gold" dir="auto">
                  {inst.name}
                </h2>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  {inst.note} ·{" "}
                  <span className="num">{inst.positionCount}</span> פוזיציות ·
                  שווי <span className="num">${fmtCompact(inst.totalValue)}</span>
                </p>
              </div>
              <p className="text-[11px] text-ink-faint">
                רבעון שהסתיים{" "}
                <span className="num">{fmtDate(inst.reportDate)}</span> · הוגש{" "}
                <span className="num">{fmtDate(inst.filedAt)}</span>
              </p>
            </div>

            <div className="mt-3 grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="mb-1 text-[11px] text-ink-muted">
                  אחזקות מובילות
                </h3>
                <ul>
                  {inst.topHoldings.map((holding) => (
                    <li
                      key={holding.issuer}
                      className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-0"
                    >
                      <span className="text-[13px] leading-snug" dir="auto">
                        {holding.issuer}
                      </span>
                      <span className="num shrink-0 text-[11px] text-ink-muted">
                        {holding.weight !== null
                          ? `${holding.weight.toFixed(1)}%`
                          : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-1 text-[11px] text-ink-muted">
                  שינויים מהרבעון הקודם
                </h3>
                {!inst.hasComparison ? (
                  <p className="py-2 text-xs text-ink-faint">
                    אין דוח קודם להשוואה.
                  </p>
                ) : inst.changes.length === 0 ? (
                  <p className="py-2 text-xs text-ink-faint">
                    לא נרשמו שינויים מהותיים.
                  </p>
                ) : (
                  <ul>
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
          </section>
        ))}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-ink-faint">
        דוחות 13F כוללים מניות אמריקאיות בלבד ואינם כוללים פוזיציות שורט,
        אג״ח או מזומן — כלומר הם מראים חלק מהתמונה, לא את כולה. אין באמור
        ייעוץ השקעות.
      </p>

      <p className="mt-4 text-xs">
        <Link href="/" className="text-ink-muted hover:text-ink">
          ← חזרה לדשבורד
        </Link>
      </p>
    </main>
    </>
  );
}
