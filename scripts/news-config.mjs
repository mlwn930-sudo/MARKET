/**
 * What counts as market news, and what does not.
 *
 * The first version of these queries asked GDELT for "semiconductor OR chip
 * export OR lithography" and got back a university conference in Bengaluru,
 * a gold drilling report, and an exam syllabus. A broad query against a
 * global news index returns global news, not market news.
 *
 * Two changes fixed it, and both are needed:
 *   1. Every query now requires a market term alongside the sector term.
 *      GDELT ANDs space-separated groups, so "(semiconductor OR chipmaker)
 *      (stocks OR earnings)" demands both.
 *   2. A rejection list catches what still slips through — junior mining
 *      results and conference announcements share vocabulary with real
 *      market coverage and cannot be excluded by query alone.
 */

/** Terms that mark an article as being about markets rather than a topic. */
const MARKET = '(stocks OR shares OR earnings OR revenue OR investors OR "stock market" OR nasdaq OR analysts)';

export const SECTORS = [
  {
    sector: "semis",
    label: "מוליכים למחצה",
    q: `(semiconductor OR chipmaker OR "chip industry" OR nvidia OR tsmc OR asml) ${MARKET} sourcelang:english`,
  },
  {
    sector: "energy",
    label: "אנרגיה",
    q: `("oil price" OR opec OR "crude oil" OR "natural gas prices" OR refiner) ${MARKET} sourcelang:english`,
  },
  {
    sector: "defense",
    label: "ביטחון",
    q: `("defense contractor" OR "defense spending" OR lockheed OR raytheon OR "arms deal") ${MARKET} sourcelang:english`,
  },
  {
    sector: "finance",
    label: "פיננסים",
    q: `("federal reserve" OR "interest rate" OR inflation OR "treasury yields" OR "rate cut") ${MARKET} sourcelang:english`,
  },
  {
    sector: "trade",
    label: "סחר ומכסים",
    q: `(tariff OR "trade war" OR "export controls" OR sanctions OR "supply chain") ${MARKET} sourcelang:english`,
  },
];

/**
 * Headline patterns that are never market news, whatever the query matched.
 *
 * Junior mining releases are the worst offender: they are wire-distributed,
 * mention "shares" and "investors", and flood any commodity query. Assay
 * grades like "0.5 g/t Au" are their fingerprint.
 */
const REJECT = [
  /\bg\s*\/\s*t\b/i,
  /\b(drill|drilling|drilled|assay|ore body|feasibility study)\b/i,
  /\b(syllabus|exam|admit card|recruitment|vacancy|scholarship)\b/i,
  /\b(conclave|expo|trade fair|summit to be held|will be held)\b/i,
  /\b(horoscope|lottery|obituary|weather forecast)\b/i,
  /\bbetting odds\b/i,
];

/** Wire aggregators that republish the same story dozens of times. */
const LOW_VALUE_DOMAINS = [
  "juniorminingnetwork.com",
  "themarketsdaily.com",
  "jagranjosh.com",
  "marketbeat.com",
  "etfdailynews.com",
];

export function isRelevant(article) {
  const title = String(article.title ?? "");
  if (title.length < 25) return false;
  if (REJECT.some((pattern) => pattern.test(title))) return false;
  if (LOW_VALUE_DOMAINS.includes(String(article.domain ?? "").toLowerCase())) {
    return false;
  }
  return true;
}

/** Ticker mentions in a headline, used to tag articles to companies. */
const COMPANY_TICKERS = {
  nvidia: "NVDA",
  amd: "AMD",
  intel: "INTC",
  broadcom: "AVGO",
  qualcomm: "QCOM",
  micron: "MU",
  tsmc: "TSM",
  asml: "ASML",
  apple: "AAPL",
  microsoft: "MSFT",
  amazon: "AMZN",
  alphabet: "GOOGL",
  google: "GOOGL",
  meta: "META",
  tesla: "TSLA",
  netflix: "NFLX",
  oracle: "ORCL",
  adobe: "ADBE",
  salesforce: "CRM",
  exxon: "XOM",
  chevron: "CVX",
  jpmorgan: "JPM",
  "bank of america": "BAC",
  goldman: "GS",
  lockheed: "LMT",
  raytheon: "RTX",
  boeing: "BA",
  walmart: "WMT",
  costco: "COST",
};

export function tickersIn(title) {
  const lower = String(title ?? "").toLowerCase();
  const found = new Set();
  for (const [name, ticker] of Object.entries(COMPANY_TICKERS)) {
    if (lower.includes(name)) found.add(ticker);
  }
  return [...found];
}
