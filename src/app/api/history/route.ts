import { NextResponse } from "next/server";
import { getRangeHistory, RANGES, type RangeKey } from "@/lib/sources/prices";

/**
 * Candles for one symbol at one range.
 *
 * Exists so the chart can change range without a navigation. The page still
 * renders its default range on the server — the first chart a reader sees
 * is never a loading state — and this route serves only the ranges they ask
 * for afterwards.
 *
 * Cached by the source layer, so several readers switching to the same
 * range cost one upstream request between them.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const symbol = (params.get("symbol") ?? "").trim().toUpperCase();
  const range = (params.get("range") ?? "") as RangeKey;

  if (!/^[A-Z.\-]{1,10}$/.test(symbol)) {
    return NextResponse.json({ error: "bad symbol" }, { status: 400 });
  }
  if (!(range in RANGES)) {
    return NextResponse.json({ error: "bad range" }, { status: 400 });
  }

  const history = await getRangeHistory(symbol, range);
  if (!history) {
    return NextResponse.json({ error: "no history" }, { status: 404 });
  }

  return NextResponse.json(
    { symbol: history.symbol, range, candles: history.candles },
    { headers: { "Cache-Control": "no-store" } },
  );
}
