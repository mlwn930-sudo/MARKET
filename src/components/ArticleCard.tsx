import Link from "next/link";
import {
  CATALYST_LABELS,
  SIGNIFICANCE_LABELS,
  type EnrichedArticle,
} from "@/lib/news-store";
import { TRIAGE_CAVEAT } from "@/lib/news-triage";
import { fmtRelative } from "@/lib/format";
import { AnalyzeArticleButton } from "@/components/AnalyzeArticleButton";
import { hasGeminiKey } from "@/lib/sources/gemini";

/**
 * One story.
 *
 * No image. Publisher thumbnails expire, arrive at wildly different crops,
 * and — on a feed where the useful signal is "is this a catalyst" — a photo
 * is the least informative thing on the card. The featured story on the
 * news page is the one exception, and it gets its own component.
 *
 * Significance and the catalyst verdict are labels, never colours. Green
 * and red mean price direction everywhere on this site, and a consequential
 * story is neither good nor bad until you know which side of it you are on.
 */

export function ArticleCard({
  article,
  compact = false,
  autoAnalyse = false,
  order = 0,
}: {
  article: EnrichedArticle;
  /** Drops the analysis body — for a dense list beside a featured story. */
  compact?: boolean;
  /** Reads the story without being asked. The page decides how many of
   *  its cards get this; the rest keep the button. */
  autoAnalyse?: boolean;
  order?: number;
}) {
  const { analysis, triage } = article;

  const verdict = analysis?.catalystKind
    ? CATALYST_LABELS[analysis.catalystKind].label
    : triage
      ? triage.kind === "catalyst"
        ? "זרז אפשרי"
        : triage.kind === "noise"
          ? "רעש"
          : "לא הוכרע"
      : null;

  const verdictTitle = analysis?.catalystKind
    ? CATALYST_LABELS[analysis.catalystKind].note
    : TRIAGE_CAVEAT;

  return (
    <article className="surface interactive flex flex-col p-4">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        {analysis && (
          <span className="badge" style={{ color: "var(--color-accent)" }}>
            {SIGNIFICANCE_LABELS[analysis.significance]}
          </span>
        )}
        {verdict && (
          <span className="badge" title={verdictTitle}>
            {verdict}
          </span>
        )}
        <span className="ms-auto text-[10px] text-ink-ghost" dir="auto">
          {article.domain}
          {article.seenAt && ` · ${fmtRelative(new Date(article.seenAt))}`}
        </span>
      </div>

      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[14px] font-medium leading-snug text-ink transition-colors hover:text-accent"
        dir="auto"
      >
        {article.title}
      </a>

      {!compact && (
        <div className="mt-2.5 flex-1 space-y-2">
          {analysis ? (
            <>
              <p className="text-[13px] leading-relaxed text-ink-muted">
                {analysis.summary}
              </p>
              <p className="text-[12px] leading-relaxed text-ink-faint">
                <span className="text-ink-muted">השפעה: </span>
                {analysis.impact}
              </p>

              {/* The three lenses, collapsed. The feed's job is to be
                  scannable; a reader who wants the full reading of one
                  story opens that story. */}
              {(analysis.catalyst || analysis.reaction || analysis.chain) && (
                <details className="pt-1">
                  <summary className="cursor-pointer text-[11px] text-ink-ghost transition-colors hover:text-ink-muted">
                    ניתוח בשלוש עדשות
                  </summary>
                  <dl className="mt-2 space-y-2 border-t border-line pt-2">
                    {[
                      { label: "זרז או רעש", body: analysis.catalyst },
                      { label: "תגובת מחיר מול ציפיות", body: analysis.reaction },
                      { label: "שרשרת הערך", body: analysis.chain },
                    ]
                      .filter((lens) => lens.body)
                      .map((lens) => (
                        <div key={lens.label}>
                          <dt className="text-[10px] text-ink-ghost">
                            {lens.label}
                          </dt>
                          <dd className="text-[12px] leading-relaxed text-ink-muted">
                            {lens.body}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </details>
              )}
            </>
          ) : (
            <>
              {article.excerpt && (
                <p
                  className="line-clamp-2 text-[12px] leading-relaxed text-ink-faint"
                  dir="auto"
                >
                  {article.excerpt}
                </p>
              )}
              {triage && (
                <p className="text-[11px] leading-relaxed text-ink-ghost">
                  <span className="text-ink-faint">סיווג ראשוני: </span>
                  {triage.reason}
                </p>
              )}

              {/* The story has not been read yet. The scheduled job will
                  reach it, and a reader who wants it now can spend the
                  call themselves. Hidden entirely without a key, rather
                  than offered and then refused. */}
              {hasGeminiKey() && (
                <AnalyzeArticleButton
                  url={article.url}
                  title={article.title}
                  auto={autoAnalyse}
                  order={order}
                />
              )}
            </>
          )}
        </div>
      )}

      {(analysis?.tickers.length || article.tickers.length) > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {[...new Set([...(analysis?.tickers ?? []), ...article.tickers])]
            .slice(0, 5)
            .map((ticker) => (
              <Link
                key={ticker}
                href={`/company/${ticker}`}
                className="num rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-faint transition-colors hover:border-line-strong hover:text-ink"
              >
                {ticker}
              </Link>
            ))}
        </div>
      )}
    </article>
  );
}
