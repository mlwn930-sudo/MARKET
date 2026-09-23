import Link from "next/link";
import { runScreen } from "@/lib/screener";
import {
  ScoreDistribution,
  ValueQualityScatter,
} from "@/components/ScreenerCharts";
import { fmtCompact, fmtDate } from "@/lib/format";
import { AccentTheme } from "@/components/AccentTheme";

export const revalidate = 3600;

export default async function OpportunitiesPage() {
  const { builtAt, results } = await runScreen();

  if (results.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-xl">הזדמנויות השקעה</h1>
        <p className="mt-4 panel px-4 py-4 text-sm text-ink-muted">
          הנתונים עדיין לא נבנו. הרץ{" "}
          <code className="num">npm run build:fundamentals</code>.
        </p>
      </main>
    );
  }

  const maxScore = results[0].maxScore;

  return (
    <>
      <AccentTheme accent="#3fa7c4" />
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="border-b border-line pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl">הזדמנויות לטווח בינוני-ארוך</h1>
          {builtAt && (
            <span className="text-[11px] text-ink-muted">
              נבנה <span className="num">{fmtDate(builtAt.slice(0, 10))}</span>
            </span>
          )}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          <span className="num">{results.length}</span> חברות נבדקו מול{" "}
          <span className="num">{maxScore}</span> קריטריונים של איכות, צמיחה,
          תמחור ואיתנות. רובם משווים מול חציון הסקטור, כי מכפיל של{" "}
          <span className="num">15</span> אומר דבר אחד בבנק ודבר אחר לגמרי
          בחברת שבבים.
        </p>
        <p className="mt-2 rounded-lg border border-line-strong bg-surface px-4 py-3 text-xs leading-relaxed text-ink">
          <strong className="font-medium">זה סינון, לא המלצה.</strong> ציון
          גבוה אומר שהחברה עברה יותר מבחנים כמותיים — לא שכדאי לקנות אותה.
          קריטריון שאי אפשר לחשב נספר ככישלון, כי נתון חסר אינו הוכחה לאיכות.
        </p>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ValueQualityScatter results={results} />
        <ScoreDistribution results={results} />
      </div>

      <div className="mt-4 space-y-3">
        {results.map((result) => (
          <section
            key={result.company.ticker}
            className="panel p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <Link
                  href={`/company/${result.company.ticker}`}
                  className="text-sm text-ink hover:text-gold"
                >
                  <span className="num">{result.company.ticker}</span>
                  <span className="mr-2 text-ink-muted"> {result.company.name}</span>
                </Link>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  {result.sectorLabel}
                  {result.company.marketCap !== null && (
                    <>
                      {" · "}
                      <span className="num">
                        ${fmtCompact(result.company.marketCap)}
                      </span>
                    </>
                  )}
                  {result.company.stale && " · דוחות ישנים"}
                </p>
              </div>
              <div className="text-left">
                <span className="num text-xl text-gold">{result.score}</span>
                <span className="num text-xs text-ink-faint">
                  /{result.maxScore}
                </span>
              </div>
            </div>

            <ul className="mt-3 grid gap-x-4 gap-y-1 border-t border-line pt-3 sm:grid-cols-2">
              {result.criteria.map((criterion) => (
                <li
                  key={criterion.key}
                  className="flex items-baseline justify-between gap-2 text-[11px]"
                  title={criterion.explanation}
                >
                  <span
                    className={
                      criterion.passed ? "text-ink" : "text-ink-faint"
                    }
                  >
                    <span className="num ml-1">
                      {criterion.passed ? "✓" : "·"}
                    </span>
                    {criterion.label}
                  </span>
                  <span className="num shrink-0 text-ink-faint">
                    {criterion.detail}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-ink-faint">
        הסינון מבוסס על דוחות שהוגשו ל-SEC ועל שווי שוק נוכחי. הוא אינו
        מביא בחשבון את מה שהחברה עושה בפועל, את השוק שלה, את ההנהלה או את
        הסיכונים שאינם מופיעים במספרים. אין באמור ייעוץ השקעות.
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
