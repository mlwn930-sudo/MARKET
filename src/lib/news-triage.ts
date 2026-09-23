/**
 * A first reading of every story, from rules rather than from a model.
 *
 * The language-model pass writes the real analysis — three lenses, in
 * Hebrew, explaining the mechanism. It runs on a schedule, it costs an API
 * call per article, and a story therefore reaches the page before its
 * reading does. Which left the feed showing dozens of headlines marked
 * "awaiting analysis", including several that were never going to be worth
 * analysing: job-hunting advice, "three stocks to watch", a piece about the
 * best laptops.
 *
 * This is the pass that runs instantly on everything. It cannot explain a
 * mechanism, and it does not pretend to — what it does is sort headlines
 * into three groups using the vocabulary that reliably separates them:
 *
 *   An event that moves cash flow announces itself in specific words.
 *   Guidance, a contract award, an acquisition, an approval, a recall, a
 *   downgrade, an export restriction. These are things that happened to a
 *   business.
 *
 *   Commentary announces itself just as clearly. "Should you buy", "3
 *   stocks to watch", "here's what experts say", "how to invest in 2026".
 *   These are things that happened to a writer.
 *
 *   Everything else is undecided, and says so.
 *
 * Rules are honest about their limits and this one is stated on the page:
 * it reads the headline, not the business. A model's reading always wins
 * where one exists, and this is only ever the floor.
 *
 * Kept deliberately small. A keyword list that tries to cover everything
 * becomes a list nobody dares to change, and the model pass is what is
 * supposed to carry the depth.
 */

export type TriageKind = "catalyst" | "noise" | "unclear";

export type Triage = {
  kind: TriageKind;
  /** Shown to the reader, so the verdict can be argued with. */
  reason: string;
  /** True when the story should not reach the feed at all. */
  drop: boolean;
};

/**
 * Listicles, service journalism and opinion. These are dropped outright
 * rather than labelled: the reader asked for a research tool, and a feed
 * that carries "the 5 best credit cards" next to an earnings warning is
 * training them to skim past both.
 */
const DROP = [
  /\bhow to (invest|buy|trade|save|retire|pick)\b/i,
  /\b\d+\s+(stocks?|things?|ways?|reasons?|tips?|moves?|picks?)\b/i,
  /\bbest\s+(stocks?|credit cards?|laptops?|phones?|deals?|brokers?)\b/i,
  /\b(should you|why you should|here'?s what|what to know|explained)\b/i,
  /\b(job (search|hunting|market) advice|career advice|resume)\b/i,
  /\b(horoscope|recipe|gift guide|black friday deals?)\b/i,
  /\bmotley fool\b/i,
  /\b(prediction|forecast) for 20\d\d\b/i,
  /\bis .{2,30} a (buy|sell|good stock)\b/i,
];

/**
 * Words that mark something a company did, or that was done to it.
 *
 * Grouped so the reason given to the reader can name which kind of event
 * was recognised, rather than saying "matched a keyword".
 */
const CATALYST_PATTERNS: { test: RegExp; reason: string }[] = [
  {
    test: /\b(q[1-4]|quarterly|full[- ]year) (results|earnings)|\bearnings\b|\bbeats?\b|\bmisses?\b|\brevenue (rose|fell|grew)\b/i,
    reason: "דוח כספי או תוצאות רבעון",
  },
  {
    test: /\b(guidance|outlook|forecast) (cut|raised|lowered|slashed|boosted|withdrawn)|\braises? (guidance|outlook)|\bcuts? (guidance|outlook)\b/i,
    reason: "שינוי בתחזית החברה עצמה",
  },
  {
    test: /\b(acquisition|acquires?|to buy|merger|takeover|stake in|divest|spin[- ]?off)\b/i,
    reason: "מיזוג, רכישה או פיצול",
  },
  {
    test: /\b(contract|deal|order) (win|won|award|awarded|worth)|\bsigns? .{0,20}(deal|contract|agreement)\b/i,
    reason: "חוזה או הזמנה חדשה",
  },
  {
    test: /\b(fda|ema) (approval|approves?|rejects?|clearance)|\bphase [123]\b|\brecall(s|ed)?\b/i,
    reason: "רגולציה או אישור מוצר",
  },
  {
    test: /\b(tariff|export (ban|curb|control|restriction)|sanction|antitrust|lawsuit|settlement|fined)\b/i,
    reason: "רגולציה, מכסים או הליך משפטי",
  },
  {
    test: /\b(ceo|cfo) (steps down|resigns?|ousted|appointed|named)|\blayoffs?\b|\bjob cuts\b|\brestructur/i,
    reason: "שינוי בהנהלה או במבנה החברה",
  },
  {
    test: /\b(dividend|buyback|share repurchase|stock split|secondary offering)\b/i,
    reason: "החלטת הקצאת הון",
  },
  {
    test: /\b(upgrade[sd]?|downgrade[sd]?) (to|by)\b|\bprice target\b|\binitiates? coverage\b/i,
    reason: "שינוי המלצה או מחיר יעד של בית השקעות",
  },
  {
    test: /\b(fed|fomc|interest rate|rate (cut|hike)|inflation|cpi|jobs report|gdp)\b/i,
    reason: "נתון מאקרו שמשפיע על התמחור הרוחבי",
  },
  {
    test: /\b(capex|capacity|fab|plant|factory) (expansion|investment|build)|\binvests? \$?\d/i,
    reason: "השקעה הונית מוכרזת",
  },
];

/** Commentary that is not worth dropping but is not an event either. */
const SOFT_NOISE = [
  /\b(analysts? (say|think|expect)|experts? (say|weigh)|opinion|column)\b/i,
  /\b(stock (rises|falls|jumps|slips|climbs|drops)|shares (rise|fall|jump|slip))\b(?!.*\b(after|on|following)\b)/i,
  /\b(what|why) .{0,40}\?$/i,
];

export function triage(headline: string, summary = ""): Triage {
  const title = headline.trim();

  for (const pattern of DROP) {
    if (pattern.test(title)) {
      return {
        kind: "noise",
        reason: "טור עצות או רשימה, לא דיווח על אירוע עסקי",
        drop: true,
      };
    }
  }

  // The headline carries far more signal than the summary, which is often
  // a syndicated boilerplate paragraph. The summary is searched too, but a
  // headline match is what decides.
  for (const { test, reason } of CATALYST_PATTERNS) {
    if (test.test(title)) return { kind: "catalyst", reason, drop: false };
  }
  for (const { test, reason } of CATALYST_PATTERNS) {
    if (test.test(summary)) {
      return {
        kind: "catalyst",
        reason: `${reason} — לפי גוף הכתבה`,
        drop: false,
      };
    }
  }

  for (const pattern of SOFT_NOISE) {
    if (pattern.test(title)) {
      return {
        kind: "noise",
        reason: "תיאור תנועת מחיר או פרשנות, בלי אירוע עסקי מאחוריה",
        drop: false,
      };
    }
  }

  return {
    kind: "unclear",
    reason: "הכותרת אינה מזהה אירוע עסקי מובהק לכאן או לכאן",
    drop: false,
  };
}

/** Said on the page wherever a rule-based verdict is shown, so it is never
 *  mistaken for the model's reading of the article. */
export const TRIAGE_CAVEAT =
  "סיווג ראשוני לפי הכותרת בלבד. הניתוח המלא בשלוש עדשות נכתב בהרצה המתוזמנת ומחליף אותו כשהוא מגיע.";
