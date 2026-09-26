import type { EarningsSurprise } from "@/lib/sources/finnhub";
import type { Fundamentals } from "@/lib/metrics/fundamentals";
import { materialityOf, type Signal, type SignalEvidence } from "./signals";
import type { Grade, GradedClaim } from "./confidence";

/**
 * What a report actually said, against four different yardsticks.
 *
 * A headline that reads "Company beats by $0.04" answers one question and
 * hides three. Beating a consensus that was cut twice in the quarter is
 * not the same event as beating the number analysts held all along;
 * growing against a soft quarter last year is not the same as growing
 * against a strong one. So every reported quarter here is measured
 * against all four:
 *
 *   consensus        what the sell side expected
 *   previous quarter the sequential step — the one that shows a turn first
 *   the year before  the seasonal comparison, which is the honest one for
 *                    any business with a holiday quarter
 *   the record       how often this company has beaten before, because a
 *                    company that beats every quarter is being guided to,
 *                    not surprising anyone
 *
 * What this module deliberately does *not* do is claim the report moved
 * the price. It reports what changed in the numbers and which thesis
 * assumptions those numbers sit under. The link from a report to a price
 * belongs to `why-moving`, where it is graded.
 *
 * Guidance is not modelled. Finnhub's free tier carries the surprise
 * history and the calendar, not management's forward numbers, and a
 * "guidance" field assembled from anything else would be a guess with a
 * decimal point — which rule 9 of this project forbids. The absence is
 * stated on the page rather than filled.
 */

export type Yardstick = {
  label: string;
  /** The comparison, formatted. */
  figure: string;
  /** What it means. */
  body: string;
  /** Which way this particular comparison points. */
  direction: "better" | "worse" | "flat" | "unknown";
};

export type EarningsRead = {
  ticker: string;
  period: string;
  quarter: number;
  year: number;
  actual: number | null;
  estimate: number | null;
  surprisePercent: number | null;
  yardsticks: Yardstick[];
  /** Beat/miss record across the reported quarters on file. */
  record: { beats: number; misses: number; quarters: number; note: string } | null;
  /** Which thesis assumptions this report bears on. */
  bearsOn: string[];
  claim: GradedClaim;
  /** What the free data does not carry, said out loud. */
  missing: string[];
};

const eps = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : `$${value.toFixed(2)}`;

const pct = (value: number, digits = 1) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}%`;

/** A surprise smaller than this is the rounding of a consensus built from
 *  a dozen estimates, not a surprise. */
const SURPRISE_NOISE = 2;

export function readEarnings({
  ticker,
  surprises,
  fundamentals,
}: {
  ticker: string;
  /** Newest first, as `getEarningsSurprises` returns them. */
  surprises: EarningsSurprise[];
  fundamentals: Fundamentals;
}): EarningsRead | null {
  const reported = surprises.filter(
    (row) => row.actual !== null && Number.isFinite(row.actual),
  );
  if (reported.length === 0) return null;

  const latest = reported[0];
  const previousQuarter = reported[1] ?? null;
  const yearAgo =
    reported.find(
      (row) => row.year === latest.year - 1 && row.quarter === latest.quarter,
    ) ?? null;

  const yardsticks: Yardstick[] = [];

  /* ---- Against consensus ---- */
  if (latest.estimate !== null && latest.surprisePercent !== null) {
    const size = Math.abs(latest.surprisePercent);
    yardsticks.push({
      label: "מול הקונצנזוס",
      figure: `${eps(latest.actual)} מול ${eps(latest.estimate)} · ${pct(latest.surprisePercent)}`,
      body:
        size < SURPRISE_NOISE
          ? "הפער קטן מכדי להיקרא הפתעה. קונצנזוס נבנה מתריסר הערכות, והסטייה הזו בתוך הרעש של איך שהוא חושב."
          : latest.surprisePercent > 0
            ? "החברה דיווחה מעל הצפי. הפתעה חיובית אומרת משהו על מה שהאנליסטים לא ידעו — לא בהכרח על מה שהעסק עשה."
            : "החברה דיווחה מתחת לצפי. פספוס אחד אינו מגמה; פספוס שני באותו סעיף הוא.",
      direction:
        size < SURPRISE_NOISE
          ? "flat"
          : latest.surprisePercent > 0
            ? "better"
            : "worse",
    });
  } else {
    yardsticks.push({
      label: "מול הקונצנזוס",
      figure: "—",
      body: "לא נמצאה הערכת אנליסטים לרבעון הזה בנתונים החינמיים, ולכן אין מול מה למדוד את הדיווח.",
      direction: "unknown",
    });
  }

  /* ---- Against the previous quarter ---- */
  if (
    previousQuarter?.actual !== null &&
    previousQuarter !== null &&
    latest.actual !== null &&
    previousQuarter.actual !== 0
  ) {
    const step =
      ((latest.actual - previousQuarter.actual) / Math.abs(previousQuarter.actual)) *
      100;
    yardsticks.push({
      label: "מול הרבעון הקודם",
      figure: `${eps(latest.actual)} מול ${eps(previousQuarter.actual)} · ${pct(step)}`,
      body:
        "ההשוואה הרציפה היא זו שמראה תפנית ראשונה, והיא גם זו שעונה על עונתיות באופן הגרוע ביותר — עסק עם רבעון חגים ייראה כאן חלש בכל רבעון ראשון.",
      direction: step > 2 ? "better" : step < -2 ? "worse" : "flat",
    });
  }

  /* ---- Against the same quarter last year ---- */
  if (yearAgo?.actual !== null && yearAgo !== null && latest.actual !== null && yearAgo.actual !== 0) {
    const growth =
      ((latest.actual - yearAgo.actual) / Math.abs(yearAgo.actual)) * 100;
    yardsticks.push({
      label: "מול אותו רבעון אשתקד",
      figure: `${eps(latest.actual)} מול ${eps(yearAgo.actual)} · ${pct(growth)}`,
      body:
        "ההשוואה העונתית. זו ההשוואה שמנטרלת רבעון חזק או חלש מסיבות לוח שנה, ולכן היא הקריאה המהימנה ביותר על כיוון.",
      direction: growth > 2 ? "better" : growth < -2 ? "worse" : "flat",
    });
  } else {
    yardsticks.push({
      label: "מול אותו רבעון אשתקד",
      figure: "—",
      body: "לא נמצא באותם נתונים רבעון מקביל משנה שעברה. ההשוואה העונתית לא חושבה ולא הוחלפה בקירוב.",
      direction: "unknown",
    });
  }

  /* ---- The record ---- */
  const withEstimates = reported.filter(
    (row) => row.surprisePercent !== null && Number.isFinite(row.surprisePercent),
  );
  const beats = withEstimates.filter((row) => (row.surprisePercent ?? 0) > 0).length;
  const misses = withEstimates.length - beats;

  const record =
    withEstimates.length >= 4
      ? {
          beats,
          misses,
          quarters: withEstimates.length,
          note:
            beats === withEstimates.length
              ? "החברה הכתה את הצפי בכל רבעון שנמדד. שיא כזה אומר בעיקר שההנחיה שמרנית — הוא לא הופך הכאה נוספת להפתעה."
              : beats > misses
                ? "החברה מכה את הצפי לרוב, ולכן הכאה כשלעצמה אינה מידע חדש. הגודל שלה כן."
                : "החברה מפספסת לא פחות משהיא מכה. במצב כזה הקונצנזוס אינו עוגן טוב, וההשוואה העונתית מועילה יותר.",
        }
      : null;

  /* ---- Which thesis assumptions this bears on ---- */
  const bearsOn: string[] = [];
  const margins = fundamentals.groups
    .flatMap((group) => group.metrics)
    .filter((metric) =>
      ["operating_margin", "fcf_margin", "rev_cagr_3"].includes(metric.key),
    );

  for (const metric of margins) {
    if (metric.value === null) continue;
    bearsOn.push(
      `${metric.label} עומד על ${metric.value.toFixed(1)}% לפי הדוחות המצטברים. דוח רבעוני חדש הוא הקלט הבא שישנה אותו.`,
    );
  }

  if (fundamentals.asOf) {
    bearsOn.push(
      `המדדים בעמוד נגזרים מהדוח שמסתיים ב-${fundamentals.asOf.end}. רווח למניה לרבעון ${latest.period} מגיע מ-Finnhub ואינו מוזג לתוכם — שני מקורות, שתי תדירויות.`,
    );
  }

  /* ---- The grade ----
     The figures are reported facts; what they mean for the thesis is not.
     A surprise inside the noise band gets graded down rather than dressed
     up, because a 1% beat presented as an event is how a tool teaches its
     reader to ignore it. */
  const surpriseSize =
    latest.surprisePercent !== null ? Math.abs(latest.surprisePercent) : 0;

  const grade: Grade =
    latest.estimate === null
      ? "possible"
      : surpriseSize >= SURPRISE_NOISE
        ? "confirmed"
        : "possible";

  return {
    ticker: ticker.toUpperCase(),
    period: latest.period,
    quarter: latest.quarter,
    year: latest.year,
    actual: latest.actual,
    estimate: latest.estimate,
    surprisePercent: latest.surprisePercent,
    yardsticks,
    record,
    bearsOn,
    claim: {
      grade,
      basis: `רווח למניה מדווח ${eps(latest.actual)} לרבעון ${latest.period}, מול קונצנזוס ${eps(latest.estimate)}`,
      limits:
        "הדיווח הוא עובדה; מה שהוא עושה למחיר אינו. רווח למניה גם ניתן לניהול דרך רכישות עצמיות וסעיפים חד-פעמיים, ולכן הוא לא מחליף את המרווחים והתזרים שבדוחות.",
    },
    missing: [
      "הנחיית ההנהלה לרבעון הבא אינה זמינה בשכבה החינמית של Finnhub, ולכן לא מושווית כאן. הנחיה היא לרוב הגורם שמזיז את המחיר יותר מהתוצאה עצמה, וההיעדר הזה נאמר במפורש ולא מוחלף באומדן.",
      "הכנסות ברמת הרבעון אינן נמשכות מאותו מקור. מה שמוצג כאן הוא רווח למניה בלבד.",
    ],
  };
}

/** The read, as a signal for the briefing. */
export function earningsSignal(
  read: EarningsRead,
  companyName: string,
  watched = false,
): Signal {
  const consensus = read.yardsticks[0];
  const seasonal = read.yardsticks.find(
    (yardstick) => yardstick.label === "מול אותו רבעון אשתקד",
  );

  const evidence: SignalEvidence[] = read.yardsticks
    .filter((yardstick) => yardstick.figure !== "—")
    .map((yardstick) => ({
      label: yardstick.label,
      value: yardstick.figure,
      source: { origin: "Finnhub" as const, asOf: read.period },
    }));

  if (read.record) {
    evidence.push({
      label: "שיא הכאות",
      value: `${read.record.beats}/${read.record.quarters}`,
      source: { origin: "Finnhub", asOf: read.period },
      note: read.record.note,
    });
  }

  return {
    id: `earnings:${read.ticker}:${read.period}`,
    kind: "earnings",
    headline: `${companyName} דיווחה ${eps(read.actual)} לרבעון ${read.period}${
      read.surprisePercent !== null ? ` (${pct(read.surprisePercent)} מול הצפי)` : ""
    }`,
    soWhat:
      seasonal && seasonal.direction !== "unknown"
        ? seasonal.body
        : consensus.body,
    claim: read.claim,
    evidence,
    materiality: materialityOf({
      kind: "earnings",
      grade: read.claim.grade,
      magnitude:
        read.surprisePercent !== null
          ? Math.min(Math.abs(read.surprisePercent) / 15, 1)
          : 0,
      watched,
    }),
    ticker: read.ticker,
    href: `/company/${read.ticker}`,
    at: read.period,
  };
}
