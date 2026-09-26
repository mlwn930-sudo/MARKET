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
/**
 * Subjects that share vocabulary with a sector without belonging to it.
 *
 * The bug this fixes, observed in production: an article about Bitcoin
 * dominance was filed under artificial intelligence. It got there because
 * crypto coverage borrows the same nouns — data centre, GPU, compute,
 * power draw — and a single keyword hit was enough to classify.
 *
 * The rule is not "drop crypto". An article about a chipmaker selling
 * into mining rigs is genuinely a semis story. The rule is that shared
 * vocabulary alone cannot carry an article into a sector: when a
 * disqualifying subject is present, the sector has to be established by
 * something stronger than borrowed words — a ticker, or several
 * independent keywords.
 */
const CROSS_TALK = [
  "bitcoin",
  "ethereum",
  "crypto",
  "blockchain",
  "stablecoin",
  "token price",
  "altcoin",
  "mining rig",
  "halving",
];

/** Sectors whose vocabulary crypto coverage borrows most heavily. */
const GUARDED = new Set(["ai", "semis", "power"]);

/**
 * How a company is named in prose, so a provider's tag can be checked
 * against the article's own text.
 *
 * Only the names that actually appear in headlines. This is not a
 * directory — it exists so that "tagged to NVDA" can be tested against
 * "does this article mention Nvidia", and a bounded list answers that
 * for the companies whose tags go wrong.
 */
const ALIASES = {
  NVDA: ["nvidia"],
  AMD: ["advanced micro"],
  INTC: ["intel"],
  AVGO: ["broadcom"],
  MU: ["micron"],
  TSM: ["tsmc", "taiwan semiconductor"],
  AAPL: ["apple"],
  MSFT: ["microsoft"],
  GOOGL: ["alphabet", "google"],
  AMZN: ["amazon"],
  META: ["meta platforms", "facebook"],
  TSLA: ["tesla"],
  NFLX: ["netflix"],
  ORCL: ["oracle"],
  CRM: ["salesforce"],
  ADBE: ["adobe"],
  TTWO: ["take-two", "rockstar"],
  XOM: ["exxon"],
  CVX: ["chevron"],
  LLY: ["eli lilly"],
  JNJ: ["johnson & johnson"],
  PFE: ["pfizer"],
  JPM: ["jpmorgan", "jp morgan"],
  WMT: ["walmart"],
  COST: ["costco"],
  BA: ["boeing"],
};

/**
 * Whether the article itself supports the provider's tag.
 *
 * `direct` — the ticker or the company's name appears in the text.
 * `indirect` — the provider attached it and the article never says so.
 *
 * The distinction was forced by a real case: a story headlined "Bitcoin
 * Now Accounts for Less Than 60% of Total Crypto Market Value" arrived
 * tagged to NVDA, with Nvidia mentioned nowhere in it. Treating that tag
 * as evidence put a crypto article into the artificial-intelligence
 * section. An indirect tag is still recorded — it may be a genuine
 * second-order link — but it cannot carry an article into a sector on
 * its own.
 */
export function entityRelationship(ticker, text) {
  const symbol = String(ticker).toUpperCase();
  const haystack = text.toLowerCase();

  if (new RegExp(`\\b${symbol.toLowerCase()}\\b`).test(haystack)) {
    return { ticker: symbol, relationship: "direct", confidence: "high" };
  }
  for (const alias of ALIASES[symbol] ?? []) {
    if (haystack.includes(alias)) {
      return { ticker: symbol, relationship: "direct", confidence: "high" };
    }
  }
  return { ticker: symbol, relationship: "indirect", confidence: "low" };
}

/**
 * The floor for a classification.
 *
 * One generic keyword is not a subject. Two independent keywords, or a
 * single ticker the provider tagged, is — which is why a ticker is worth
 * three and a keyword one.
 */
const MIN_SCORE = 2;
const TICKER_WEIGHT = 3;

export function classify(article) {
  const text = `${article.headline ?? ""} ${article.summary ?? ""}`.toLowerCase();
  const related = String(article.related ?? "")
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  const crossTalk = CROSS_TALK.some((term) => text.includes(term));

  /* Tags the article's own text supports, and tags only the provider
     asserts. Both count — dropping the second deleted a third of the
     feed, because plenty of legitimate coverage names a company once in
     a paragraph the summary cuts. They count differently, and only the
     first can carry an article past the cross-talk guard. */
  const direct = [];
  const indirect = [];
  for (const ticker of related) {
    const entity = entityRelationship(ticker, text);
    (entity.relationship === "direct" ? direct : indirect).push(ticker);
  }

  const scored = SECTORS.map((sector) => {
    const keywordHits = sector.keywords.filter((k) => text.includes(k)).length;
    const directHits = direct.filter((t) => sector.tickers.includes(t)).length;
    const indirectHits = indirect.filter((t) =>
      sector.tickers.includes(t),
    ).length;

    let score = keywordHits + directHits * TICKER_WEIGHT + indirectHits;

    /* A guarded sector reached only through borrowed vocabulary or an
       unsupported tag does not count. A directly-named company still
       carries it — a story that actually discusses Nvidia is a semis
       story whatever else it mentions. This is the line the Bitcoin
       article failed: tagged to NVDA, Nvidia named nowhere in it. */
    if (crossTalk && GUARDED.has(sector.sector) && directHits === 0) {
      score = 0;
    }

    return { sector: sector.sector, score };
  }).filter((s) => s.score > 0);

  scored.sort((a, b) => b.score - a.score);

  /* The threshold decides confidence, not survival.
     Raising it to two was right — one borrowed word is not a subject —
     but applied as a hard filter it also deleted real market news: a
     story about the ten-year Treasury yield hitting a nineteen-year high
     scored one on finance and vanished from the feed entirely. So an
     article that reaches nothing confidently still goes to its best
     single match rather than nowhere. What it does not get is a second
     sector, and the crypto guard above runs first — a story zeroed there
     scores nothing to fall back on. */
  const confident = scored.filter((s) => s.score >= MIN_SCORE);
  if (confident.length === 0) {
    return scored.length > 0 ? [scored[0].sector] : [];
  }

  /* A second sector only when it is genuinely comparable. An export ban
     on AI chips is both a semis story and a trade story; a story that
     scored six on one sector and two on another is one story with a
     stray word in it, and filing it twice puts it in front of a reader
     it has nothing to say to. */
  const top = confident
    .slice(0, 2)
    .filter((s, i) => i === 0 || s.score >= confident[0].score * 0.6);

  return top.map((s) => s.sector);
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
