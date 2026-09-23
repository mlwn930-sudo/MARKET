import { getEnrichedFeed, isFeedStale } from "@/lib/news-store";
import { ArticleCard } from "@/components/ArticleCard";
import { fmtRelative } from "@/lib/format";
import { AccentTheme } from "@/components/AccentTheme";

export const revalidate = 300;

export const metadata = {
  title: "חדשות השוק — Market Intel",
  description:
    "חדשות שוק ההון האמריקאי לפי סקטור, עם סיכום וניתוח מנגנון השפעה בעברית.",
};

export default async function NewsPage() {
  const { refreshedAt, sectors, analysedCount, totalCount } =
    await getEnrichedFeed();

  const stale = isFeedStale(refreshedAt);
  const empty = sectors.length === 0;

  return (
    <>
      <AccentTheme accent="#c96f2a" />
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="border-b border-line pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl">חדשות השוק</h1>
          {refreshedAt && (
            <span className="flex items-center gap-2 text-[11px] text-ink-muted">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-up" />
              <span className="num">
                עודכן {fmtRelative(new Date(refreshedAt))}
              </span>
            </span>
          )}
        </div>

        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-ink-muted">
          חדשות מ-CNBC, רויטרס ומקורות שוק נוספים, ממוינות לסקטורים. כל כתבה
          חדשה מנותחת אוטומטית — סיכום בעברית והסבר על מנגנון ההשפעה.
          {totalCount > 0 && (
            <>
              {" "}
              <span className="num">{analysedCount}</span> מתוך{" "}
              <span className="num">{totalCount}</span> נותחו.
            </>
          )}
        </p>

        <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
          הניתוח מתאר מה הכתבה אומרת ואילו סקטורים עשויים להיות מושפעים וכיצד.
          הוא אינו המלצה לקנות או למכור דבר.
        </p>
      </header>

      {empty ? (
        <p className="mt-6 rounded-xl border border-line bg-surface px-4 py-4 text-sm text-ink-muted">
          הפיד עדיין לא אוכלס. הרץ{" "}
          <code className="num">npm run refresh:news</code>.
        </p>
      ) : (
        <>
          {stale && (
            <p className="mt-4 rounded-lg border border-line-strong bg-surface px-4 py-3 text-sm text-ink">
              הפיד לא התרענן מעל שלוש שעות. ייתכן שתהליך הרענון האוטומטי נתקע.
            </p>
          )}

          <nav className="mt-6 flex flex-wrap gap-2">
            {sectors.map((sector) => (
              <a
                key={sector.sector}
                href={`#${sector.sector}`}
                className="rounded-lg border px-3 py-1.5 text-xs transition-colors"
                style={{
                  borderColor: `${sector.accent}44`,
                  color: sector.accent,
                }}
              >
                {sector.label}
                <span className="num mr-1.5 text-ink-faint">
                  {sector.articles.length}
                </span>
              </a>
            ))}
          </nav>

          <div className="mt-8 space-y-12">
            {sectors.map((sector) => (
              <section
                key={sector.sector}
                id={sector.sector}
                className="scroll-mt-6"
              >
                <div
                  className="border-b-2 pb-2"
                  style={{ borderColor: `${sector.accent}55` }}
                >
                  <h2 className="text-lg" style={{ color: sector.accent }}>
                    {sector.label}
                  </h2>
                  {sector.blurb && (
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      {sector.blurb}
                    </p>
                  )}
                </div>

                {sector.articles.length === 0 ? (
                  <p className="mt-4 text-xs text-ink-faint">
                    אין כרגע כתבות בסקטור הזה.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {sector.articles.map((article) => (
                      <ArticleCard
                        key={article.url}
                        article={article}
                        accent={sector.accent}
                      />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}

      <p className="mt-12 text-xs leading-relaxed text-ink-faint">
        הכתבות מוצגות כפי שהתפרסמו במקורן ואינן מסוננות לפי אמינות המקור.
        קישור לכתבה אינו המלצה, ואין באמור ייעוץ השקעות.
      </p>
    </main>
    </>
  );
}
