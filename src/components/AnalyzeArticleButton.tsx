"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
// From news-shape and not news-store: the store reads files, and importing
// it here would pull node:fs into the browser bundle.
import { CATALYST_LABELS, type ArticleSummary } from "@/lib/news-shape";

/**
 * Read this story now.
 *
 * The scheduled job analyses the feed every cycle and will reach this story
 * eventually — but "eventually" is up to half an hour, and the story a
 * reader is looking at is the one they want read. So the button exists, and
 * it is the only place on the site where a visitor can spend a model call.
 *
 * Which is why it is a button and not something that happens on scroll. The
 * free tier is a few hundred calls a day shared with the news job; a feed
 * that analysed every card it rendered would spend the day's quota on one
 * page view, and the analysis the scheduled job writes for everyone would
 * stop appearing.
 *
 * The result is shown here and not stored. Writing it into the analysis file
 * would need a writable filesystem, which Vercel does not give us, so a
 * reader who reloads sees the card as it was — plus a cached answer if they
 * press again, because the route caches by URL for a day.
 */
export function AnalyzeArticleButton({
  url,
  title,
  auto = false,
  order = 0,
}: {
  url: string;
  title: string;
  /**
   * Analyse without being asked.
   *
   * The feed is supposed to arrive read, not with a row of buttons on it.
   * But a page that fires twenty model calls the moment it opens spends
   * the day's free quota on one visit, so the page marks only its first
   * few unread stories as `auto` and the rest keep the button.
   */
  auto?: boolean;
  /** Position in the auto queue. Calls are spaced by it. */
  order?: number;
}) {
  const [analysis, setAnalysis] = useState<ArticleSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Guards the queued call: a card that scrolled out of the list, or one
   *  the reader pressed first, must not fire a second request. */
  const started = useRef(false);

  const analyse = useCallback(async () => {
    if (started.current) return;
    started.current = true;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/analyze-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, title }),
      });
      const payload = await res.json();

      if (!res.ok) {
        setError(payload?.error ?? "הניתוח נכשל.");
        return;
      }
      setAnalysis(payload.analysis as ArticleSummary);
    } catch {
      setError("הניתוח נכשל. הכתבה עצמה פתוחה בקישור למעלה.");
    } finally {
      setBusy(false);
    }
  }, [url, title]);

  /**
   * The queue.
   *
   * Spaced rather than parallel, because the model client serialises calls
   * anyway and ten at once would simply queue inside the server with the
   * reader watching a row of spinners. Two and a half seconds apart also
   * keeps a page open in a background tab from draining the minute budget
   * the scheduled news job shares.
   */
  useEffect(() => {
    if (!auto || started.current) return;

    const timer = setTimeout(() => analyse(), 600 + order * 2_500);
    return () => clearTimeout(timer);
  }, [auto, order, analyse]);

  if (analysis) {
    const verdict = analysis.catalystKind
      ? CATALYST_LABELS[analysis.catalystKind]
      : null;

    return (
      <div className="mt-3 space-y-2 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge" style={{ color: "var(--color-accent)" }}>
            נותח עכשיו
          </span>
          {verdict && (
            <span className="badge" title={verdict.note}>
              {verdict.label}
            </span>
          )}
        </div>

        <p className="text-[13px] leading-relaxed text-ink-muted">
          {analysis.summary}
        </p>
        <p className="text-[12px] leading-relaxed text-ink-faint">
          <span className="text-ink-muted">השפעה: </span>
          {analysis.impact}
        </p>

        {(analysis.catalyst || analysis.reaction || analysis.chain) && (
          <details>
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
                    <dt className="text-[10px] text-ink-ghost">{lens.label}</dt>
                    <dd className="text-[12px] leading-relaxed text-ink-muted">
                      {lens.body}
                    </dd>
                  </div>
                ))}
            </dl>
          </details>
        )}

        {analysis.tickers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {analysis.tickers.slice(0, 5).map((ticker) => (
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

        <p className="pt-1 text-[10px] leading-relaxed text-ink-ghost">
          נכתב על ידי מודל שפה מטקסט הכתבה בלבד. הוא אינו ממליץ ואינו מדרג.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <button
        type="button"
        onClick={analyse}
        disabled={busy}
        className="btn btn-ghost px-2.5 py-1 text-[11px]"
      >
        {busy ? "קורא את הכתבה…" : auto ? "ממתין בתור לניתוח" : "נתח כתבה"}
      </button>
      {error && (
        <p className="mt-2 text-[11px] leading-relaxed text-ink-ghost">{error}</p>
      )}
    </div>
  );
}
