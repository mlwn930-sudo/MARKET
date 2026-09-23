import { NextResponse } from "next/server";
import { getEnrichedFeed } from "@/lib/news-store";

/**
 * When the news feed was last rebuilt.
 *
 * Deliberately tiny: the client polls this to find out whether anything has
 * changed, and only pulls the page again when the answer is yes. Polling
 * the news page itself would re-render every article every few minutes to
 * discover, almost always, that nothing happened.
 *
 * `analysed` is included because the feed and its analysis arrive
 * separately — the refresh workflow fetches articles first and writes the
 * Hebrew reading afterwards. A cycle that adds analysis to stories already
 * on the page changes this count without changing the timestamp, and that
 * is still a page worth refreshing.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { refreshedAt, analysedCount, totalCount } = await getEnrichedFeed();

    return NextResponse.json(
      { refreshedAt, analysed: analysedCount, total: totalCount },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "feed unavailable" }, { status: 503 });
  }
}
