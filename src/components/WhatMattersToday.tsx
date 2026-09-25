import Link from "next/link";
import type { EnrichedArticle } from "@/lib/news-shape";
import { catalystMeaning } from "@/lib/news-shape";
import { fmtRelative } from "@/lib/format";

/**
 * What matters today.
 *
 * The dashboard already showed prices and a list of headlines. What it did
 * not answer is the question a reader actually arrives with — of
 * everything that happened, which two or three things change anything.
 *
 * So this section is built from the one signal the feed produces that is
 * about consequence rather than recency: the catalyst verdict. A story is
 * shown here only if it was read and judged to change the business, the
 * competition or the regulation. Everything else stays in the feed, where
 * it belongs.
 *
 * When nothing qualifies, the section says so rather than promoting the
 * newest three stories to look busy. A quiet day is information.
 */
export function WhatMattersToday({
  articles,
}: {
  articles: EnrichedArticle[];
}) {
  /* Two tiers, in order.

     A story the model read and judged to be a catalyst is the strong
     signal, and it leads. Below that comes the rule-based triage, which
     runs on every story the instant it arrives and is right often enough
     to be worth showing — clearly marked as preliminary, because it reads
     keywords and not meaning.

     Without the second tier this section would be empty most of the day:
     the model reads a handful of stories per visit, and the feed carries
     two hundred. An empty "what matters" on a day when something did
     matter is the worse failure. */
  const read = articles.filter(
    (article) =>
      article.analysis?.catalystKind === "catalyst" ||
      article.analysis?.significance === "high",
  );

  const triaged = articles.filter(
    (article) => !article.analysis && article.triage?.kind === "catalyst",
  );

  const matters = [...read, ...triaged].slice(0, 3);

  if (matters.length === 0) {
    return (
      <div className="surface px-5 py-6">
        <p className="text-[14px] text-ink">
          אף כתבה שנקראה היום לא סווגה כאירוע שמשנה עסק.
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
          זה לא אומר שלא קרה כלום — זה אומר שמה שקרה עד עכשיו הוא רעש לפי
          הסיווג של האתר. יום שקט הוא מידע, וכאן הוא נאמר במפורש במקום
          להציג שלוש כותרות אקראיות.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {matters.map((article, index) => {
        const analysis = article.analysis;
        const tickers = [
          ...new Set([...(analysis?.tickers ?? []), ...article.tickers]),
        ].slice(0, 4);

        return (
          <article key={article.url} className="surface p-5">
            <div className="flex items-baseline gap-3">
              <span className="num text-[13px] text-ink-ghost">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[15px] font-medium leading-snug text-ink transition-colors hover:text-accent"
                  dir="auto"
                >
                  {article.title}
                </a>

                {analysis ? (
                  <>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                      {analysis.summary}
                    </p>

                    <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                      <span className="text-ink-muted">למה זה משנה: </span>
                      {analysis.impact}
                    </p>

                    {catalystMeaning(analysis.catalystKind) && (
                      <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                        {catalystMeaning(analysis.catalystKind)}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    {article.excerpt && (
                      <p
                        className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink-muted"
                        dir="auto"
                      >
                        {article.excerpt}
                      </p>
                    )}
                    <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                      <span className="text-ink-muted">סיווג ראשוני: </span>
                      {article.triage?.reason}. זהו סיווג לפי כללים, שנעשה
                      ברגע שהכתבה נקלטה ולפני שנקראה במלואה — הקריאה המלאה
                      מופיעה בעמוד החדשות.
                    </p>
                  </>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {tickers.map((ticker) => (
                    <Link
                      key={ticker}
                      href={`/company/${ticker}`}
                      className="num rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-faint transition-colors hover:border-line-strong hover:text-ink"
                    >
                      {ticker}
                    </Link>
                  ))}
                  <span className="ms-auto text-[10px] text-ink-ghost" dir="auto">
                    {article.domain}
                    {article.seenAt &&
                      ` · ${fmtRelative(new Date(article.seenAt))}`}
                  </span>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
