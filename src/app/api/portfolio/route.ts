import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/sources/finnhub";
import { getFundamentalsFile } from "@/lib/fundamentals-store";
import { SECTOR_LABELS, type SectorKey } from "@/lib/universe";

/**
 * What a portfolio is made of, measured.
 *
 * Deliberately does not score the portfolio or suggest what to hold. It
 * measures four things the reader cannot see by looking at a list of
 * tickers, and each one is a fact about the holdings rather than an
 * opinion about them:
 *
 *   Concentration — how much of the money sits in the largest position,
 *   and the Herfindahl index of the whole thing, which is the standard way
 *   to say "this is really two bets wearing a coat".
 *
 *   Sector exposure — five semiconductor companies is one position, not
 *   five, and that is the single most common way a portfolio that looks
 *   diversified is not.
 *
 *   Valuation — the weighted multiple, so "what am I paying" has an
 *   answer at the portfolio level rather than per row.
 *
 *   Quality mix — how much of the money is in companies that pass this
 *   site's core checks, and how much is in companies it cannot evaluate.
 *
 * Everything comes from the precomputed universe file plus a live quote,
 * so this is cheap and cannot fabricate: a holding the site has no
 * fundamentals for is reported as unmeasured rather than assumed average.
 */

export const dynamic = "force-dynamic";

const MAX_HOLDINGS = 25;

type Incoming = { ticker: string; weight: number };

export async function POST(request: Request) {
  let body: { holdings?: Incoming[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const holdings = (body.holdings ?? [])
    .filter(
      (h): h is Incoming =>
        typeof h?.ticker === "string" &&
        /^[A-Z.\-]{1,10}$/.test(h.ticker.trim().toUpperCase()) &&
        Number.isFinite(h?.weight) &&
        h.weight > 0,
    )
    .map((h) => ({ ticker: h.ticker.trim().toUpperCase(), weight: h.weight }))
    .slice(0, MAX_HOLDINGS);

  if (holdings.length === 0) {
    return NextResponse.json({ rows: [], summary: null });
  }

  const total = holdings.reduce((sum, h) => sum + h.weight, 0);
  const tickers = holdings.map((h) => h.ticker);

  const [quotes, fundamentals] = await Promise.all([
    getQuotes(tickers).catch(() => []),
    getFundamentalsFile(),
  ]);

  const rows = holdings.map((holding, index) => {
    const company = fundamentals.companies.find(
      (c) => c.ticker === holding.ticker,
    );
    const quote = quotes[index] ?? null;
    const share = (holding.weight / total) * 100;

    return {
      ticker: holding.ticker,
      name: company?.name ?? null,
      sector: company
        ? (SECTOR_LABELS[company.sector as SectorKey] ?? company.sector)
        : null,
      share,
      price: quote?.price ?? null,
      changePercent: quote?.changePercent ?? null,
      pe: company?.metrics.pe ?? null,
      roic: company?.metrics.roic ?? null,
      netDebtEbitda: company?.metrics.net_debt_ebitda ?? null,
      revenueGrowth: company?.metrics.rev_cagr_3 ?? null,
      /** False when the site has no fundamentals for it — reported, never
       *  filled in with a sector average. */
      measured: Boolean(company),
    };
  });

  /* ---- Concentration ---- */
  const shares = rows.map((row) => row.share);
  const largest = Math.max(...shares);
  // Herfindahl on fractions, expressed as an effective number of positions:
  // 1/HHI answers "how many equally weighted holdings would feel like this".
  const hhi = shares.reduce((sum, s) => sum + (s / 100) ** 2, 0);
  const effectivePositions = hhi > 0 ? 1 / hhi : 0;

  /* ---- Sector exposure ---- */
  const bySector = new Map<string, number>();
  for (const row of rows) {
    const key = row.sector ?? "לא מסווג באתר";
    bySector.set(key, (bySector.get(key) ?? 0) + row.share);
  }
  const sectors = [...bySector.entries()]
    .map(([sector, share]) => ({ sector, share }))
    .sort((a, b) => b.share - a.share);

  /* ---- Weighted figures, over the measured part only ---- */
  const measured = rows.filter((row) => row.measured);
  const measuredShare = measured.reduce((sum, row) => sum + row.share, 0);

  const weighted = (pick: (row: (typeof rows)[number]) => number | null) => {
    const usable = measured.filter(
      (row) => pick(row) !== null && Number.isFinite(pick(row)!),
    );
    const weight = usable.reduce((sum, row) => sum + row.share, 0);
    if (weight === 0) return null;
    return (
      usable.reduce((sum, row) => sum + pick(row)! * row.share, 0) / weight
    );
  };

  return NextResponse.json(
    {
      rows: rows.sort((a, b) => b.share - a.share),
      summary: {
        holdings: rows.length,
        largestShare: largest,
        effectivePositions,
        sectors,
        topSectorShare: sectors[0]?.share ?? 0,
        topSector: sectors[0]?.sector ?? null,
        measuredShare,
        weightedPe: weighted((row) => row.pe),
        weightedRoic: weighted((row) => row.roic),
        weightedLeverage: weighted((row) => row.netDebtEbitda),
        weightedGrowth: weighted((row) => row.revenueGrowth),
        dayChange: weighted((row) => row.changePercent),
      },
      checkedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
