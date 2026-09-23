import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getQuotes } from "@/lib/sources/finnhub";

/**
 * Live quotes for the client to poll.
 *
 * Why polling and not a WebSocket: Finnhub's socket takes the API key in the
 * connection URL, so opening it from the browser would publish the key to
 * anyone who looks at the network tab. Proxying the socket server-side is the
 * usual answer, but Vercel's Hobby runtime has no long-lived process to hold
 * the connection open. Polling through this route keeps the key on the
 * server, and at a 15-second cadence the difference is invisible for a
 * medium-term research tool.
 *
 * The cache is the part that matters for the rate limit. Finnhub's free tier
 * allows 60 calls per minute; eleven symbols refreshed every 15 seconds is 44
 * calls per minute from ONE viewer. Without a shared cache, a second viewer
 * would break the limit. With it, any number of viewers cost the same as one.
 */

export const dynamic = "force-dynamic";

const CACHE_SECONDS = 15;
const MAX_SYMBOLS = 20;

const fetchQuotes = (symbols: string[]) =>
  unstable_cache(
    () => getQuotes(symbols),
    ["live-quotes", symbols.join(",")],
    { revalidate: CACHE_SECONDS, tags: ["quotes"] },
  )();

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("symbols") ?? "";

  const symbols = [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z.\-]{1,10}$/.test(s)),
    ),
  ].slice(0, MAX_SYMBOLS);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "no valid symbols" }, { status: 400 });
  }

  try {
    const quotes = await fetchQuotes(symbols);

    // A symbol whose fetch failed comes back as null and stays null. The
    // client then keeps showing the previous price rather than blanking the
    // row, which is the honest behaviour: the last known price is real, it
    // is just not current.
    const payload = symbols.map((symbol, i) => {
      const quote = quotes[i];
      return quote
        ? {
            symbol,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            high: quote.high,
            low: quote.low,
            at: quote.at.toISOString(),
          }
        : { symbol, price: null };
    });

    return NextResponse.json(
      { quotes: payload, fetchedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "quotes unavailable" }, { status: 503 });
  }
}
