/**
 * News sources and sector classification.
 *
 * Finnhub is the primary source, not GDELT. GDELT indexes global news, which
 * meant a query for "semiconductor" returned a university conference in
 * Bengaluru and a gold drilling report; worse, it rate limits to one request
 * every five seconds and blocks for minutes at a time — including GitHub's
 * runners, which failed every sector on a scheduled run.
 *
 * Finnhub's newsfeed is already market news from CNBC, Reuters and similar,
 * and each item arrives with a summary, an image and related tickers. The
 * summary in particular removes the need to fetch the article page at all,
 * which is what used to lose a third of articles to paywalls.
 *
 * Sector assignment happens here rather than in the query: one request
 * returns a hundred stories, and sorting them locally costs nothing.
 */

export const SECTORS = [
  {
    sector: "ai",
    label: "בינה מלאכותית",
    blurb: "מודלים, שבבי AI, מרכזי נתונים והמירוץ בין החברות",
    accent: "#7f77dd",
    keywords: [
      "artificial intelligence",
      " ai ",
      "openai",
      "anthropic",
      "chatgpt",
      "llm",
      "machine learning",
      "data center",
      "datacenter",
      "gpu",
      "nvidia",
      "deepseek",
      "gemini",
      "copilot",
    ],
    tickers: ["NVDA", "MSFT", "GOOGL", "META", "AMD", "AVGO", "ORCL", "PLTR"],
  },
  {
    sector: "semis",
    label: "מוליכים למחצה",
    blurb: "ייצור שבבים, ציוד ליתוגרפיה, זיכרון ומגבלות יצוא",
    accent: "#1d9e75",
    keywords: [
      "semiconductor",
      "chipmaker",
      "chip maker",
      "foundry",
      "lithography",
      "wafer",
      "tsmc",
      "asml",
      "micron",
      "memory chip",
      "export control",
    ],
    tickers: ["NVDA", "AMD", "INTC", "TSM", "MU", "AVGO", "QCOM", "TXN", "ASML"],
  },
  {
    sector: "oil",
    label: "נפט וגז",
    blurb: "מחירי נפט, אופ״ק, זיקוק ושרשרת האספקה העולמית",
    accent: "#d85a30",
    keywords: [
      "oil price",
      "crude",
      "opec",
      "brent",
      "wti",
      "refinery",
      "refiner",
      "natural gas",
      "lng",
      "pipeline",
      "barrel",
      "hormuz",
      "petrol",
      "diesel",
    ],
    tickers: ["XOM", "CVX", "COP", "SLB", "EOG", "OXY", "PSX", "VLO"],
  },
  {
    sector: "power",
    label: "חשמל ואנרגיה",
    blurb: "רשת החשמל, גרעין, מתחדשות והביקוש שמרכזי הנתונים יוצרים",
    accent: "#eda100",
    keywords: [
      "electricity",
      "power grid",
      "utility",
      "utilities",
      "nuclear",
      "solar",
      "wind power",
      "renewable",
      "battery",
      "energy demand",
      "megawatt",
      "gigawatt",
      "smr ",
    ],
    tickers: ["NEE", "DUK", "SO", "CEG", "VST", "GEV", "FSLR", "ENPH"],
  },
  {
    sector: "finance",
    label: "פיננסים ומאקרו",
    blurb: "ריבית, אינפלציה, הפד, תשואות אג״ח ובנקים",
    accent: "#378add",
    keywords: [
      "federal reserve",
      "interest rate",
      "rate cut",
      "rate hike",
      "inflation",
      "treasury yield",
      "bond market",
      "jobs report",
      "cpi",
      "central bank",
      "dollar",
      "recession",
      "bank earnings",
    ],
    tickers: ["JPM", "BAC", "GS", "MS", "WFC", "C", "SCHW", "BLK"],
  },
  {
    sector: "defense",
    label: "ביטחון",
    blurb: "תקציבי ביטחון, עסקאות נשק וקבלני הביטחון",
    accent: "#888780",
    keywords: [
      "defense contractor",
      "defense spending",
      "defence",
      "lockheed",
      "raytheon",
      "northrop",
      "missile",
      "munitions",
      "arms deal",
      "pentagon",
      "military aid",
    ],
    tickers: ["LMT", "RTX", "NOC", "GD", "BA", "LHX", "HII"],
  },
  {
    sector: "trade",
    label: "סחר ומכסים",
    blurb: "מכסים, סנקציות, מלחמות סחר ושרשראות אספקה",
    accent: "#d4537e",
    keywords: [
      "tariff",
      "trade war",
      "sanction",
      "export ban",
      "blacklist",
      "supply chain",
      "trade deal",
      "customs",
      "import duty",
      "wto",
    ],
    tickers: ["AAPL", "NKE", "WMT", "CAT", "DE", "F", "GM"],
  },
  {
    sector: "consumer",
    label: "צריכה וקמעונאות",
    blurb: "הוצאות הצרכן, קמעונאות, מזון ומותגים",
    accent: "#97c459",
    keywords: [
      "consumer spending",
      "retail sales",
      "retailer",
      "e-commerce",
      "holiday shopping",
      "walmart",
      "costco",
      "amazon",
      "restaurant chain",
      "consumer confidence",
    ],
    tickers: ["WMT", "COST", "AMZN", "HD", "TGT", "MCD", "NKE", "SBUX"],
  },
  {
    sector: "health",
    label: "בריאות ותרופות",
    blurb: "פארמה, ביוטק, אישורי FDA וביטוח בריאות",
    accent: "#5dcaa5",
    keywords: [
      "fda approval",
      "drugmaker",
      "pharmaceutical",
      "biotech",
      "clinical trial",
      "vaccine",
      "obesity drug",
      "health insurer",
      "medicare",
      "eli lilly",
    ],
    tickers: ["LLY", "JNJ", "MRK", "PFE", "ABBV", "UNH", "AMGN", "NVO"],
  },
];

/** Headlines that are never market news, whatever else they matched. */
const REJECT = [
  /\bg\s*\/\s*t\b/i,
  /\b(drill|drilling|assay|ore body|feasibility study)\b/i,
  /\b(horoscope|lottery|obituary|recipe|celebrity)\b/i,
  /\bbetting odds\b/i,
  /^podcast:/i,
];

export function isRelevant(article) {
  const title = String(article.headline ?? article.title ?? "");
  if (title.length < 20) return false;
  return !REJECT.some((pattern) => pattern.test(title));
}

/**
 * Sectors an article belongs to.
 *
 * An article can land in more than one — an export ban on AI chips is
 * genuinely both a semis story and a trade story, and forcing a single
 * choice would hide it from one of the two readers looking for it.
 *
 * A ticker match counts for more than a keyword match, because Finnhub
 * tagging a story to NVDA is a stronger signal than the word "chip"
 * appearing somewhere in the summary.
 */
export function classify(article) {
  const text = `${article.headline ?? ""} ${article.summary ?? ""}`.toLowerCase();
  const related = String(article.related ?? "")
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  const scored = SECTORS.map((sector) => {
    const keywordHits = sector.keywords.filter((k) => text.includes(k)).length;
    const tickerHits = related.filter((t) => sector.tickers.includes(t)).length;
    return { sector: sector.sector, score: keywordHits + tickerHits * 2 };
  }).filter((s) => s.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 2).map((s) => s.sector);
}

/** Tickers the article is about, limited to ones we can show a page for. */
export function tickersIn(article) {
  const known = new Set(SECTORS.flatMap((s) => s.tickers));
  return [
    ...new Set(
      String(article.related ?? "")
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => known.has(t)),
    ),
  ].slice(0, 5);
}
