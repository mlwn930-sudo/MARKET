import { fmtCompact } from "@/lib/format";
import type { Institution } from "@/lib/institutional-store";
import {
  ageInDays,
  gradeConfidence,
  sec,
  type AgentReport,
  type Evidence,
  type Finding,
  type Stance,
} from "./types";

/**
 * Agent 4 — who else owns it.
 *
 * One of the three questions this site exists to answer, and until now the
 * only one with no agent behind it: the company page argued about value and
 * price, while the 13F data sat on a page of its own with no connection to
 * the thesis.
 *
 * What a 13F can and cannot support is the whole design of this file.
 *
 *   It is a record of an action, not an opinion. A manager who added is a
 *   manager who bought at some point inside a three-month window. That is a
 *   fact about a position and not a forecast, and nothing here upgrades it
 *   into one.
 *
 *   It is late. Filings are due 45 days after quarter end, so the newest
 *   figure describes a portfolio as it stood up to four and a half months
 *   ago. Every finding carries the report date rather than the filing date
 *   for that reason — the report date is what the data describes.
 *
 *   It is a sample of eight managers, chosen by hand. A company none of
 *   them holds is a company outside this sample, which is not the same
 *   thing as a company institutions do not own. That goes in `gaps` and
 *   never in a finding: inventing a negative out of a list we wrote
 *   ourselves is the one mistake this data makes easy.
 *
 *   It shows longs only. No shorts, no options, nothing listed outside the
 *   US — so the file cannot see the other side of anyone's book.
 */

/* ------------------------------------------------------------------ */
/* Matching an issuer name to a company                                */
/* ------------------------------------------------------------------ */

/** Corporate furniture. "APPLE INC" and "Apple Inc." are the same company,
 *  and neither string is the company's name. */
const FURNITURE = new Set([
  "INC",
  "INCORPORATED",
  "CORP",
  "CORPORATION",
  "CO",
  "COMPANY",
  "COS",
  "LTD",
  "LIMITED",
  "PLC",
  "LLC",
  "LP",
  "SA",
  "NV",
  "AG",
  "THE",
  "COM",
  "HOLDINGS",
  "HOLDING",
  "HLDGS",
  "GROUP",
  "GRP",
  "CLASS",
  "CL",
  "SER",
  "NEW",
  "ADR",
  "SPON",
  "SPONSORED",
  "TRUST",
]);

function normaliseName(raw: string): string {
  const words = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word.length > 0 && !FURNITURE.has(word));

  // A trailing single character is a share class ("ALPHABET INC CL C"),
  // never part of a name.
  while (words.length > 1 && words[words.length - 1].length === 1) words.pop();

  return words.join(" ");
}

/**
 * Whether a 13F issuer line refers to this company.
 *
 * Filings abbreviate and they rename. The same manager filed "BANK OF
 * AMER CORP" one quarter and "BANK AMERICA CORP" the next, for a position
 * that never moved — so exact equality is not enough, and a plain prefix
 * test misses the second form. A bare substring test is far too much and
 * would file every "AMERICAN" holding under American Express.
 *
 * The rule in between: the first word has to agree, and the shorter name's
 * words all have to appear in the longer one, in order. That accepts both
 * abbreviations and rejects the coincidence.
 *
 * It errs towards missing a match rather than making a wrong one, which is
 * the right direction here. A holding we fail to find is reported as a
 * company outside the tracked sample; a holding attributed to the wrong
 * company is a false statement about somebody's portfolio.
 */
function sameCompany(issuer: string, candidates: string[]): boolean {
  const left = normaliseName(issuer).split(" ").filter(Boolean);
  if (left.join("").length < 3) return false;

  return candidates.some((candidate) => {
    const right = normaliseName(candidate).split(" ").filter(Boolean);
    if (right.join("").length < 3) return false;

    if (!sameWord(left[0], right[0])) return false;

    const [shorter, longer] =
      left.length <= right.length ? [left, right] : [right, left];
    if (shorter.join("").length < 5) return false;

    /* A one-word name has to match a one-word name. Otherwise "APPLE INC"
       matches "Apple Hospitality REIT", which is a different company in a
       different industry — and the first word of a name is exactly where
       that kind of collision lives ("GENERAL", "AMERICAN", "FIRST"). */
    if (shorter.length === 1) return longer.length === 1;

    /* Beyond that, one dropped or added word is a filing convention
       ("BANK AMERICA CORP" for Bank of America, "ELEVANCE HEALTH INC
       FORMERLY" for Elevance Health). Two is a different company. */
    if (longer.length - shorter.length > 1) return false;

    return isOrderedSubset(shorter, longer);
  });
}

/**
 * Two words that are the same word.
 *
 * Filings truncate words as well as drop them — "AMER" for "AMERICA" — so
 * an abbreviation of four letters or more is accepted as its own
 * expansion. Three letters would start matching unrelated companies, and
 * two would match almost anything.
 */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 4 && longer.startsWith(shorter);
}

/** Every word of the first list appears in the second, in order. */
function isOrderedSubset(shorter: string[], longer: string[]): boolean {
  let cursor = 0;
  for (const word of shorter) {
    const at = longer.findIndex(
      (candidate, index) => index >= cursor && sameWord(word, candidate),
    );
    if (at === -1) return false;
    cursor = at + 1;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* The agent                                                           */
/* ------------------------------------------------------------------ */

type Holder = {
  manager: string;
  reportDate: string;
  value: number;
  shares: number;
  /** Share of that manager's reported book. Null when the file has none. */
  weight: number | null;
};

type Move = {
  manager: string;
  reportDate: string;
  kind: "new" | "increased" | "decreased" | "exited";
  value: number;
  shares: number;
  previousShares: number;
  sharesChangePercent: number | null;
  /** The position measured against the manager's whole book, in percent. */
  bookShare: number | null;
  /** True when this row was reassembled from an exit and an opening that
   *  are the same position under two spellings. See `collapseRenames`. */
  renamed?: boolean;
};

/** Ends a sentence with exactly one full stop. Several managers are
 *  called "L.P." and a blindly appended period prints two. */
function stop(text: string): string {
  return text.endsWith(".") ? text : text + ".";
}

const MOVE_VERB: Record<Move["kind"], string> = {
  new: "פתח פוזיציה",
  increased: "הגדיל",
  decreased: "הקטין",
  exited: "יצא לגמרי",
};

/**
 * The same position, filed twice under two names.
 *
 * Berkshire reported "BANK AMERICA CORP" one quarter and "BANK OF AMER
 * CORP" the next, for a holding it has had for years. The build script
 * used to diff quarters by issuer name, so it saw one position close and
 * another open — which prints as "Berkshire opened a position in Bank of
 * America", false in the most confident possible way.
 *
 * That is fixed at the source: the diff is keyed on the CUSIP now. This
 * stays as a reader, not as a second implementation of the fix — the file
 * on disk is rebuilt nightly, and until a rebuild runs, a page should not
 * repeat the claim. A manager that both exited and opened the same company
 * inside one report is describing a rename, not two decisions, so the two
 * rows are folded into the single move that actually happened.
 */
function collapseRenames(moves: Move[]): Move[] {
  const byManager = new Map<string, Move[]>();
  for (const move of moves) {
    const list = byManager.get(move.manager) ?? [];
    list.push(move);
    byManager.set(move.manager, list);
  }

  const out: Move[] = [];
  for (const list of byManager.values()) {
    const opened = list.filter((move) => move.kind === "new");
    const closed = list.filter((move) => move.kind === "exited");

    if (opened.length !== 1 || closed.length !== 1) {
      out.push(...list);
      continue;
    }

    const before = closed[0].previousShares;
    const after = opened[0].shares;
    const changePercent = before > 0 ? ((after - before) / before) * 100 : null;

    out.push(
      ...list.filter(
        (move) => move.kind !== "new" && move.kind !== "exited",
      ),
      {
        ...opened[0],
        kind: after >= before ? "increased" : "decreased",
        previousShares: before,
        sharesChangePercent: changePercent,
        renamed: true,
      },
    );
  }
  return out;
}

/**
 * A move large enough to read as a decision.
 *
 * Two conditions, because either one alone produces noise. A 40% increase
 * in a position worth a tenth of a percent of the book is a rounding
 * adjustment; half a percent of the book that moved by 3% is a rebalance.
 * A move counts as directional only when it is both a real change in the
 * position and a position of real size.
 */
function isMaterial(move: Move): boolean {
  if (move.kind === "new" || move.kind === "exited") {
    return (move.bookShare ?? 0) >= 0.5;
  }
  const magnitude = Math.abs(move.sharesChangePercent ?? 0);
  return magnitude >= 20 && (move.bookShare ?? 0) >= 0.5;
}

export function ownershipAnalyst(
  symbol: string,
  /** The company's name as the profile gives it. Issuer lines carry names
   *  and never tickers, so without this there is nothing to match on. */
  companyName: string | null,
  institutions: Institution[],
  /** When the institutional file was built. Printed, so a stale file is
   *  visible as a stale file rather than as an empty result. */
  builtAt: string | null,
): AgentReport {
  const findings: Finding[] = [];
  const gaps: string[] = [];

  const candidates = [companyName, symbol].filter(
    (name): name is string => typeof name === "string" && name.length > 0,
  );

  if (institutions.length === 0) {
    return {
      agent: "ownership",
      label: "מעקב מוסדי",
      findings,
      gaps: [
        "קובץ ה-13F לא נטען, ולכן מעקב הבעלות אינו זמין. זו אמירה על הנתונים, לא על החברה.",
      ],
    };
  }

  const holders: Holder[] = [];
  const rawMoves: Move[] = [];

  for (const institution of institutions) {
    const book = institution.totalValue > 0 ? institution.totalValue : null;

    for (const holding of institution.topHoldings) {
      if (!sameCompany(holding.issuer, candidates)) continue;
      holders.push({
        manager: institution.name,
        reportDate: institution.reportDate,
        value: holding.value,
        shares: holding.shares,
        weight: holding.weight,
      });
    }

    if (!institution.hasComparison) continue;

    for (const change of institution.changes) {
      if (!sameCompany(change.issuer, candidates)) continue;
      rawMoves.push({
        manager: institution.name,
        reportDate: institution.reportDate,
        kind: change.kind,
        value: change.value,
        shares: change.shares,
        previousShares: change.previousShares,
        sharesChangePercent: change.sharesChangePercent,
        bookShare: book === null ? null : (change.value / book) * 100,
      });
    }
  }

  const moves = collapseRenames(rawMoves);

  /* Two dates, not one. Managers file on their own schedules, and one
     stale filer among five current ones is the thing a reader needs to
     see — so the newest date is what the picture is "as of", and the
     oldest is what the confidence is graded on. Weakest link, as
     everywhere else here. */
  const reportDates = [...holders, ...moves]
    .map((row) => row.reportDate)
    .sort();
  const newestReport = reportDates[reportDates.length - 1] ?? null;
  const oldestReport = reportDates[0] ?? null;

  /* ---- Who holds it ---- */

  if (holders.length > 0) {
    /* One line per manager. A manager that reports the same company under
       two spellings would otherwise appear twice and its conviction would
       read as half of what it is. */
    const byManager = new Map<string, Holder>();
    for (const holder of holders) {
      const existing = byManager.get(holder.manager);
      if (!existing) {
        byManager.set(holder.manager, { ...holder });
        continue;
      }
      existing.shares += holder.shares;
      existing.weight =
        existing.weight === null && holder.weight === null
          ? null
          : (existing.weight ?? 0) + (holder.weight ?? 0);
    }

    const byWeight = [...byManager.values()].sort(
      (a, b) => (b.weight ?? 0) - (a.weight ?? 0),
    );
    const conviction = byWeight[0];

    const evidence: Evidence[] = byWeight.map((holder) => ({
      label: holder.manager,
      value: `${fmtCompact(holder.shares)} מניות${
        holder.weight === null ? "" : ` · ${holder.weight.toFixed(1)}% מהתיק`
      }`,
      source: sec(holder.reportDate, "13F · לפי תאריך הדיווח"),
    }));

    const grade = gradeConfidence({
      evidenceCount: evidence.length,
      ageDays: ageInDays(oldestReport),
    });

    const spread =
      newestReport && oldestReport && newestReport !== oldestReport
        ? `הדוחות אינם מאותו מועד: בין ${oldestReport} ל-${newestReport}, לפי מתי כל מנהל הגיש.`
        : `נכון לדוחות ${newestReport ?? "התקופה המדווחת"}.`;

    findings.push({
      id: "ownership-holders",
      title:
        byWeight.length === 1
          ? `מנהל אחד מהרשימה מחזיק ב-${symbol}`
          : `${byWeight.length} מנהלים מהרשימה מחזיקים ב-${symbol}`,
      body:
        `${stop(byWeight.map((holder) => holder.manager).join(", "))} ${spread}` +
        (conviction.weight === null
          ? ""
          : ` המשקל הגבוה ביותר הוא ${conviction.weight.toFixed(1)}% מהתיק של ${conviction.manager}. המשקל הוא מה שמבדיל החלטה מנוכחות: 12% מתיק הוא מהלך, 0.3% הוא שורה.`) +
        " המדידה היא במניות ובמשקל ולא בדולרים: שווי בדולרים זז עם המחיר גם כשאיש לא קנה ולא מכר, והמשקל הוא מה שמאפשר להשוות בין מנהל שמנהל מיליארד לבין מנהל שמנהל שלוש מאות." +
        " 13F מתאר את התיק בסוף הרבעון ומוגש עד 45 יום אחריו: זו תמונה ישנה ולא פוזיציה נוכחית.",
      stance: "neutral",
      confidence: grade.confidence,
      confidenceReason: `${grade.reason}. הדיווח רבעוני ומתפרסם באיחור של עד 45 יום, ופוזיציה יכולה להיסגר לפני שהיא מופיעה כאן.`,
      evidence,
    });
  } else {
    gaps.push(
      `אף אחד משמונת המנהלים שהאתר עוקב אחריהם אינו מדווח על החזקה ב-${symbol} ברשימת ההחזקות הגדולות שלו. זו עובדה על הרשימה הזו ולא על החברה: 13F חל רק על מנהלים מעל 100 מיליון דולר, הקובץ שומר את ההחזקות הגדולות בלבד, והרשימה עצמה נבחרה בידיים.`,
    );
  }

  /* ---- What changed last quarter ---- */

  if (moves.length > 0) {
    const material = moves.filter(isMaterial);
    const adds = material.filter(
      (move) => move.kind === "new" || move.kind === "increased",
    );
    const cuts = material.filter(
      (move) => move.kind === "exited" || move.kind === "decreased",
    );

    const evidence: Evidence[] = moves.map((move) => ({
      label: `${move.manager} · ${MOVE_VERB[move.kind]}`,
      value:
        move.kind === "new"
          ? `${fmtCompact(move.shares)} מניות`
          : move.kind === "exited"
            ? `${fmtCompact(move.previousShares)} מניות נמכרו`
            : move.sharesChangePercent === null
              ? `${fmtCompact(move.shares)} מניות`
              : `${move.sharesChangePercent > 0 ? "+" : "−"}${Math.abs(move.sharesChangePercent).toFixed(0)}% במניות`,
      source: sec(move.reportDate, "13F · שינוי מול הרבעון הקודם"),
    }));

    const grade = gradeConfidence({
      evidenceCount: moves.length,
      ageDays: ageInDays(oldestReport),
      nearThreshold: material.length === 0 || adds.length === cuts.length,
    });

    /* Direction is read only from the material moves. Counting every line
       would let four rebalances outvote one real decision. */
    const stance: Stance =
      material.length === 0
        ? "neutral"
        : adds.length > cuts.length
          ? "supports"
          : cuts.length > adds.length
            ? "opposes"
            : "neutral";

    findings.push({
      id: "ownership-change",
      title:
        material.length === 0
          ? `שינויים קטנים בלבד בהחזקות ${symbol}`
          : adds.length > cuts.length
            ? `הכסף המוסדי במעקב הוסיף ב-${symbol}`
            : cuts.length > adds.length
              ? `הכסף המוסדי במעקב הקטין ב-${symbol}`
              : `תנועה דו-כיוונית בהחזקות ${symbol}`,
      body:
        moves
          .map(
            (move) =>
              `${move.manager} ${MOVE_VERB[move.kind]}${
                move.kind === "new" ||
                move.kind === "exited" ||
                move.sharesChangePercent === null
                  ? ""
                  : ` ב-${Math.abs(move.sharesChangePercent).toFixed(0)}%`
              }`,
          )
          .join(" · ") +
        (moves.some((move) => move.renamed)
          ? ". שורה אחת כאן הורכבה מחדש: המנהל דיווח על אותה החזקה בשני איותים שונים בשני רבעונים, וההשוואה הגולמית הציגה זאת כסגירה ופתיחה. המספר שמוצג הוא השינוי בפועל בין שתי ספירות המניות"
          : "") +
        (material.length === 0
          ? ". כל התנועות קטנות מכדי להיקרא כהחלטה — פחות מחצי אחוז מהתיק, או שינוי של פחות מחמישית בגודל הפוזיציה. מוצג כהקשר ולא כאיתות."
          : `. ${material.length} מתוך ${moves.length} התנועות גדולות דיין כדי להיקרא כהחלטה ולא כאיזון תיק.`) +
        " מה שאין כאן: באיזו נקודה בתוך הרבעון הפעולה בוצעה, ובאיזה מחיר.",
      stance,
      confidence: grade.confidence,
      confidenceReason: `${grade.reason}. הדיווח רבעוני, ולכן גם תנועה גדולה בוצעה בנקודה לא ידועה בתוך שלושה חודשים.`,
      evidence,
      horizon: "medium",
    });
  } else if (holders.length > 0) {
    gaps.push(
      "לא נמצא שינוי מדווח מול הרבעון הקודם — או שהפוזיציה לא זזה, או שאין עדיין דוח קודם להשוות אליו.",
    );
  }

  gaps.push(
    "13F מכסה החזקות לונג במניות אמריקאיות בלבד: בלי שורט, בלי אופציות, ובלי מה שמוחזק מחוץ לארה״ב. הצד השני של התיק אינו נראה בדוח הזה.",
  );

  if (builtAt) {
    gaps.push(
      `קובץ ההחזקות נבנה ב-${builtAt.slice(0, 10)}. הסריקה רצה בלילה, ולכן ייתכן פער של יום מול מה שכבר הוגש ל-SEC.`,
    );
  }

  return { agent: "ownership", label: "מעקב מוסדי", findings, gaps };
}
