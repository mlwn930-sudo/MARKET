import { isFeedStale } from "@/lib/news-store";
import { feedSignature, getLiveFeed } from "@/lib/live-news";
import { ArticleCard } from "@/components/ArticleCard";
import { FeaturedStory } from "@/components/FeaturedStory";
import { NewsAutoRefresh } from "@/components/NewsAutoRefresh";
import { Disclaimer, Hero, Page, Section, Stat, StatBar, StatCell } from "@/components/ui";
import { fmtRelative } from "@/lib/format";

export const revalidate = 60;

export const metadata = {
  title: "חדשות השוק",
  description:
    "חדשות שוק ההון האמריקאי לפי סקטור, כל כתבה נקראת דרך שלוש עדשות: זרז או רעש, תגובת מחיר, ושרשרת הערך.",
};

/**
 * The newsroom.
 *
 * Laid out the way a financial desk reads rather than as a uniform grid:
 * one story leads, a short column runs beside it, and the rest is a dense
 * feed by sector. A grid of identical cards tells the reader that every
 * story matters equally, which is the opposite of what this page exists to
 * say — most of what arrives changes nothing.
 */
export default async function NewsPage() {
  const feed = await getLiveFeed();
  const { refreshedAt, sectors, analysedCount, totalCount } = feed;

  const stale = isFeedStale(refreshedAt);
  const empty = sectors.length === 0;

  // One lead story, then a short column beside it. The lead is the most
  // consequential recent item the analysis found; when nothing has been
  // analysed yet it is simply the newest, which is still the right answer.
  const all = [
    ...new Map(
      sectors.flatMap((sector) => sector.articles).map((a) => [a.url, a]),
    ).values(),
  ].sort((a, b) => (b.seenAt ?? "").localeCompare(a.seenAt ?? ""));

  const ranked = [
    ...all.filter((a) => a.analysis?.significance === "high"),
    ...all.filter(
      (a) => !a.analysis && a.triage?.kind === "catalyst",
    ),
    ...all.filter(
      (a) => a.analysis?.significance !== "high" && a.triage?.kind !== "catalyst",
    ),
  ];

  const lead = ranked[0] ?? null;
  const column = ranked.slice(1, 5);

  const catalysts = all.filter(
    (a) => a.analysis?.catalystKind === "catalyst" || a.triage?.kind === "catalyst",
  ).length;

  return (
    <Page tint="#c9772a">
      <Hero
        eyebrow="חדשות"
        title="מה קרה, ומה זה בכלל משנה"
        lede="חדשות מ-CNBC, רויטרס ומקורות שוק נוספים. כל כתבה נקראת דרך שלוש עדשות קבועות, והעמוד מתעדכן מעצמו כשהפיד מתרענן."
        stats={
          <StatBar>
            <StatCell label="כתבות בפיד" value={totalCount} />
            <StatCell label="זוהו כזרז" value={catalysts} />
            <StatCell label="נותחו לעומק" value={analysedCount} />
            <StatCell
              label="עודכן"
              value={
                <span className="text-base">
                  {refreshedAt ? fmtRelative(new Date(refreshedAt)) : "—"}
                </span>
              }
              sub={
                <NewsAutoRefresh
                  signature={feedSignature(feed)}
                  analysedCount={analysedCount}
                />
              }
            />
          </StatBar>
        }
      />

      {stale && (
        <p className="surface mt-8 px-5 py-4 text-sm text-ink">
          הפיד לא התרענן מעל שלוש שעות. ייתכן שתהליך הרענון האוטומטי נתקע.
        </p>
      )}

      {empty ? (
        <p className="surface mt-10 px-5 py-5 text-sm text-ink-muted">
          הפיד עדיין לא אוכלס. הרץ{" "}
          <code className="num text-ink">npm run refresh:news</code>.
        </p>
      ) : (
        <>
          {/* ---- The lead ---- */}
          {lead && (
            <Section eyebrow="הסיפור המרכזי">
              <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
                <FeaturedStory article={lead} />

                <div className="surface divide-y divide-line">
                  {column.map((article) => (
                    <div key={article.url} className="p-4">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="text-[10px] text-ink-ghost" dir="auto">
                          {article.domain}
                        </span>
                        {article.seenAt && (
                          <span className="text-[10px] text-ink-ghost">
                            · {fmtRelative(new Date(article.seenAt))}
                          </span>
                        )}
                      </div>
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] font-medium leading-snug text-ink transition-colors hover:text-accent"
                        dir="auto"
                      >
                        {article.title}
                      </a>
                      {article.analysis && (
                        <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-ink-faint">
                          {article.analysis.summary}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {/* ---- Sector jump ---- */}
          <Section eyebrow="לפי סקטור" title="כל הפיד">
            <nav className="flex flex-wrap gap-2" aria-label="מעבר לסקטור">
              {sectors.map((sector) => (
                <a key={sector.sector} href={`#${sector.sector}`} className="pill">
                  {sector.label}
                  <span className="num text-ink-ghost">
                    {sector.articles.length}
                  </span>
                </a>
              ))}
            </nav>

            <div className="mt-10 space-y-14">
              {sectors.map((sector) => (
                <section key={sector.sector} id={sector.sector}>
                  <div className="mb-5 flex items-end justify-between gap-4 border-b border-line pb-3">
                    <div>
                      <h3 className="text-[17px] font-bold tracking-tight">
                        {sector.label}
                      </h3>
                      {sector.blurb && (
                        <p className="mt-1 text-[12px] text-ink-faint">
                          {sector.blurb}
                        </p>
                      )}
                    </div>
                    <Stat
                      label="כתבות"
                      value={sector.articles.length}
                      size="sm"
                    />
                  </div>

                  <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {sector.articles.map((article) => (
                      <ArticleCard key={article.url} article={article} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </Section>
        </>
      )}

      <Disclaimer extra="הכתבות מוצגות כפי שהתפרסמו במקורן ואינן מסוננות לפי אמינות המקור. קישור לכתבה אינו המלצה." />
    </Page>
  );
}
