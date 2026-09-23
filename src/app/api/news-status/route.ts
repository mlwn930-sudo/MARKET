import { NextResponse } from "next/server";
import { feedSignature, getLiveFeed } from "@/lib/live-news";

/**
 * Whether the news on the page is still the news we have.
 *
 * The client polls this and only pulls the page again when the answer is no.
 * Polling the news page itself would re-render every article every minute to
 * discover, almost always, that nothing happened.
 *
 * What it returns is a signature of the content, not a timestamp. The feed is
 * rebuilt on a fixed cache interval whether or not anything arrived, so a
 * timestamp changes constantly and would have the page refreshing — and
 * announcing that it refreshed — every couple of minutes over an unchanged
 * story list. The signature only moves when an article does.
 *
 * The analysed count is part of it because the feed and its reading arrive
 * separately: the scheduled job writes the three-lens analysis for stories
 * that are already on the page, which changes nothing about the list and is
 * still worth showing.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const feed = await getLiveFeed();

    return NextResponse.json(
      {
        signature: feedSignature(feed),
        analysed: feed.analysedCount,
        total: feed.totalCount,
        refreshedAt: feed.refreshedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "feed unavailable" }, { status: 503 });
  }
}
