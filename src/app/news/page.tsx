import Link from "next/link";
import {
  SIGNIFICANCE_LABELS,
  getEnrichedFeed,
  isFeedStale,
  type EnrichedArticle,
} from "@/lib/news-store";
import { fmtRelative } from "@/lib/format";

// The page reads files the background job wrote, so it renders instantly.
export const revalidate = 300;

/** Significance is shown as a label, never as colour. Green and red mean
 *  price direction on this site, and a consequential news story is neither
 *  good nor bad until you know which side of it you are on. */
function SignificanceTag({ level }: { level: EnrichedArticle["analysis"] }) {
  if (!level) return null;
  return (
    <span className="shrink-0 rounded-full border border-line-strong px-2 py-0.5 text-[10px] text-ink-muted">
      {SIGNIFICANCE_LABELS[level.significance]}
    </span>
  );
}

function Article({ article }: { article: EnrichedArticle }) {
  const { analysis } = article;

  return (
    <li className="border-b border-line py-3 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] leading-snug text-ink hover:text-gold"
          dir="auto"
        >
          {article.title}
        </a>
        <SignificanceTag level={analysis} />
      </div>

      {analysis && (
        <div className="mt-2 space-y-2 border-r-2 border-line-strong pr-3">
          <p className="text-[13px] leading-relaxed text-ink">
            {analysis.summary}
          </p>
          <p className="text-[12px] leading-relaxed text-ink-muted">
            <span className="text-gold">השפעה: </span>
            {analysis.impact}
          </p>
          {analysis.tickers.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-ink-faint">נוגע ל־</span>
              {analysis.tickers.map((ticker) => (
                <Link
                  key={ticker}
                  href={`/company/${ticker}`}
                  className="num rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-muted hover:border-line-strong hover:text-gold"
                >
                  {ticker}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-ink-faint">
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
        {!analysis && <span className="text-ink-faint">· טרם נותח</span>}
      </div>
    </li>
  );
}

export default async function NewsPage() {
  const { refreshedAt, sectors, summarizedCount, totalCount } =
    await getEnrichedFeed();

  const stale = isFeedStale(refreshedAt);
  const empty = sectors.length === 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="border-b border-line pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl">חדשות וגאופוליטיקה</h1>
          {refreshedAt && (
            <span className="num text-[11px] text-ink-muted">
              עודכן {fmtRelative(new Date(refreshedAt))}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          כתבות מ-24 השעות האחרונות, מסוננות לפי רלוונטיות לשוק ומסודרות לפי
          סקטור. כל כתבה שנותחה מקבלת סיכום בעברית וניתוח של מנגנון ההשפעה.
          {totalCount > 0 && (
            <>
              {" "}
              <span className="num">{summarizedCount}</span> מתוך{" "}
              <span className="num">{totalCount}</span> כתבות נותחו.
            </>
          )}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
          הניתוח מתאר מה הכתבה אומרת ואילו סקטורים עשויים להיות מושפעים
          וכיצד. הוא אינו המלצה לקנות או למכור דבר.
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
              הפיד לא התרענן מעל שעתיים. ייתכן שתהליך הרענון האוטומטי נתקע.
            </p>
          )}

          <div className="mt-6 space-y-4">
            {sectors.map((sector) => (
              <section
                key={sector.sector}
                className="rounded-xl border border-line bg-surface p-4"
              >
                <div className="flex items-baseline justify-between gap-2 border-b border-line pb-2">
                  <h2 className="text-sm text-gold">{sector.label}</h2>
                  {sector.ok && (
                    <span className="num text-[10px] text-ink-faint">
                      {sector.articles.length}
                    </span>
                  )}
                </div>

                {/* A failed fetch must never be dressed up as "no news" —
                    the two mean opposite things to someone deciding whether
                    a sector is quiet. */}
                {!sector.ok ? (
                  <p className="mt-3 text-xs text-down">
                    הרענון האחרון של הסקטור הזה נכשל. הנתונים אינם זמינים.
                  </p>
                ) : sector.articles.length === 0 ? (
                  <p className="mt-3 text-xs text-ink-faint">
                    לא נמצאו כתבות רלוונטיות ב-24 השעות האחרונות.
                  </p>
                ) : (
                  <ul className="mt-1">
                    {sector.articles.map((article) => (
                      <Article key={article.url} article={article} />
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
