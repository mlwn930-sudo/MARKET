/**
 * SEC EDGAR — official filings and XBRL financial data.
 *
 * Two hard rules from SEC, both enforced here:
 *   1. Never exceed 10 requests/second. We run at 8 to leave headroom.
 *   2. Every request must carry a User-Agent of "<name> <email>".
 *      Without it EDGAR returns an "Undeclared Automated Tool" error.
 *
 * Note on serverless: each instance keeps its own limiter, so concurrent
 * instances could collectively exceed the cap. With this project's traffic
 * (a handful of users) that is not reachable. If it ever becomes a concern,
 * the limiter has to move to a shared store.
 */

const SEC_DATA = "https://data.sec.gov";
const SEC_WWW = "https://www.sec.gov";

const MAX_REQUESTS_PER_SECOND = 8;
const MIN_INTERVAL_MS = 1000 / MAX_REQUESTS_PER_SECOND;

let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

function userAgent(): string {
  const ua = process.env.SEC_USER_AGENT;
  if (!ua) {
    throw new Error(
      "SEC_USER_AGENT is not set. EDGAR rejects requests without a " +
        'User-Agent of the form "<name> <email>".',
    );
  }
  return ua.replace(/^"|"$/g, "");
}

/** Serializes every EDGAR call and spaces them at least MIN_INTERVAL_MS apart. */
function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const waitFor = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (waitFor > 0) await new Promise((r) => setTimeout(r, waitFor));
    lastRequestAt = Date.now();
    return task();
  });
  // Keep the chain alive even when one call rejects.
  queue = run.catch(() => undefined);
  return run;
}

async function secFetch<T>(url: string, revalidate = 86_400): Promise<T> {
  return schedule(async () => {
    const res = await fetch(url, {
      headers: {
        "User-Agent": userAgent(),
        "Accept-Encoding": "gzip, deflate",
      },
      next: { revalidate },
    });
    if (!res.ok) {
      throw new Error(`SEC ${res.status} ${res.statusText} for ${url}`);
    }
    return res.json() as Promise<T>;
  });
}

/** EDGAR paths need the CIK zero-padded to 10 digits: 320193 -> CIK0000320193. */
export function padCik(cik: number | string): string {
  return String(cik).replace(/\D/g, "").padStart(10, "0");
}

type TickerRow = { cik_str: number; ticker: string; title: string };
let tickerMap: Map<string, TickerRow> | null = null;

/** Resolves a ticker to its CIK. The full map is ~1MB, so it is cached. */
export async function lookupTicker(ticker: string): Promise<TickerRow | null> {
  if (!tickerMap) {
    const raw = await secFetch<Record<string, TickerRow>>(
      `${SEC_WWW}/files/company_tickers.json`,
      604_800,
    );
    tickerMap = new Map(
      Object.values(raw).map((row) => [row.ticker.toUpperCase(), row]),
    );
  }
  return tickerMap.get(ticker.trim().toUpperCase()) ?? null;
}

export type CompanyFacts = {
  cik: number;
  entityName: string;
  facts: Record<string, Record<string, XbrlConcept>>;
};

export type XbrlConcept = {
  label: string | null;
  description: string | null;
  units: Record<string, XbrlFact[]>;
};

export type XbrlFact = {
  /** Period start, for duration concepts only. */
  start?: string;
  /** Period end, or the instant for point-in-time concepts. */
  end: string;
  val: number;
  /** Fiscal year of the filing this fact came from. */
  fy: number;
  /** "Q1" | "Q2" | "Q3" | "FY" */
  fp: string;
  form: string;
  /** The date the filing was submitted. Always surface this to the user —
   *  SEC data lags, and a figure without its filing date is misleading. */
  filed: string;
  frame?: string;
};

/** Every XBRL concept a company has ever reported. This is the main source. */
export async function getCompanyFacts(cik: number | string) {
  return secFetch<CompanyFacts>(
    `${SEC_DATA}/api/xbrl/companyfacts/CIK${padCik(cik)}.json`,
  );
}

export type Submissions = {
  cik: string;
  name: string;
  sic: string;
  sicDescription: string;
  tickers: string[];
  exchanges: string[];
  filings: {
    recent: {
      accessionNumber: string[];
      form: string[];
      filingDate: string[];
      reportDate: string[];
      primaryDocument: string[];
    };
  };
};

export async function getSubmissions(cik: number | string) {
  return secFetch<Submissions>(
    `${SEC_DATA}/submissions/CIK${padCik(cik)}.json`,
    21_600,
  );
}

/** Filings of a given type, newest first. Use "13F-HR" for institutional holdings. */
export function recentFilingsOfType(
  submissions: Submissions,
  form: string,
  limit = 8,
) {
  const r = submissions.filings.recent;
  const out: { accessionNumber: string; filingDate: string; reportDate: string }[] =
    [];
  for (let i = 0; i < r.form.length && out.length < limit; i++) {
    if (r.form[i] === form) {
      out.push({
        accessionNumber: r.accessionNumber[i],
        filingDate: r.filingDate[i],
        reportDate: r.reportDate[i],
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 13F institutional holdings                                          */
/* ------------------------------------------------------------------ */

/** Accession numbers appear dashed in filing lists and undashed in archive
 *  paths: 0000950123-24-001234 -> 000095012324001234 */
function undash(accession: string): string {
  return accession.replace(/-/g, "");
}

type ArchiveIndex = {
  directory: { item: { name: string; type: string; size: string }[] };
};

/** Raw filing files. Public archive, same rate limit as the data API. */
async function archiveFetch<T>(path: string, revalidate = 86_400): Promise<T> {
  return schedule(async () => {
    const res = await fetch(`${SEC_WWW}${path}`, {
      headers: {
        "User-Agent": userAgent(),
        "Accept-Encoding": "gzip, deflate",
      },
      next: { revalidate },
    });
    if (!res.ok) {
      throw new Error(`SEC archive ${res.status} for ${path}`);
    }
    return res.json() as Promise<T>;
  });
}

async function archiveText(path: string, revalidate = 86_400): Promise<string> {
  return schedule(async () => {
    const res = await fetch(`${SEC_WWW}${path}`, {
      headers: {
        "User-Agent": userAgent(),
        "Accept-Encoding": "gzip, deflate",
      },
      next: { revalidate },
    });
    if (!res.ok) {
      throw new Error(`SEC archive ${res.status} for ${path}`);
    }
    return res.text();
  });
}

export type Holding = {
  issuer: string;
  cusip: string;
  /** Position value in whole dollars. */
  value: number;
  shares: number;
};

/**
 * Holdings from one 13F filing.
 *
 * `filedAt` is required because of a units change that silently corrupts
 * every figure: the value column was reported in THOUSANDS of dollars until
 * the SEC's amendment took effect in January 2023, and in whole dollars
 * after. Mixing the two makes an old quarter look a thousand times smaller
 * and turns every quarter-over-quarter diff into nonsense.
 */
export async function get13FHoldings(
  cik: number | string,
  accessionNumber: string,
  filedAt: string,
): Promise<Holding[]> {
  const cikPlain = String(cik).replace(/\D/g, "");
  const dir = `/Archives/edgar/data/${cikPlain}/${undash(accessionNumber)}`;

  const index = await archiveFetch<ArchiveIndex>(`${dir}/index.json`);

  // The information table is the XML that is not the primary form document.
  const candidates = index.directory.item
    .filter((i) => i.name.toLowerCase().endsWith(".xml"))
    .filter((i) => !/primary_doc/i.test(i.name));
  if (!candidates.length) return [];

  const xml = await archiveText(`${dir}/${candidates[0].name}`);

  const { XMLParser } = await import("fast-xml-parser");
  const parsed = new XMLParser({
    // Filers use assorted namespace prefixes (ns1:, n1:, none at all).
    removeNSPrefix: true,
    ignoreAttributes: true,
  }).parse(xml);

  const rows = parsed?.informationTable?.infoTable;
  if (!rows) return [];

  const inThousands = filedAt < "2023-01-01";
  const list = Array.isArray(rows) ? rows : [rows];

  return list
    .map((row): Holding | null => {
      const value = Number(row?.value);
      const shares = Number(row?.shrsOrPrnAmt?.sshPrnamt);
      const issuer = String(row?.nameOfIssuer ?? "").trim();
      if (!issuer || !Number.isFinite(value)) return null;
      return {
        issuer,
        cusip: String(row?.cusip ?? "").trim(),
        value: inThousands ? value * 1000 : value,
        shares: Number.isFinite(shares) ? shares : 0,
      };
    })
    .filter((h): h is Holding => h !== null);
}

/** Positions merged by issuer. A filer lists the same company several times
 *  across share classes and investment discretion categories, so the raw
 *  table double-counts. */
export function mergeByIssuer(holdings: Holding[]): Holding[] {
  const byName = new Map<string, Holding>();
  for (const h of holdings) {
    const key = h.issuer.toUpperCase();
    const existing = byName.get(key);
    if (existing) {
      existing.value += h.value;
      existing.shares += h.shares;
    } else {
      byName.set(key, { ...h, issuer: h.issuer });
    }
  }
  return [...byName.values()].sort((a, b) => b.value - a.value);
}
