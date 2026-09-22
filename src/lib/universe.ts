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

export const UNIVERSE: { ticker: string; sector: SectorKey }[] = [
  { ticker: "NVDA", sector: "semis" },
  { ticker: "AMD", sector: "semis" },
  { ticker: "INTC", sector: "semis" },
  { ticker: "AVGO", sector: "semis" },
  { ticker: "QCOM", sector: "semis" },
  { ticker: "TXN", sector: "semis" },
  { ticker: "MU", sector: "semis" },

  { ticker: "MSFT", sector: "software" },
  { ticker: "ORCL", sector: "software" },
  { ticker: "CRM", sector: "software" },
  { ticker: "ADBE", sector: "software" },
  { ticker: "NOW", sector: "software" },
  { ticker: "INTU", sector: "software" },

  { ticker: "GOOGL", sector: "internet" },
  { ticker: "META", sector: "internet" },
  { ticker: "NFLX", sector: "internet" },
  { ticker: "AMZN", sector: "internet" },
  { ticker: "BKNG", sector: "internet" },

  { ticker: "JNJ", sector: "healthcare" },
  { ticker: "PFE", sector: "healthcare" },
  { ticker: "MRK", sector: "healthcare" },
  { ticker: "LLY", sector: "healthcare" },
  { ticker: "ABBV", sector: "healthcare" },
  { ticker: "UNH", sector: "healthcare" },

  { ticker: "JPM", sector: "financials" },
  { ticker: "BAC", sector: "financials" },
  { ticker: "WFC", sector: "financials" },
  { ticker: "GS", sector: "financials" },
  { ticker: "MS", sector: "financials" },

  { ticker: "XOM", sector: "energy" },
  { ticker: "CVX", sector: "energy" },
  { ticker: "COP", sector: "energy" },
  { ticker: "SLB", sector: "energy" },
  { ticker: "EOG", sector: "energy" },

  { ticker: "WMT", sector: "consumer" },
  { ticker: "COST", sector: "consumer" },
  { ticker: "HD", sector: "consumer" },
  { ticker: "NKE", sector: "consumer" },
  { ticker: "MCD", sector: "consumer" },
  { ticker: "AAPL", sector: "consumer" },

  { ticker: "CAT", sector: "industrials" },
  { ticker: "BA", sector: "industrials" },
  { ticker: "GE", sector: "industrials" },
  { ticker: "HON", sector: "industrials" },
  { ticker: "UNP", sector: "industrials" },

  { ticker: "T", sector: "telecom" },
  { ticker: "VZ", sector: "telecom" },
  { ticker: "TMUS", sector: "telecom" },
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
