"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * What a reader sees when something on a page throws.
 *
 * Without this file, an unhandled error anywhere in the tree renders
 * Next's own error screen: a stack trace in development, a bare "500" in
 * production. On a site whose entire claim is that it shows its working,
 * an unexplained blank page is the worst possible failure — it is
 * indistinguishable from the site being wrong rather than broken.
 *
 * So it says three things instead. What failed, what is unaffected — most
 * of this site is static files and precomputed metrics, and a provider
 * timing out on one panel does not touch them — and where to go next.
 * The retry button is Next's own reset, which re-renders the segment
 * without a full page load.
 *
 * Deliberately not styled as an alarm. A red panel implies the reader's
 * data is at risk; the honest signal is amber, which everywhere else on
 * this site means a caveat.
 */
export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    /* The server strips the message in production and leaves a digest
       that matches the server log. Printing it here is what makes a
       report from a reader actionable. */
    console.error("[market-intel] page error", error.digest ?? "", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-[860px] px-5 pb-28 sm:px-8">
      <div className="pt-20 sm:pt-28">
        <div className="flex items-center gap-2.5">
          <span
            className="section-mark"
            style={{ background: "var(--color-warning)" }}
            aria-hidden="true"
          />
          <span className="eyebrow">תקלה</span>
        </div>

        <h1 className="display mt-5">משהו בעמוד הזה נכשל</h1>

        <p className="lede mt-5">
          אחד המקורות שהעמוד נשען עליהם לא החזיר תשובה, או שהחזיר נתון בצורה
          שהקוד לא ציפה לה. זו תקלה בצד שלנו — לא שינוי בנתונים ולא ממצא.
        </p>

        <div
          className="surface mt-9 border-s-2 p-6"
          style={{ borderInlineStartColor: "var(--color-warning)" }}
        >
          <h2 className="eyebrow mb-3">מה לא הושפע</h2>
          <p className="text-[13px] leading-relaxed text-ink-muted">
            רוב האתר בנוי מקבצים שנבנו מראש — קובץ המדדים, פיד החדשות,
            היסטוריית התזות — והם לא עוברים דרך העמוד הזה. מקור שנפל בפאנל אחד
            אינו נוגע בהם, וגם לא ברשימת המעקב שנשמרת בדפדפן שלך.
          </p>

          {error.digest && (
            <p className="num mt-4 border-t border-line pt-3.5 text-[11px] text-ink-ghost">
              מזהה התקלה: {error.digest}
            </p>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button type="button" onClick={reset} className="btn btn-primary">
            נסה שוב
          </button>
          <Link href="/" className="btn btn-ghost">
            לעמוד השוק
          </Link>
          <Link href="/intel" className="btn btn-ghost">
            למודיעין
          </Link>
        </div>

        <p className="caption mt-10">
          אם זה חוזר על עצמו באותו עמוד, סביר שספק חיצוני מגביל קצב. הנתונים
          מתרעננים ממילא כל כמה דקות.
        </p>
      </div>
    </main>
  );
}
