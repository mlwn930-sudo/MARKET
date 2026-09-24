import Link from "next/link";
import {
  CATALYST_LABELS,
  SIGNIFICANCE_LABELS,
  type EnrichedArticle,
} from "@/lib/news-store";
import { fmtRelative } from "@/lib/format";

/**
 * The lead story.
 *
 * The one place in the feed that gets an image, and only when the publisher
 * supplied one. Everywhere else a thumbnail costs a row of vertical space
 * to say nothing; here it is doing the job of marking which story leads.
 *
 * Painted as a background rather than an <img> on purpose: publisher images
 * expire and move constantly, and a background that fails to load simply
 * shows the surface colour, where a broken <img> puts a torn-page icon at
 * the top of the page.
 */
export function FeaturedStory({ article }: { article: EnrichedArticle }) {
  const { analysis, triage } = article;

  const verdict = analysis?.catalystKind
    ? CATALYST_LABELS[analysis.catalystKind].label
    : triage?.kind === "catalyst"
      ? "זרז אפשרי"
      : triage?.kind === "noise"
        ? "רעש"
        : null;

  return (
    <article className="surface interactive flex flex-col overflow-hidden">
      {article.image && (
        <div
          className="relative h-48 w-full bg-overlay bg-cover bg-center sm:h-60"
          style={{ backgroundImage: `url(${article.image})` }}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--color-surface)_2%,transparent_70%)]" />
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {analysis && (
            <span className="badge" style={{ color: "var(--color-accent)" }}>
              {SIGNIFICANCE_LABELS[analysis.significance]}
            </span>
          )}
          {verdict && <span className="badge">{verdict}</span>}
          <span className="ms-auto text-[11px] text-ink-ghost" dir="auto">
            {article.domain}
            {article.seenAt && ` · ${fmtRelative(new Date(article.seenAt))}`}
          </span>
        </div>

        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[20px] font-bold leading-tight tracking-tight text-ink transition-colors hover:text-accent sm:text-[24px]"
          dir="auto"
        >
          {article.title}
        </a>

        {analysis ? (
          <div className="mt-4 space-y-3">
            <p className="text-[14px] leading-relaxed text-ink-muted">
              {analysis.summary}
            </p>
            <p className="text-[13px] leading-relaxed text-ink-faint">
              <span className="text-ink-muted">השפעה: </span>
              {analysis.impact}
            </p>

            {/* On the lead story the lenses are open rather than folded
                away. This is the one article the reader is most likely to
                actually want the full reading of. */}
            {(analysis.catalyst || analysis.reaction || analysis.chain) && (
              <dl className="grid gap-3 border-t border-line pt-3 sm:grid-cols-3">
                {[
                  { label: "זרז או רעש", body: analysis.catalyst },
                  { label: "תגובת מחיר", body: analysis.reaction },
                  { label: "שרשרת הערך", body: analysis.chain },
                ]
                  .filter((lens) => lens.body)
                  .map((lens) => (
                    <div key={lens.label}>
                      <dt className="eyebrow">{lens.label}</dt>
                      <dd className="mt-1.5 text-[12px] leading-relaxed text-ink-faint">
                        {lens.body}
                      </dd>
                    </div>
                  ))}
              </dl>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {article.excerpt && (
              <p
                className="text-[13px] leading-relaxed text-ink-muted"
                dir="auto"
              >
                {article.excerpt}
              </p>
            )}
            {triage && (
              <p className="text-[12px] leading-relaxed text-ink-ghost">
                <span className="text-ink-faint">סיווג ראשוני: </span>
                {triage.reason}
              </p>
            )}
          </div>
        )}

        {(analysis?.tickers.length || article.tickers.length) > 0 && (
          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
            {[...new Set([...(analysis?.tickers ?? []), ...article.tickers])]
              .slice(0, 6)
              .map((ticker) => (
                <Link
                  key={ticker}
                  href={`/company/${ticker}`}
                  className="num rounded border border-line px-2 py-0.5 text-[11px] text-ink-faint transition-colors hover:border-line-strong hover:text-ink"
                >
                  {ticker}
                </Link>
              ))}
          </div>
        )}
      </div>
    </article>
  );
}
