import { getNewsFeed, isFeedStale } from "@/lib/news-store";
import { fmtRelative } from "@/lib/format";

// The page reads a file the background job wrote, so it renders instantly.
export const revalidate = 300;

export default async function NewsPage() {
  const feed = await getNewsFeed();
  const stale = isFeedStale(feed);
  const empty = feed.sectors.length === 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="border-b border-line pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl">חדשות וגאופוליטיקה</h1>
          {feed.refreshedAt && (
            <span className="num text-[11px] text-ink-muted">
              עודכן {fmtRelative(new Date(feed.refreshedAt))}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          סריקה של כתבות מ-24 השעות האחרונות, מסודרת לפי הסקטור שהן נוגעות
          בו. המקור הוא GDELT, שמנטר חדשות בלמעלה ממאה שפות.
        </p>
      </header>

      {empty ? (
        <p className="mt-6 rounded-xl border border-line bg-surface px-4 py-4 text-sm text-ink-muted">
          הפיד עדיין לא אוכלס. הרץ <code className="num">npm run refresh:news</code>{" "}
          כדי למשוך כתבות, או המתן לריצה הבאה של תהליך הרענון האוטומטי.
        </p>
      ) : (
        <>
          {stale && (
            <p className="mt-4 rounded-lg border border-line-strong bg-surface px-4 py-3 text-sm text-ink">
              הפיד לא התרענן מעל שעתיים. ייתכן שתהליך הרענון האוטומטי נתקע.
            </p>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {feed.sectors.map((sectorFeed) => (
              <section
                key={sectorFeed.sector}
                className="rounded-xl border border-line bg-surface p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm text-gold">{sectorFeed.label}</h2>
                  {sectorFeed.ok && (
                    <span className="flex items-baseline gap-2 text-[10px] text-ink-faint">
                      {/* A sector whose refresh failed still shows its last
                          good articles. Saying so is the difference between
                          old data and data presented as current. */}
                      {sectorFeed.refreshedAt &&
                        sectorFeed.refreshedAt !== feed.refreshedAt && (
                          <span>
                            נתונים מ{fmtRelative(new Date(sectorFeed.refreshedAt))}
                          </span>
                        )}
                      <span className="num">{sectorFeed.articles.length}</span>
                    </span>
                  )}
                </div>

                {/* A failed fetch must never be dressed up as "no news" —
                    the two mean opposite things to someone deciding whether
                    a sector is quiet. */}
                {!sectorFeed.ok ? (
                  <p className="mt-3 text-xs text-down">
                    הרענון האחרון של הסקטור הזה נכשל. הנתונים אינם זמינים.
                  </p>
                ) : sectorFeed.articles.length === 0 ? (
                  <p className="mt-3 text-xs text-ink-faint">
                    לא נמצאו כתבות ב-24 השעות האחרונות.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {sectorFeed.articles.map((article) => (
                      <li
                        key={article.url}
                        className="border-b border-line pb-3 last:border-0 last:pb-0"
                      >
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[13px] leading-snug text-ink hover:text-gold"
                          dir="auto"
                        >
                          {article.title}
                        </a>
                        <div className="mt-1 flex gap-2 text-[10px] text-ink-faint">
                          <span className="num" dir="ltr">
                            {article.domain}
                          </span>
                          {article.seenAt && (
                            <>
                              <span>·</span>
                              <span>{fmtRelative(new Date(article.seenAt))}</span>
                            </>
                          )}
                          {article.country && (
                            <>
                              <span>·</span>
                              <span className="num" dir="ltr">
                                {article.country}
                              </span>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </>
      )}

      <p className="mt-8 text-xs leading-relaxed text-ink-faint">
        הכתבות מוצגות כפי שהתפרסמו במקורן ואינן מסוננות לפי אמינות המקור.
        קישור לכתבה אינו המלצה, ואין באמור ייעוץ השקעות.
      </p>
    </main>
  );
}
