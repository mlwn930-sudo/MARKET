import type { Instrument } from "@/lib/sources/macro";
import type { SectorView } from "@/lib/sectors";
import type { SectorKey } from "@/lib/universe";
import { SECTOR_LABELS } from "@/lib/universe";
import { gradeByCoMovement, weakestGrade, type Grade, type GradedClaim } from "./confidence";
import { materialityOf, type Signal } from "./signals";

/**
 * From a macro variable to a company, one step at a time.
 *
 * The chain the reader is owed looks like this:
 *
 *   the ten-year yield rose 11 basis points        ← a print
 *   long-duration valuations discount harder       ← a mechanism
 *   software and semiconductors carry that duration ← a mapping
 *   NVDA, AMD, AVGO are in that sector             ← a membership
 *
 * Only the first step is a fact. The second is a textbook mechanism, the
 * third is a judgement written into the table below, and the fourth is
 * bookkeeping. A site that prints the whole chain in one voice has told
 * the reader that a rate move *caused* NVDA to fall, which it has not
 * measured and cannot.
 *
 * So the chain is graded by its weakest link, and it is graded *upwards
 * only by measurement*: when the sector actually moved the way the
 * mechanism predicts, today, that is checked here and the chain earns
 * "possible" or "likely". When the sector moved the other way, that is
 * reported too — a mechanism that failed today is more informative than
 * one that was never tested, and hiding it would leave the reader with a
 * theory that never loses.
 */

/* ------------------------------------------------------------------ */
/* The map                                                             */
/* ------------------------------------------------------------------ */

type Sensitivity = {
  sector: SectorKey;
  /** +1: the sector benefits when this instrument rises. −1: it suffers. */
  direction: 1 | -1;
  /** 0–1. How much of this sector's behaviour the variable usually drives.
   *  Used to order the sectors, never printed as a figure — it is a
   *  judgement, and a judgement with two decimal places is a lie. */
  weight: number;
  /** Why. Printed. A link in this chain without a stated mechanism is an
   *  arrow drawn between two boxes. */
  mechanism: string;
};

type MacroLink = {
  /** What a rise in this variable is, in one clause. */
  rising: string;
  falling: string;
  sectors: Sensitivity[];
};

/**
 * What each macro variable transmits, and through what.
 *
 * Deliberately short. Every row here is a claim the site is willing to
 * defend in a sentence, and the temptation with a table like this is to
 * fill it in until every instrument touches every sector — at which point
 * it explains everything and therefore nothing.
 */
const MAP: Record<string, MacroLink> = {
  /* ---- The price of money ---- */
  "^TNX": {
    rising: "הריבית חסרת הסיכון עלתה",
    falling: "הריבית חסרת הסיכון ירדה",
    sectors: [
      {
        sector: "software",
        direction: -1,
        weight: 0.9,
        mechanism:
          "רוב השווי של חברת תוכנה יושב בתזרים של השנים הרחוקות. כשהריבית שמהוונים בה עולה, הערך הנוכחי של אותו תזרים קטן יותר מאשר אצל חברה שהרווח שלה מגיע השנה.",
      },
      {
        sector: "semis",
        direction: -1,
        weight: 0.8,
        mechanism:
          "אותו היוון, ובנוסף מחזור השקעות הון כבד שמתומחר בריבית — מפעל נבנה בכסף מגויס.",
      },
      {
        sector: "internet",
        direction: -1,
        weight: 0.7,
        mechanism:
          "מכפילים גבוהים על צמיחה עתידית, ולכן רגישות גבוהה לשיעור ההיוון.",
      },
      {
        sector: "financials",
        direction: 1,
        weight: 0.7,
        mechanism:
          "בנק מרוויח על המרווח בין ריבית ההלוואה לריבית הפיקדון. עקום תלול יותר מרחיב אותו — עד שהוא מייקר אשראי ומכביד על איכות התיק.",
      },
      {
        sector: "consumer",
        direction: -1,
        weight: 0.6,
        mechanism:
          "משכנתה, אשראי צרכני ומימון רכב מתייקרים, וההוצאה שאינה חיונית היא הראשונה שנחתכת.",
      },
      {
        sector: "industrials",
        direction: -1,
        weight: 0.5,
        mechanism: "פרויקטי הון ארוכים מתומחרים בעלות מימון.",
      },
    ],
  },

  /* ---- Fear ---- */
  "^VIX": {
    rising: "התנודתיות הגלומה עלתה",
    falling: "התנודתיות הגלומה ירדה",
    sectors: [
      {
        sector: "semis",
        direction: -1,
        weight: 0.8,
        mechanism:
          "בסביבת סיכון הסקטורים עם ה-beta הגבוה ביותר נמכרים ראשונים, ומוליכים למחצה הם ה-beta הגבוה של השוק האמריקאי.",
      },
      {
        sector: "internet",
        direction: -1,
        weight: 0.6,
        mechanism: "מכפילים גבוהים נמכרים ראשונים כשהסיכון מתומחר מחדש.",
      },
      {
        sector: "software",
        direction: -1,
        weight: 0.6,
        mechanism: "אותו מנגנון: מכפיל גבוה, רגישות גבוהה לתיאבון לסיכון.",
      },
    ],
  },

  /* ---- Oil ---- */
  "CL=F": {
    rising: "הנפט התייקר",
    falling: "הנפט הוזל",
    sectors: [
      {
        sector: "energy",
        direction: 1,
        weight: 0.9,
        mechanism:
          "מחיר הנפט הוא ההכנסה של הסקטור הזה כמעט אחד לאחד, ומעליו רווחיות התזקיק.",
      },
      {
        sector: "industrials",
        direction: -1,
        weight: 0.6,
        mechanism:
          "דלק ולוגיסטיקה הם תשומה ישירה. תעופה ומשלוחים מרגישים את זה ראשונים.",
      },
      {
        sector: "consumer",
        direction: -1,
        weight: 0.5,
        mechanism:
          "מה שנשרף במיכל לא נשאר לצריכה. מחיר דלק גבוה הוא מס רגרסיבי על ההוצאה הפנויה.",
      },
    ],
  },

  /* ---- The dollar ---- */
  "DX-Y.NYB": {
    rising: "הדולר התחזק",
    falling: "הדולר נחלש",
    sectors: [
      {
        sector: "semis",
        direction: -1,
        weight: 0.8,
        mechanism:
          "רוב ההכנסות של הסקטור נמכרות מחוץ לארצות הברית. דולר חזק מקטין אותן כשהן מתורגמות חזרה, בלי ששום דבר בעסק השתנה.",
      },
      {
        sector: "healthcare",
        direction: -1,
        weight: 0.5,
        mechanism: "חברות התרופות הגדולות מוכרות בעולם ומדווחות בדולר.",
      },
      {
        sector: "internet",
        direction: -1,
        weight: 0.5,
        mechanism: "פרסום ומנויים בשווקים זרים מתורגמים חזרה בשער נמוך יותר.",
      },
    ],
  },

  /* ---- Gold ---- */
  "GC=F": {
    rising: "הזהב עלה",
    falling: "הזהב ירד",
    sectors: [
      {
        sector: "financials",
        direction: -1,
        weight: 0.4,
        mechanism:
          "עלייה חדה בזהב יחד עם ירידה במניות היא בריחה מסיכון, והפיננסים הם הסקטור שמתמחר סיכון מערכתי ראשון.",
      },
    ],
  },
};

/**
 * The same table, read from the other end: which macro variables a given
 * sector is exposed to.
 *
 * The company graph needs this — "what moves this company that is not this
 * company" — and deriving it here rather than writing a second table is
 * what keeps the two views from disagreeing. Strongest exposure first.
 */
export function macroDriversFor(sector: SectorKey): {
  symbol: string;
  name: string;
  direction: 1 | -1;
  mechanism: string;
}[] {
  const drivers: {
    symbol: string;
    name: string;
    direction: 1 | -1;
    mechanism: string;
    weight: number;
  }[] = [];

  for (const [symbol, link] of Object.entries(MAP)) {
    const hit = link.sectors.find((s) => s.sector === sector);
    if (!hit) continue;
    drivers.push({
      symbol,
      name: MACRO_NAMES[symbol] ?? symbol,
      direction: hit.direction,
      mechanism: hit.mechanism,
      weight: hit.weight,
    });
  }

  return drivers
    .sort((a, b) => b.weight - a.weight)
    .map(({ symbol, name, direction, mechanism }) => ({
      symbol,
      name,
      direction,
      mechanism,
    }));
}

/** Display names for the instruments this table covers. Kept beside the
 *  table so a symbol added to one is visibly missing from the other. */
const MACRO_NAMES: Record<string, string> = {
  "^TNX": "תשואת 10 שנים",
  "^VIX": "VIX",
  "CL=F": "נפט WTI",
  "DX-Y.NYB": "מדד הדולר",
  "GC=F": "זהב",
};

/** Below this a move is the instrument being quoted, not the instrument
 *  moving. Per kind, because 0.4% means nothing on the dollar and a great
 *  deal on a ten-year yield. */
const THRESHOLD: Record<Instrument["kind"], number> = {
  rate: 1.2,
  vol: 5,
  commodity: 2,
  currency: 0.5,
  index: 1,
};

/* ------------------------------------------------------------------ */
/* The chain                                                           */
/* ------------------------------------------------------------------ */

export type ChainStep = {
  label: string;
  /** The figure, when this step has one. A step with no figure is a
   *  mechanism, and the interface marks it as such. */
  figure: string | null;
  body: string;
  /** Where this step sits on the evidence scale on its own. */
  grade: Grade;
};

export type TransmissionChain = {
  id: string;
  instrument: { symbol: string; name: string };
  moveText: string;
  sector: { key: SectorKey; label: string; href: string };
  /** Which way the mechanism says this sector should go. */
  expected: "benefit" | "suffer";
  /** What the sector actually did today, when it could be measured. */
  observed: { changePercent: number; agrees: boolean } | null;
  steps: ChainStep[];
  claim: GradedClaim;
  /** The companies at the end of the chain, most affected first. */
  companies: { ticker: string; name: string; changePercent: number | null }[];
};

const pct = (value: number, digits = 2) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}%`;

/**
 * Traces every macro variable that moved enough to be worth tracing.
 *
 * Returns nothing on a quiet day, and that is the correct output. The
 * alternative — lowering the threshold until something always transmits —
 * would teach the reader that the ten-year yield explains the market every
 * single day, which is how a tool stops being believed.
 */
export function traceMacro({
  instruments,
  sectors,
}: {
  instruments: Instrument[];
  sectors: SectorView[];
}): TransmissionChain[] {
  const chains: TransmissionChain[] = [];

  for (const instrument of instruments) {
    const link = MAP[instrument.symbol];
    if (!link) continue;

    const move = instrument.changePercent;
    if (move === null || !Number.isFinite(move)) continue;
    if (Math.abs(move) < THRESHOLD[instrument.kind]) continue;

    const rising = move > 0;

    for (const sensitivity of link.sectors) {
      const view = sectors.find((s) => s.key === sensitivity.sector);
      /* A sector with no quotes today cannot be checked against the
         mechanism, and a chain that cannot be checked is not published. */
      if (!view || view.averageMove === null) continue;

      // Which way the mechanism predicts this sector goes.
      const expectedSign = rising ? sensitivity.direction : -sensitivity.direction;
      const expected = expectedSign > 0 ? "benefit" : "suffer";
      const agrees = view.averageMove * expectedSign > 0;

      /* The grade of the whole chain. The macro print is confirmed and the
         sector's own move is confirmed; what is *not* confirmed is that one
         produced the other, and that is what the chain claims. So the
         middle link caps it: a mechanism that the day agrees with earns at
         most "possible", and it reaches "likely" only when the sector also
         moved with the size the co-movement test wants. */
      const measured = agrees
        ? gradeByCoMovement(view.averageMove, move * sensitivity.weight)
        : "speculative";

      const grade = weakestGrade([measured, agrees ? "possible" : "speculative"]);

      const steps: ChainStep[] = [
        {
          label: rising ? link.rising : link.falling,
          figure: `${instrument.name} ${pct(move)}`,
          body: instrument.note ?? "",
          grade: "confirmed",
        },
        {
          label: "המנגנון",
          figure: null,
          body: sensitivity.mechanism,
          grade: "speculative",
        },
        {
          label: agrees
            ? `${SECTOR_LABELS[sensitivity.sector]} אכן זז לכיוון שהמנגנון צופה`
            : `${SECTOR_LABELS[sensitivity.sector]} זז לכיוון ההפוך מהצפוי`,
          figure: `${view.label} ${pct(view.averageMove)}`,
          body: agrees
            ? `ממוצע שווה של ${view.quoted} חברות בסקטור. התאמה בכיוון אינה קשר סיבתי — אבל אי-התאמה הייתה שוללת את השרשרת, ולכן היא נבדקת ומוצגת.`
            : `ממוצע שווה של ${view.quoted} חברות בסקטור. המנגנון צפה את הכיוון ההפוך, כלומר משהו אחר שלט בסקטור הזה היום. השרשרת מוצגת דווקא משום כך: מנגנון שלא נבדק הוא מנגנון שלא מפסיד לעולם.`,
          grade: "confirmed",
        },
      ];

      const companies = [...view.members]
        .filter((member) => member.changePercent !== null)
        .sort((a, b) =>
          expectedSign > 0
            ? (b.changePercent ?? 0) - (a.changePercent ?? 0)
            : (a.changePercent ?? 0) - (b.changePercent ?? 0),
        )
        .slice(0, 4)
        .map((member) => ({
          ticker: member.ticker,
          name: member.name,
          changePercent: member.changePercent,
        }));

      chains.push({
        id: `${instrument.symbol}:${sensitivity.sector}`,
        instrument: { symbol: instrument.symbol, name: instrument.name },
        moveText: `${instrument.name} ${pct(move)}`,
        sector: {
          key: sensitivity.sector,
          label: SECTOR_LABELS[sensitivity.sector],
          href: `/sectors/${sensitivity.sector}`,
        },
        expected,
        observed: { changePercent: view.averageMove, agrees },
        steps,
        claim: {
          grade,
          basis: `${instrument.name} ${pct(move)} · ${view.label} ${pct(view.averageMove)} (ממוצע ${view.quoted} חברות)`,
          limits: agrees
            ? "התאמה בכיוון ביום אחד אינה מוכיחה שהמשתנה המאקרו הזה הוא שהזיז את הסקטור. ביום שבו השוק כולו זז, כל הסקטורים זזים איתו."
            : "הסקטור זז נגד המנגנון היום. השרשרת מוצגת כהשערה שנבדקה ולא אוששה, לא כהסבר.",
        },
        companies,
      });
    }
  }

  /* Strongest first, and one chain per sector — the reader does not need
     to be told three times that semiconductors are rate-sensitive. */
  const seen = new Set<string>();
  return chains
    .sort((a, b) => {
      const rank = { confirmed: 3, likely: 2, possible: 1, speculative: 0 };
      return rank[b.claim.grade] - rank[a.claim.grade];
    })
    .filter((chain) => {
      const key = chain.sector.key;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * The chains, as signals for the briefing.
 *
 * A chain whose mechanism the day contradicted is still published, but it
 * scores low: it is worth a line in a briefing and never a headline.
 */
export function transmissionSignals(chains: TransmissionChain[]): Signal[] {
  return chains.map((chain) => ({
    id: `transmission:${chain.id}`,
    kind: "transmission" as const,
    headline: `${chain.moveText} — ${chain.sector.label} ${chain.observed?.agrees ? "זז לאותו כיוון" : "זז נגד המנגנון"}`,
    soWhat: chain.steps[1].body,
    claim: chain.claim,
    evidence: [
      {
        label: chain.instrument.name,
        value: chain.moveText,
        source: { origin: "Yahoo", asOf: null },
        note: "הפרינט עצמו — החוליה היחידה בשרשרת שהיא עובדה",
      },
      {
        label: chain.sector.label,
        value: chain.observed ? pct(chain.observed.changePercent) : "—",
        source: { origin: "חישוב", asOf: null, note: "ממוצע שווה בסקטור" },
        note: chain.observed?.agrees
          ? "זז לכיוון שהמנגנון צופה"
          : "זז לכיוון ההפוך",
      },
      ...chain.companies.slice(0, 3).map((company) => ({
        label: company.ticker,
        value: company.changePercent !== null ? pct(company.changePercent) : "—",
        source: { origin: "Yahoo" as const, asOf: null },
        note: "בסקטור שבקצה השרשרת",
      })),
    ],
    materiality: materialityOf({
      kind: "transmission",
      grade: chain.claim.grade,
      magnitude: chain.observed
        ? Math.min(Math.abs(chain.observed.changePercent) / 3, 1)
        : 0,
    }),
    sector: chain.sector.key,
    href: chain.sector.href,
    at: new Date().toISOString(),
  }));
}
