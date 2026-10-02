import Link from "next/link";
import {
  CATALYST_LABELS,
  SIGNIFICANCE_LABELS,
  type EnrichedArticle,
} from "@/lib/news-store";
import { fmtRelative } from "@/lib/format";
import { TRIAGE_CAVEAT, triage as classify } from "@/lib/news-triage";
import { AiBlock, AiNote } from "@/components/ui";

/**
 * The first-pass classification, computed here when the article did not
 * arrive carrying one.
 *
 * `article.triage` is attached by the live feed and by the Israeli wire but
 * not by the stored file this page reads — see the note on the field in
 * news-shape.ts. So on /news it is absent for every article, and every
 * branch that read it was unreachable: an article with no model reading
 * fell through to a blank where the reading belongs.
 *
 * `classify` is a pure function over the headline and the excerpt. It costs
 * nothing, it is the same classifier the live feed already shows, and it is
 * a real finding rather than an apology for a missing one. The caveat
 * printed beside it says plainly that it read the headline, not the article.
 */
function firstPass(article: EnrichedArticle) {
  return article.triage ?? classify(article.title, article.excerpt ?? "");
}

/**
 * The lead story.
 *
 * It is marked as the lead by its type — a size larger than the column
 * beside it — and by carrying the model's full reading where the column
 * carries a short one. It once carried the publisher's photograph as well;
 * see the note where that band used to be for why it does not any more.
 */
export function FeaturedStory({ article }: { article: EnrichedArticle }) {
  const { analysis } = article;

  const first = analysis ? null : firstPass(article);
  const verdict = analysis?.catalystKind
    ? CATALYST_LABELS[analysis.catalystKind].label
    : first?.kind === "catalyst"
      ? "זרז אפשרי"
      : first?.kind === "noise"
        ? "רעש"
        : null;

  return (
    <article className="surface interactive flex flex-col overflow-hidden">
      {/* The publisher's photograph used to fill this band, hotlinked
          straight from their server — including Getty-licensed images, with
          no licence and no credit, and displayed as though it belonged to
          the page. A headline and a link to the source is ordinary
          reporting; republishing the photograph that came with it is not.

          The lead story is already marked as the lead by its type, which is
          a size larger than the column beside it. It did not need the
          picture to read as the lead; it needed it to look like a
          magazine. */}

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
            {article.excerpt && (
              <div className="rounded-md border border-line bg-element/60 p-4">
                <div className="mb-1.5 text-[10px] font-medium tracking-[0.08em] text-ink-ghost">
                  מהמקור
                </div>
                <p className="text-[13px] leading-relaxed text-ink-muted" dir="auto">
                  {article.excerpt}
                </p>
              </div>
            )}

            <AiBlock
              title="קריאת מודל"
              confidence={analysis.catalystKind === "unclear" ? "low" : "medium"}
              sources={[article.domain]}
              at={analysis.writtenAt ? fmtRelative(new Date(analysis.writtenAt)) : undefined}
            >
              <p className="text-[14px] leading-relaxed text-ink-muted">
                {analysis.summary}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
                <span className="text-ink-muted">השפעה: </span>
                {analysis.impact}
              </p>

              {(analysis.catalyst || analysis.reaction || analysis.chain) && (
                <dl className="mt-4 grid gap-3 border-t border-line pt-3 sm:grid-cols-3">
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
            </AiBlock>
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
            {first && (
              <div className="space-y-1">
                <p className="text-[12px] leading-relaxed text-ink-muted">
                  <span className="text-ink-faint">סיווג ראשוני: </span>
                  {first.reason}
                </p>
                <p className="text-[11px] leading-relaxed text-ink-ghost">
                  {TRIAGE_CAVEAT}
                </p>
              </div>
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

/**
 * One item in the column beside the lead.
 *
 * It used to be a headline, a domain and — only if analysis existed — two
 * clamped lines of the summary with no marking and nothing else. So the
 * four most prominent stories after the lead were the thinnest cards on a
 * page whose whole claim is that it reads the news rather than listing it,
 * and an unanalysed item in that column showed a bare headline under a
 * heading promising analysis.
 *
 * This carries the same things every other card on the site carries — the
 * verdict, the model's reading marked as a model's, the impact line, and
 * the companies it touches — at the size the slot allows. When no reading
 * exists it says so and shows the first-pass classification instead, which
 * is a real finding and is already computed; silence there reads as a
 * story nobody thought worth explaining.
 */
export function ColumnStory({ article }: { article: EnrichedArticle }) {
  const { analysis } = article;

  const first = analysis ? null : firstPass(article);
  const verdict = analysis?.catalystKind
    ? CATALYST_LABELS[analysis.catalystKind].label
    : first?.kind === "catalyst"
      ? "זרז אפשרי"
      : first?.kind === "noise"
        ? "רעש"
        : null;

  const tickers = [
    ...new Set([...(analysis?.tickers ?? []), ...article.tickers]),
  ].slice(0, 3);

  return (
    <div className="p-4">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        {analysis && (
          <span className="badge" style={{ color: "var(--color-accent)" }}>
            {SIGNIFICANCE_LABELS[analysis.significance]}
          </span>
        )}
        {verdict && <span className="badge">{verdict}</span>}
        <span className="ms-auto text-[10px] text-ink-ghost" dir="auto">
          {article.domain}
          {article.seenAt && ` · ${fmtRelative(new Date(article.seenAt))}`}
        </span>
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

      {analysis ? (
        <AiNote className="mt-2.5">
          <p className="text-[12px] leading-relaxed text-ink-muted">
            {analysis.summary}
          </p>
          {analysis.impact && (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">
              <span className="text-ink-muted">השפעה: </span>
              {analysis.impact}
            </p>
          )}
        </AiNote>
      ) : (
        <div className="mt-2.5 space-y-1.5">
          {/* The first pass is cheap and runs right here; the reading in
              three lenses runs on a schedule and can be behind the feed.
              Which of the two a reader is looking at is the whole difference
              between a finding and an unexplained blank. */}
          <p className="text-[11.5px] leading-relaxed text-ink-muted">
            <span className="text-ink-faint">סיווג ראשוני: </span>
            {first?.reason}
          </p>
          <p className="text-[10.5px] leading-relaxed text-ink-ghost">
            {TRIAGE_CAVEAT}
          </p>
        </div>
      )}

      {tickers.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {tickers.map((ticker) => (
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
    </div>
  );
}
