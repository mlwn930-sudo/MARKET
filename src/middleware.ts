import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, accessToken, sameToken, sitePassword } from "@/lib/access";

/**
 * Nothing is served until the password has been entered.
 *
 * Runs before any page or route, so a locked site never renders a
 * conclusion to somebody who should not see one — the check cannot be
 * forgotten on a new page, because new pages do not opt in.
 *
 * WHAT IS DELIBERATELY NOT BEHIND IT:
 *
 *   /unlock and /api/unlock   the door itself.
 *   /api/alerts/unsubscribe   an unsubscribe link that needs a password
 *                             is a broken unsubscribe link, and the
 *                             alerts go to one address that is already
 *                             the owner's.
 *   /api/alerts/decide        clicked from an email, often on a phone
 *                             that has never had the cookie. Its
 *                             security is the token in its own URL and
 *                             that is unchanged by this file.
 *   _next, favicon, robots    assets and the crawler note. Gating them
 *                             buys nothing and breaks the unlock page's
 *                             own styling.
 *
 * Everything else — every page, the chart reader, the question agent,
 * the watchlist, every other route — requires the cookie.
 *
 * THE OPENGRAPH IMAGES ARE GATED, which is a change from the first
 * version of this list. They are rendered pictures of the content: a
 * company's figures, the site's own summary. A locked site that still
 * hands anyone a rendered preview of what is behind the lock has not
 * locked the thing that matters. Checked first that nothing depends on
 * them being public — the alert mailer builds links, not image tags —
 * so the only cost is that a link pasted into a chat app shows no
 * thumbnail, which is the correct behaviour for a private site.
 */

export const config = {
  matcher: [
    /* Everything except the door, the two email endpoints, and static
       assets. Written as one negative lookahead because Next evaluates
       the matcher at build time and cannot take a runtime expression. */
    "/((?!_next/static|_next/image|favicon|icon|apple-icon|robots.txt|unlock|api/unlock|api/alerts/unsubscribe|api/alerts/decide).*)",
  ],
};

export async function middleware(request: NextRequest) {
  const password = sitePassword();

  /* No password configured: the site behaves exactly as it did before
     this file existed. See the note in `access.ts` on why that is the
     safe default rather than the dangerous one. */
  if (!password) return NextResponse.next();

  const expected = await accessToken(password);
  const presented = request.cookies.get(ACCESS_COOKIE)?.value;
  if (presented && sameToken(presented, expected)) return NextResponse.next();

  /* An API call gets a status, not a redirect to an HTML form. A fetch
     that receives a 302 to a page follows it and parses the login
     markup as JSON, and the error the caller reports is a parse failure
     in a component rather than "you are locked out". */
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "האתר נעול. היכנסו דרך עמוד הכניסה." },
      { status: 401 },
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = "";
  /* Where to go back to. Only a path from this site is ever used — see
     the validation in the unlock route, which is what stops this being
     an open redirect. */
  url.searchParams.set("from", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}
