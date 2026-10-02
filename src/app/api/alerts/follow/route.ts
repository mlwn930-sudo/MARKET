import { NextResponse } from "next/server";
import { follow, unfollow, watchedBy } from "@/lib/alerts/subscribers";
import { followedMessage, mailConfigured, sendMail } from "@/lib/alerts/mailer";
import { normalizeEmail } from "@/lib/alerts/subscribers";
import { getArticlesForTicker } from "@/lib/news-store";
import { getFundamentalsFile } from "@/lib/fundamentals-store";

/**
 * The browser telling the server what this reader follows.
 *
 * The watchlist still lives in localStorage and still works there for
 * anyone who never gave an address. This route is the copy the scheduled
 * job can read, because that job runs on a machine with no browser and
 * cannot otherwise answer "only the companies I follow".
 *
 * It does not create subscribers. An address that was never approved can
 * record a watchlist — which is harmless, it is only a list of tickers —
 * but will never be mailed, because the sender reads from the approved
 * list and joins against this one. Following is not consent to be mailed;
 * the approval step is, and it stays separate.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function origin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  let body: {
    email?: unknown;
    ticker?: unknown;
    action?: unknown;
    tickers?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const email = normalizeEmail(String(body.email ?? ""));
  const action = String(body.action ?? "");

  /* One request for a whole list.
   *
   * A watchlist that existed in the browser before any of this was built
   * has to reach the server somehow, and it only changes when the reader
   * touches it — so without this it would never arrive. Sending it a
   * ticker at a time would be a request per company on every first load;
   * this is one.
   *
   * It REPLACES. Add and remove both have to reach the agent without
   * anybody thinking about it, which is the whole point of a watchlist —
   * so the server list becomes exactly the browser list.
   *
   * The additive version guarded against a second device wiping the list,
   * and that guard is given up deliberately: on a private site with one
   * reader it was protecting against a case that does not happen, at the
   * cost of the case that does — unfollowing a company and still being
   * mailed about it.
   *
   * One thing it will not do is empty the list from an empty request. A
   * browser that has not finished restoring localStorage, or a page that
   * loaded before the list was read, would otherwise unfollow everything;
   * an empty list arrives often and means "I do not know yet" far more
   * often than it means "I follow nothing". Clearing the last company is
   * done by unfollowing it, which is an explicit act. */
  if (action === "replace") {
    if (!email) {
      return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    }
    const raw = Array.isArray(body.tickers) ? body.tickers : [];
    const list = [
      ...new Set(
        raw
          .map((t) => String(t).trim().toUpperCase())
          .filter((t) => /^[A-Z.-]{1,10}$/.test(t)),
      ),
    ].slice(0, 200);

    if (list.length === 0) {
      return NextResponse.json({
        ok: true,
        added: 0,
        removed: 0,
        skipped: "empty",
        following: await watchedBy(email),
      });
    }

    const existing = new Set(await watchedBy(email));
    const wanted = new Set(list);

    let added = 0;
    for (const ticker of list) {
      if (existing.has(ticker)) continue;
      if (await follow(email, ticker)) added++;
    }

    let removed = 0;
    for (const ticker of existing) {
      if (wanted.has(ticker)) continue;
      if (await unfollow(email, ticker)) removed++;
    }
    /* No mail here. This is a reconciliation of what the reader already
       chose, possibly months ago — a burst of "you are now following"
       messages for companies they have followed all along would be the
       single most annoying thing this feature could do on first run. */
    return NextResponse.json({
      ok: true,
      added,
      removed,
      following: await watchedBy(email),
    });
  }

  const ticker = String(body.ticker ?? "")
    .trim()
    .toUpperCase();

  if (!email || !/^[A-Z.\-]{1,10}$/.test(ticker)) {
    return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
  }
  if (action !== "follow" && action !== "unfollow") {
    return NextResponse.json({ ok: false, error: "bad action" }, { status: 400 });
  }

  if (action === "unfollow") {
    const ok = await unfollow(email, ticker);
    return NextResponse.json({ ok, following: ok ? await watchedBy(email) : [] });
  }

  /* Already following is not an error and is not a second email. The star
     can be toggled twice in a second by a misclick, and a confirmation per
     click is how a useful message becomes noise. */
  const before = await watchedBy(email);
  const alreadyFollowing = before.includes(ticker);

  const ok = await follow(email, ticker);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "no store" },
      { status: 503 },
    );
  }

  if (!alreadyFollowing && mailConfigured()) {
    /* Everything the message carries, gathered here rather than in the
       mailer: the mailer formats, it does not fetch. */
    const [articles, fundamentals] = await Promise.all([
      getArticlesForTicker(ticker, 1).catch(() => []),
      getFundamentalsFile().catch(() => null),
    ]);
    const name =
      fundamentals?.companies.find((c) => c.ticker === ticker)?.name ?? ticker;
    const latest = articles[0] ?? null;
    const base = origin(request);

    const message = followedMessage({
      ticker,
      name,
      story: latest
        ? {
            title: latest.title,
            url: latest.url,
            domain: latest.domain,
            summary: latest.analysis?.summary ?? null,
            impact: latest.analysis?.impact ?? null,
          }
        : null,
      companyUrl: `${base}/company/${ticker}`,
      unsubscribeUrl: `${base}/api/alerts/unsubscribe?email=${encodeURIComponent(email)}`,
    });

    const sent = await sendMail({ to: email, ...message });
    if (!sent.ok) {
      /* The follow is recorded either way. A mail that did not go out is
         worth a server log and is not worth failing the click the reader
         just made. */
      console.error("[alerts] follow mail not sent:", sent.reason, sent.detail ?? "");
    }
  }

  return NextResponse.json({ ok: true, following: await watchedBy(email) });
}
