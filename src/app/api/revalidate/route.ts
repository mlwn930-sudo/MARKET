import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

/**
 * Throw away what the site has cached and fetch it again.
 *
 * Every expensive thing on this site is cached behind a tag — quotes for
 * seconds, filings for an hour, the daily brief for half an hour — and
 * that is what keeps it inside three free tiers. The cost is that a
 * reader who wants to know whether something changed *right now* has no
 * way to ask.
 *
 * Reloading the page does not answer it either: a browser refresh
 * re-renders from the same server cache and returns the same figures,
 * which looks exactly like a market that did not move. This route is the
 * difference between "nothing changed" and "nothing was fetched".
 *
 * It only invalidates. It does not fetch anything itself, so it is cheap
 * and cannot fail halfway: the next render pulls what it needs.
 */

export const dynamic = "force-dynamic";

/** What a reader can ask to be re-fetched, and what that costs upstream.
 *  `company` is the expensive one — it drops the SEC filings cache, and
 *  the next company page view re-downloads a document measured in
 *  megabytes. */
const SCOPES: Record<string, string[]> = {
  quotes: ["quotes", "prices", "tase"],
  news: ["news"],
  company: ["company"],
  macro: ["macro"],
  brief: ["brief"],
  all: ["quotes", "prices", "tase", "news", "company", "macro", "brief"],
};

export async function POST(request: Request) {
  let scope = "all";
  let ticker: string | null = null;

  try {
    const body = await request.json();
    if (typeof body?.scope === "string" && body.scope in SCOPES) {
      scope = body.scope;
    }
    if (typeof body?.ticker === "string" && /^[A-Z.\-]{1,10}$/i.test(body.ticker)) {
      ticker = body.ticker.toUpperCase();
    }
  } catch {
    // No body is a valid request: refresh everything.
  }

  const tags = [...SCOPES[scope]];

  // A company page asks for its own symbol as well as the shared tags, so
  // one reader refreshing NVDA does not drop the cache for every other
  // company someone else is reading.
  if (ticker) tags.push(`company:${ticker}`, `prices:${ticker}`);

  for (const tag of tags) revalidateTag(tag);

  return NextResponse.json(
    { revalidated: tags, at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
