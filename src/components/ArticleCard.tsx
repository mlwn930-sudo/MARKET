import Link from "next/link";
import {
  CATALYST_LABELS,
  SIGNIFICANCE_LABELS,
  type EnrichedArticle,
} from "@/lib/news-store";
import { fmtRelative } from "@/lib/format";

/**
 * One story, with whatever analysis exists for it.
 *
 * The image is decorative and deliberately fails quietly: publishers move
 * and expire them constantly, and a broken image icon in the middle of a
 * feed looks worse than no image at all.
 *
 * Significance is a label, never a colour. Green and red mean price
 * direction everywhere on this site, and a consequential story is neither
 * good nor bad until you know which side of it you are on.
 */
export function ArticleCard({
  article,
  accent,
}: {
  article: EnrichedArticle;
  accent: string;
}) {
  const { analysis } = article;
  const isMajor = analysis?.significance === "high";

  return (
    <article
      className="group relative overflow-hidden panel panel-interactive"
      style={isMajor ? { borderInlineStartWidth: 2, borderInlineStartColor: accent } : undefined}
    >
      {article.image && (
        // Painted as a background rather than an <img> on purpose. Publisher
        // images expire and move constantly, and a background that fails to
        // load simply shows the surface colour — where a broken <img> shows
        // a torn-page icon in the middle of the feed.
        <div
          className="relative h-32 w-full bg-surface-raised bg-cover bg-center"
          style={{ backgroundImage: `url(${article.image})` }}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-medium leading-snug text-ink hover:underline"
            dir="auto"
          >
            {article.title}
          </a>
          {analysis && (
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span
                className="rounded-full border px-2 py-0.5 text-[10px]"
                style={{ borderColor: `${accent}55`, color: accent }}
              >
                {SIGNIFICANCE_LABELS[analysis.significance]}
              </span>

              {/* Shown on the card rather than hidden in the detail, because
                  "this one changes nothing" is the single most useful thing
                  the feed can tell a reader who is scanning it. */}
              {analysis.catalystKind && (
                <span
                  className="rounded-full border border-line px-2 py-0.5 text-[10px] text-ink-muted"
                  title={CATALYST_LABELS[analysis.catalystKind].note}
                >
                  {CATALYST_LABELS[analysis.catalystKind].label}
                </span>
              )}
            </div>
          )}
        </div>

        {analysis ? (
          <div className="mt-3 space-y-2">
            <p className="text-[13px] leading-relaxed text-ink">
              {analysis.summary}
            </p>
            <p className="text-[12px] leading-relaxed text-ink-muted">
              <span style={{ color: accent }}>השפעה: </span>
              {analysis.impact}
            </p>

            {/* The three lenses, when the analysis carries them. Collapsed
                by default: the feed's job is to be scannable, and a reader
                who wants the full reading of one story opens that story. */}
            {(analysis.catalyst || analysis.reaction || analysis.chain) && (
              <details className="pt-1">
                <summary className="cursor-pointer text-[11px] text-ink-faint transition-colors hover:text-ink-muted">
                  ניתוח בשלוש עדשות
                </summary>

                <div className="mt-2 space-y-2 border-t border-line pt-2">
                  {analysis.catalyst && (
                    <div>
                      <span className="text-[11px] text-ink-faint">
                        זרז או רעש
                        {analysis.catalystKind && (
                          <span className="mr-1.5 text-ink-muted">
                            · {CATALYST_LABELS[analysis.catalystKind].label}
                          </span>
                        )}
                      </span>
                      <p className="text-[12px] leading-relaxed text-ink-muted">
                        {analysis.catalyst}
                      </p>
                    </div>
                  )}

                  {analysis.reaction && (
                    <div>
                      <span className="text-[11px] text-ink-faint">
                        תגובת מחיר מול ציפיות
                      </span>
                      <p className="text-[12px] leading-relaxed text-ink-muted">
                        {analysis.reaction}
                      </p>
                    </div>
                  )}

                  {analysis.chain && (
                    <div>
                      <span className="text-[11px] text-ink-faint">
                        שרשרת הערך
                      </span>
                      <p className="text-[12px] leading-relaxed text-ink-muted">
                        {analysis.chain}
                      </p>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        ) : (
          article.excerpt && (
            <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-ink-muted" dir="auto">
              {article.excerpt}
            </p>
          )
        )}

        {(analysis?.tickers.length || article.tickers.length) > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {[
              ...new Set([
                ...(analysis?.tickers ?? []),
                ...article.tickers,
              ]),
            ]
              .slice(0, 5)
              .map((ticker) => (
                <Link
                  key={ticker}
                  href={`/company/${ticker}`}
                  className="num rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
                >
                  {ticker}
                </Link>
              ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-ink-faint">
          <span dir="auto">{article.domain}</span>
          {article.seenAt && (
            <>
              <span>·</span>
              <span>{fmtRelative(new Date(article.seenAt))}</span>
            </>
          )}
          {!analysis && <span>· ממתין לניתוח</span>}
        </div>
      </div>
    </article>
  );
}
