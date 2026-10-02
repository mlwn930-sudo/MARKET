/**
 * Company names, in the words a reader actually types.
 *
 * The chat and the research console have to turn a Hebrew sentence into a
 * ticker before they can fetch anything, and nobody writes "AVGO" in a
 * question — they write "ברודקום". Handing the sentence to a model and
 * asking which company it means would work, and would cost a model call
 * before the real one, so the mapping is a table.
 *
 * Aliases only, never a company list: the site is not limited to what is
 * here. A ticker typed directly is resolved against SEC, and this table
 * only shortcuts the common names.
 */

/** Hebrew and English aliases, lowercase. Keep each list short: an alias
 *  that is also a common word ("meta", "מטא") is fine, one that is a
 *  fragment of another company's name is not. */
const ALIASES: Record<string, string[]> = {
  NVDA: ["nvidia", "אנבידיה", "נבידיה"],
  AMD: ["amd", "איי אם די"],
  INTC: ["intel", "אינטל"],
  AVGO: ["broadcom", "ברודקום"],
  QCOM: ["qualcomm", "קוואלקום"],
  TXN: ["texas instruments"],
  MU: ["micron", "מיקרון"],
  TSM: ["tsmc", "taiwan semiconductor", "טיוואן סמיקונדקטור"],
  ASML: ["asml"],

  MSFT: ["microsoft", "מיקרוסופט"],
  ORCL: ["oracle", "אורקל"],
  CRM: ["salesforce", "סיילספורס"],
  ADBE: ["adobe", "אדובי"],
  NOW: ["servicenow"],
  INTU: ["intuit"],
  PLTR: ["palantir", "פלנטיר"],

  GOOGL: ["google", "alphabet", "גוגל", "אלפבית"],
  META: ["meta", "facebook", "מטא", "פייסבוק"],
  NFLX: ["netflix", "נטפליקס"],
  AMZN: ["amazon", "אמזון"],
  BKNG: ["booking"],

  AAPL: ["apple", "אפל"],
  TSLA: ["tesla", "טסלה"],

  JNJ: ["johnson", "johnson & johnson"],
  PFE: ["pfizer", "פייזר"],
  MRK: ["merck", "מרק"],
  LLY: ["eli lilly", "lilly", "לילי"],
  ABBV: ["abbvie"],
  UNH: ["unitedhealth"],

  JPM: ["jpmorgan", "jp morgan", "ג׳יפי מורגן", "גיפי מורגן"],
  BAC: ["bank of america", "בנק אוף אמריקה"],
  WFC: ["wells fargo"],
  GS: ["goldman", "goldman sachs", "גולדמן זאקס", "גולדמן סאקס"],
  MS: ["morgan stanley", "מורגן סטנלי"],

  XOM: ["exxon", "אקסון"],
  CVX: ["chevron", "שברון"],
  COP: ["conocophillips"],
  SLB: ["schlumberger", "slb"],
  EOG: ["eog"],

  WMT: ["walmart", "וולמארט"],
  COST: ["costco", "קוסטקו"],
  HD: ["home depot"],
  NKE: ["nike", "נייקי"],
  MCD: ["mcdonald", "מקדונלדס"],
  SBUX: ["starbucks", "סטארבקס"],

  CAT: ["caterpillar"],
  BA: ["boeing", "בואינג"],
  GE: ["general electric"],
  HON: ["honeywell"],
  UNP: ["union pacific"],

  T: ["at&t"],
  VZ: ["verizon", "וריזון"],
  TMUS: ["t-mobile"],

  TTWO: ["take-two", "take two", "rockstar", "gta", "טייק טו"],
};

/** Reverse index, built once. */
const BY_ALIAS = new Map<string, string>();
for (const [ticker, names] of Object.entries(ALIASES)) {
  for (const name of names) BY_ALIAS.set(name, ticker);
}

const TICKERS = new Set(Object.keys(ALIASES));

/**
 * Every company a question refers to, in the order they appear.
 *
 * Two passes, because the two forms fail in opposite ways. Bare uppercase
 * tokens catch "NVDA" but would also catch "AI" and "CEO", so only tokens
 * this file knows are accepted. Names catch "אנבידיה" but need a longest
 * match first, or "bank of america" resolves as "bank".
 */
export function detectTickers(text: string, limit = 4): string[] {
  const found: string[] = [];
  const add = (ticker: string) => {
    if (!found.includes(ticker)) found.push(ticker);
  };

  const lower = text.toLowerCase();

  const names = [...BY_ALIAS.keys()].sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (lower.includes(name)) add(BY_ALIAS.get(name)!);
    if (found.length >= limit) return found;
  }

  for (const token of text.match(/\b[A-Z]{1,5}\b/g) ?? []) {
    if (TICKERS.has(token)) add(token);
    if (found.length >= limit) break;
  }

  return found.slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Is a text about one particular company                              */
/* ------------------------------------------------------------------ */

/**
 * First words of a registered name that are no test at all.
 *
 * "Advanced Micro Devices" would otherwise let through every article
 * containing the word "advanced". The list is deliberately short: the full
 * name and the ticker carry the work, and this only decides whether the
 * single-word shortcut is safe to use.
 */
const WEAK_FIRST_WORD = new Set([
  "advanced",
  "allied",
  "american",
  "applied",
  "capital",
  "consolidated",
  "digital",
  "dynamic",
  "eastern",
  "first",
  "general",
  "global",
  "integrated",
  "international",
  "national",
  "northern",
  "pacific",
  "premier",
  "southern",
  "standard",
  "summit",
  "superior",
  "united",
  "universal",
  "western",
]);

/** Everything in a registered name that is not the company. */
const LEGAL_FORM =
  /\b(incorporated|inc|corporation|corp|company|co|holdings|holding|group|plc|llc|ltd|limited|lp|sa|nv|ag|se|ab|oyj|class [a-c]|cl [a-c]|the)\b/g;

/**
 * What a registered name contributes to the test.
 *
 * The table above is aliases only and covers the companies a reader types by
 * name. A page is opened for any ticker, and for the rest the name on the
 * filing is the only name there is — so it is cleaned of its legal form and
 * used as a key, plus its first word when that word is distinctive enough to
 * stand alone.
 */
function nameKeys(name: string | null | undefined): string[] {
  const cleaned = (name ?? "")
    .toLowerCase()
    .replace(/[.,&'"]/g, " ")
    .replace(LEGAL_FORM, " ")
    .replace(/\s+/g, " ")
    .trim();

  const keys: string[] = [];
  if (cleaned.length >= 4) keys.push(cleaned);

  const first = cleaned.split(" ")[0] ?? "";
  if (first.length >= 5 && !WEAK_FIRST_WORD.has(first)) keys.push(first);

  return [...new Set(keys)];
}

/**
 * Whether a text actually names one company.
 *
 * This is the question behind every "is this article about this stock" on the
 * site, and it has exactly one answer here. `detectTickers` asks it of a
 * whole sentence and returns everyone it finds; this asks it of one symbol,
 * which is what a company page needs and what a feed filter needs. Both read
 * the same alias table, so a Hebrew alias added above starts working in both
 * places at once.
 *
 * Three ways to pass: the ticker appears as a word, one of the curated
 * aliases appears, or the registered name does. The caller supplies the name
 * when it has one — without it only the first two apply, which is the right
 * degradation and not a failure.
 */
export function mentionsCompany(
  text: string,
  symbol: string,
  name?: string | null,
): boolean {
  const lower = text.toLowerCase();
  const ticker = symbol.toUpperCase();

  /* Escaped, because a ticker may carry a dot or a dash and an unescaped one
     would match far more than itself. */
  const word = ticker.toLowerCase().replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
  if (new RegExp(`\\b${word}\\b`).test(lower)) return true;

  for (const alias of ALIASES[ticker] ?? []) {
    if (lower.includes(alias)) return true;
  }

  return nameKeys(name).some((key) => lower.includes(key));
}

/** An explicit ticker in a field the reader typed into. Deliberately does
 *  not guess: a research request for "NVDA" should not silently become
 *  something else. */
export function normaliseTicker(input: string): string | null {
  const direct = input.trim().toUpperCase();
  if (/^[A-Z.\-]{1,10}$/.test(direct)) return direct;

  const byName = BY_ALIAS.get(input.trim().toLowerCase());
  return byName ?? null;
}
