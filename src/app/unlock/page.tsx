import type { Metadata } from "next";

/**
 * The door.
 *
 * Deliberately the plainest page on the site. It says nothing about
 * what is behind it, carries no figures, and makes no claim — a locked
 * site that advertises its contents on the lock has not locked much.
 *
 * A plain form with no client JavaScript: it works before hydration,
 * the browser's own password manager recognises it, and there is no
 * state to get wrong.
 */

export const metadata: Metadata = {
  title: "כניסה · Market Intel",
  description: "האתר נעול.",
  robots: { index: false, follow: false },
};

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; bad?: string }>;
}) {
  const { from = "/", bad } = await searchParams;

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center px-4">
      <h1 className="text-[15px] font-semibold tracking-[0.06em] text-ink">
        MARKET INTEL
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
        האתר נעול. הוא אתר מחקר פרטי ואינו פתוח לציבור.
      </p>

      <form action="/api/unlock" method="post" className="mt-6 grid gap-3">
        <input type="hidden" name="from" value={from} />
        <label className="grid gap-1.5">
          <span className="text-[12px] text-ink-faint">סיסמה</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            autoFocus
            required
            dir="ltr"
            className="rounded border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
          />
        </label>

        {bad === "1" && (
          /* No detail, on purpose: "wrong password" and "no such user"
             are the same sentence here because there are no users. */
          <p className="text-[12px] text-down">הסיסמה שגויה.</p>
        )}

        <button type="submit" className="btn-primary mt-1">
          כניסה
        </button>
      </form>
    </main>
  );
}
