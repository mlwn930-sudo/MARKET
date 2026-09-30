/**
 * The company universe.
 *
 * Two jobs: it is the peer set that sector medians are computed from, and
 * it is the pool the opportunity screener ranks. Both live off the same
 * precomputed file, so adding a company here widens both at once.
 *
 * Sectors are our own labels, assigned by hand. Deriving them from a data
 * provider's industry string sounds tidier but produces groups that are too
 * granular to have a meaningful median — "Semiconductors" and "Semiconductor
 * Equipment" would each end up with two members.
 */

export type SectorKey =
  | "semis"
  | "software"
  | "internet"
  | "healthcare"
  | "financials"
  | "energy"
  | "consumer"
  | "industrials"
  | "telecom";

export const SECTOR_LABELS: Record<SectorKey, string> = {
  semis: "מוליכים למחצה",
  software: "תוכנה",
  internet: "אינטרנט ומדיה",
  healthcare: "בריאות ותרופות",
  financials: "פיננסים",
  energy: "אנרגיה",
  consumer: "צריכה וקמעונאות",
  industrials: "תעשייה",
  telecom: "תקשורת",
};

/**
 * 124 companies, in nine sectors.
 *
 * It was 47, which made the screener a shortlist of megacaps and made a
 * sector median a statement about five companies. Both jobs get better
 * the wider this is: a median over fourteen semiconductor companies is a
 * benchmark, a median over seven was an average of whoever happened to be
 * listed here.
 *
 * Widening this is close to free, and that is worth writing down because
 * it was not always true. Board-level views — the market map, the sector
 * pages, the brief — all read getBoardQuotes, which asks Yahoo's spark
 * endpoint for sixteen symbols per request and caches the result for two
 * minutes. Going from 47 to 124 companies takes that from three requests
 * to eight, every two minutes, for the whole site. Finnhub's sixty-a-
 * minute budget is spent on single company pages, where it is not touched
 * by how long this list is.
 *
 * The real cost is the offline build: one SEC companyfacts document per
 * company, several megabytes each, on a nightly job that is already doing
 * exactly this. It takes longer. Nothing a reader waits for takes longer.
 */
export const UNIVERSE: { ticker: string; sector: SectorKey }[] = [
  { ticker: "NVDA", sector: "semis" },
  { ticker: "AMD", sector: "semis" },
  { ticker: "INTC", sector: "semis" },
  { ticker: "AVGO", sector: "semis" },
  { ticker: "QCOM", sector: "semis" },
  { ticker: "TXN", sector: "semis" },
  { ticker: "MU", sector: "semis" },
  { ticker: "AMAT", sector: "semis" },
  { ticker: "LRCX", sector: "semis" },
  { ticker: "KLAC", sector: "semis" },
  { ticker: "ADI", sector: "semis" },
  { ticker: "NXPI", sector: "semis" },
  { ticker: "MRVL", sector: "semis" },
  { ticker: "MCHP", sector: "semis" },
  { ticker: "ON", sector: "semis" },

  { ticker: "MSFT", sector: "software" },
  { ticker: "ORCL", sector: "software" },
  { ticker: "CRM", sector: "software" },
  { ticker: "ADBE", sector: "software" },
  { ticker: "NOW", sector: "software" },
  { ticker: "INTU", sector: "software" },
  { ticker: "PANW", sector: "software" },
  { ticker: "SNPS", sector: "software" },
  { ticker: "CDNS", sector: "software" },
  { ticker: "ADSK", sector: "software" },
  { ticker: "WDAY", sector: "software" },
  { ticker: "TEAM", sector: "software" },
  { ticker: "DDOG", sector: "software" },
  { ticker: "SNOW", sector: "software" },
  { ticker: "PLTR", sector: "software" },

  { ticker: "GOOGL", sector: "internet" },
  { ticker: "META", sector: "internet" },
  { ticker: "NFLX", sector: "internet" },
  { ticker: "AMZN", sector: "internet" },
  { ticker: "BKNG", sector: "internet" },
  { ticker: "UBER", sector: "internet" },
  { ticker: "ABNB", sector: "internet" },
  { ticker: "DASH", sector: "internet" },
  { ticker: "SHOP", sector: "internet" },
  { ticker: "SPOT", sector: "internet" },
  { ticker: "EBAY", sector: "internet" },
  { ticker: "TTD", sector: "internet" },
  { ticker: "TTWO", sector: "internet" },

  { ticker: "JNJ", sector: "healthcare" },
  { ticker: "PFE", sector: "healthcare" },
  { ticker: "MRK", sector: "healthcare" },
  { ticker: "LLY", sector: "healthcare" },
  { ticker: "ABBV", sector: "healthcare" },
  { ticker: "UNH", sector: "healthcare" },
  { ticker: "TMO", sector: "healthcare" },
  { ticker: "DHR", sector: "healthcare" },
  { ticker: "ABT", sector: "healthcare" },
  { ticker: "AMGN", sector: "healthcare" },
  { ticker: "GILD", sector: "healthcare" },
  { ticker: "BMY", sector: "healthcare" },
  { ticker: "VRTX", sector: "healthcare" },
  { ticker: "REGN", sector: "healthcare" },
  { ticker: "ISRG", sector: "healthcare" },
  { ticker: "CVS", sector: "healthcare" },

  { ticker: "JPM", sector: "financials" },
  { ticker: "BAC", sector: "financials" },
  { ticker: "WFC", sector: "financials" },
  { ticker: "GS", sector: "financials" },
  { ticker: "MS", sector: "financials" },
  { ticker: "C", sector: "financials" },
  { ticker: "V", sector: "financials" },
  { ticker: "MA", sector: "financials" },
  { ticker: "AXP", sector: "financials" },
  { ticker: "BLK", sector: "financials" },
  { ticker: "SCHW", sector: "financials" },
  { ticker: "SPGI", sector: "financials" },
  { ticker: "PGR", sector: "financials" },
  { ticker: "CB", sector: "financials" },
  { ticker: "USB", sector: "financials" },
  { ticker: "PNC", sector: "financials" },

  { ticker: "XOM", sector: "energy" },
  { ticker: "CVX", sector: "energy" },
  { ticker: "COP", sector: "energy" },
  { ticker: "SLB", sector: "energy" },
  { ticker: "EOG", sector: "energy" },
  { ticker: "PSX", sector: "energy" },
  { ticker: "MPC", sector: "energy" },
  { ticker: "VLO", sector: "energy" },
  { ticker: "OXY", sector: "energy" },
  { ticker: "KMI", sector: "energy" },
  { ticker: "WMB", sector: "energy" },

  { ticker: "WMT", sector: "consumer" },
  { ticker: "COST", sector: "consumer" },
  { ticker: "HD", sector: "consumer" },
  { ticker: "NKE", sector: "consumer" },
  { ticker: "MCD", sector: "consumer" },
  { ticker: "AAPL", sector: "consumer" },
  { ticker: "PG", sector: "consumer" },
  { ticker: "KO", sector: "consumer" },
  { ticker: "PEP", sector: "consumer" },
  { ticker: "PM", sector: "consumer" },
  { ticker: "TGT", sector: "consumer" },
  { ticker: "LOW", sector: "consumer" },
  { ticker: "SBUX", sector: "consumer" },
  { ticker: "TJX", sector: "consumer" },
  { ticker: "MDLZ", sector: "consumer" },
  { ticker: "TSLA", sector: "consumer" },
  { ticker: "DIS", sector: "consumer" },

  { ticker: "CAT", sector: "industrials" },
  { ticker: "BA", sector: "industrials" },
  { ticker: "GE", sector: "industrials" },
  { ticker: "HON", sector: "industrials" },
  { ticker: "UNP", sector: "industrials" },
  { ticker: "RTX", sector: "industrials" },
  { ticker: "LMT", sector: "industrials" },
  { ticker: "NOC", sector: "industrials" },
  { ticker: "GD", sector: "industrials" },
  { ticker: "DE", sector: "industrials" },
  { ticker: "MMM", sector: "industrials" },
  { ticker: "UPS", sector: "industrials" },
  { ticker: "FDX", sector: "industrials" },
  { ticker: "ETN", sector: "industrials" },
  { ticker: "EMR", sector: "industrials" },

  { ticker: "T", sector: "telecom" },
  { ticker: "VZ", sector: "telecom" },
  { ticker: "TMUS", sector: "telecom" },
  { ticker: "CMCSA", sector: "telecom" },
  { ticker: "CHTR", sector: "telecom" },
];

export function sectorOf(ticker: string): SectorKey | null {
  return (
    UNIVERSE.find((c) => c.ticker === ticker.toUpperCase())?.sector ?? null
  );
}

/** Median, ignoring nulls. Returns null when nothing usable is left — a
 *  median of one or zero peers is not a benchmark. */
export function median(values: (number | null)[]): number | null {
  const usable = values
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (usable.length < 3) return null;
  const mid = Math.floor(usable.length / 2);
  return usable.length % 2 === 0
    ? (usable[mid - 1] + usable[mid]) / 2
    : usable[mid];
}
