import Link from "next/link";
import { runScreen, type ScreenResult } from "@/lib/screener";
import { identityFor } from "@/lib/company-identity";
import {
  Disclaimer,
  Hero,
  Meter,
  Page,
  Section,
  StatBar,
  StatCell,
} from "@/components/ui";
import { fmtCompact, fmtDate } from "@/lib/format";

export const revalidate = 3600;

export const metadata = {
  title: "רדאר הזדמנויות",
  description:
    "48 חברות מול קריטריונים של איכות, צמיחה, תמחור ואיתנות — כל אחת עם הפרופיל שלה, לא עם ציון בודד.",
};

/**
 * The radar.
 *
 * The screener produces a score, and a score is the least useful thing it
 * knows. Two companies on seven out of ten can be opposites — one cheap and
 * shrinking, one expensive and compounding — and a list sorted by the total
 * hides exactly that.
 *
 * So each company is shown as a profile across four axes instead. The score
 * is still there, small, as an index into the list; the shape beside it is
 * what actually distinguishes one row from the next. The reader compares
 * shapes, which is a thing eyes are good at, rather than reading forty
 * numbers.
 *
 * No overall ranking of "best". The site presents the measurements; which
 * of them matters is the reader's call and depends on what they already own.
 */

/** The screener's criteria, grouped into the four questions they answer.
 *  Keys come from lib/screener.ts — the grouping is presentation only and
 *  changes nothing about how a criterion is evaluated. */
const AXES: { key: string; label: string; matches: string[]; hint: string }[] = [
  {
    key: "quality",
    label: "איכות",
    matches: ["roic", "margin", "fcf", "gross"],
    hint: "תשואה על ההון ורווחיות",
  },
  {
    key: "growth",
    label: "צמיחה",
    matches: ["growth", "cagr", "rev"],
    hint: "הכנסות ורווח לאורך זמן",
  },
  {
    key: "value",
    label: "תמחור",
    matches: ["pe", "ps", "ev", "yield"],
    hint: "מכפילים מול חציון הסקטור",
  },
  {
    key: "strength",
    label: "איתנות",
    matches: ["debt", "current", "altman", "interest", "share"],
    hint: "מאזן, חוב ודילול",
  },
];

/** Splits a company's criteria across the four axes. A criterion that
 *  matches nothing lands in quality, which is the default bucket rather
 *  than a judgement. */
function profile(result: ScreenResult) {
  return AXES.map((axis) => {
    const inAxis = result.criteria.filter((criterion) =>
      axis.matches.some((needle) => criterion.key.includes(needle)),
    );
    const pool = inAxis.length > 0 ? inAxis : [];
    return {
      ...axis,
      passed: pool.filter((c) => c.passed).length,
      total: pool.length,
    };
  }).filter((axis) => axis.total > 0);
}

export default async function OpportunitiesPage() {
  const { builtAt, results } = await runScreen().catch(() => ({
    builtAt: "",
    results: [] as ScreenResult[],
  }));

  if (results.length === 0) {
    return (
      <Page width="read">
        <Hero
          eyebrow="רדאר הזדמנויות"
          title="הסורק עדיין לא נבנה"
          lede="הרץ npm run build:fundamentals כדי לאכלס את יקום ההשוואה."
        />
        <Disclaimer />
      </Page>
    );
  }

  const maxScore = results[0]?.maxScore ?? 0;
  const strong = results.filter((r) => r.score >= maxScore * 0.7).length;
  const median = results[Math.floor(results.length / 2)]?.score ?? 0;

  return (
    <Page tint="#3f86c4">
      <Hero
        eyebrow="רדאר הזדמנויות"
        title="לא מי הכי טובה — מי חזקה במה"
        lede="כל חברה נבדקת מול קריטריונים כמותיים, רובם מול חציון הסקטור שלה. מה שמוצג הוא הפרופיל, לא דירוג: שתי חברות באותו ציון יכולות להיות הפוכות זו מזו."
        image="/hero/opportunities.webp"
        imageAlt=""
        stats={
          <StatBar>
            <StatCell label="חברות נבדקו" value={results.length} />
            <StatCell label="קריטריונים" value={maxScore} />
            <StatCell
              label="עברו 70% ומעלה"
              value={strong}
              sub="ציון גבוה אינו המלצה"
            />
            <StatCell
              label="ציון חציוני"
              value={
                <>
                  {median}
                  <span className="text-ink-ghost">/{maxScore}</span>
                </>
              }
            />
          </StatBar>
        }
      />

      <p className="surface mt-10 px-5 py-4 text-[13px] leading-relaxed text-ink-muted">
        <strong className="font-medium text-ink">זה סינון, לא המלצה.</strong>{" "}
        ציון גבוה אומר שהחברה עברה יותר מבחנים כמותיים — לא שכדאי לקנות אותה.
        קריטריון שאי אפשר לחשב נספר ככישלון, כי נתון חסר אינו הוכחה לאיכות.
        {builtAt && (
          <span className="mt-1 block text-[11px] text-ink-ghost">
            נבנה <span className="num">{fmtDate(builtAt.slice(0, 10))}</span>
          </span>
        )}
      </p>

      <Section eyebrow="הפרופילים" title="כל החברות ביקום ההשוואה">
        <div className="space-y-2">
          {results.map((result) => {
            const axes = profile(result);
            const identity = identityFor(result.company.ticker);
            const failed = result.criteria.filter((c) => !c.passed);

            return (
              <details
                key={result.company.ticker}
                className="surface interactive group overflow-hidden"
              >
                <summary className="grid cursor-pointer grid-cols-1 items-center gap-4 p-4 lg:grid-cols-[minmax(200px,1.1fr)_2.4fr_auto]">
                  {/* Identity */}
                  <div className="flex items-center gap-3">
                    <span
                      className="h-9 w-[3px] shrink-0 rounded-full"
                      style={{ background: identity.accent }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="num text-[14px] font-medium text-ink">
                        {result.company.ticker}
                      </div>
                      <div className="truncate text-[11px] text-ink-faint">
                        {result.company.name}
                      </div>
                      <div className="mt-0.5 text-[10px] text-ink-ghost">
                        {result.sectorLabel}
                        {result.company.marketCap !== null && (
                          <>
                            {" · "}
                            <span className="num">
                              ${fmtCompact(result.company.marketCap)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* The profile — the part worth comparing */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                    {axes.map((axis) => (
                      <Meter
                        key={axis.key}
                        label={axis.label}
                        value={axis.passed}
                        max={axis.total}
                      />
                    ))}
                  </div>

                  {/* Score, small: an index into the list, not a verdict */}
                  <div className="flex items-center justify-between gap-3 lg:justify-end">
                    <span className="num text-[15px]">
                      <span className="text-ink">{result.score}</span>
                      <span className="text-ink-ghost">/{result.maxScore}</span>
                    </span>
                    <span
                      className="text-[11px] text-ink-ghost transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    >
                      ▾
                    </span>
                  </div>
                </summary>

                {/* The working, on demand */}
                <div className="border-t border-line bg-base/40 p-4">
                  <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                    {result.criteria.map((criterion) => (
                      <div
                        key={criterion.key}
                        className="flex items-start justify-between gap-3 border-b border-line py-2 last:border-b-0"
                      >
                        <span className="flex items-start gap-2">
                          <span
                            className={`num mt-px w-3 shrink-0 text-[11px] ${
                              criterion.passed ? "text-ink" : "text-ink-ghost"
                            }`}
                            aria-hidden="true"
                          >
                            {criterion.passed ? "✓" : "✕"}
                          </span>
                          <span>
                            <span className="block text-[12px] text-ink-muted">
                              {criterion.label}
                            </span>
                            <span className="block text-[10px] leading-snug text-ink-ghost">
                              {criterion.explanation}
                            </span>
                          </span>
                        </span>
                        <span className="num shrink-0 text-[11px] text-ink-faint">
                          {criterion.detail}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] text-ink-ghost">
                      {failed.length === 0
                        ? "כל הקריטריונים עברו."
                        : `לא עברו: ${failed.map((c) => c.label).join(" · ")}`}
                    </p>
                    <Link
                      href={`/company/${result.company.ticker}`}
                      className="btn btn-ghost"
                    >
                      לניתוח המלא
                    </Link>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </Section>

      <Disclaimer />
    </Page>
  );
}
