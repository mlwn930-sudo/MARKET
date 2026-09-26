import { unstable_cache } from "next/cache";
import { getMacroBoard } from "@/lib/sources/macro";
import { getSectorViews, type SectorView } from "@/lib/sectors";
import { getLiveFeed } from "@/lib/live-news";
import { whyMoving } from "@/lib/analysis/why-moving";
import type { EnrichedArticle } from "@/lib/news-shape";
import {
  recentChanges,
  upcomingCatalysts,
  historyIsEmpty,
  type StoredCatalyst,
  type StoredChange,
} from "./history-store";
import { thesisChangeSignal, type ThesisChange } from "./thesis-memory";
import { traceMacro, transmissionSignals, type TransmissionChain } from "./transmission";
import {
  material,
  materialityOf,
  byMateriality,
  type Signal,
} from "./signals";

/**
 * The daily intelligence briefing.
 *
 * The site already had a daily brief: what moved, what was published, and
 * a narrative written over the top. This is the other half — not what
 * happened, but *what changed*, which is a different and much shorter
 * list. A market where forty-eight companies traded and nothing changed
 * produces a two-line briefing, and that is the correct output rather than
 * a failure to find material.
 *
 * Everything here is composed from data the site already holds. The one
 * genuinely expensive input — whether a company's thesis moved, which
 * means running the whole agent pipeline — is read from the file the
 * nightly job writes. Doing that work inside a page request for
 * forty-eight companies would take minutes and burn the rate limit on a
 * single visit.
 *
 * The ordering rule is the product: signals are sorted by materiality and
 * cut at a floor, so a thesis change outranks a 6% day and a 6% day
 * outranks a headline. The temptation with a page like this is to show
 * everything found and let the reader sort it out, which is how a briefing
 * becomes a log.
 */

export type WatchCompany = {
  ticker: string;
  name: string;
  sectorLabel: string;
  changePercent: number | null;
  /** Why this one is on the list, not just that it moved. */
  reason: string;
};

export type WatchSector = {
  key: string;
  label: string;
  averageMove: number | null;
  advancing: number;
  quoted: number;
  reason: string;
};

export type IntelBriefing = {
  builtAt: string;
  /** One sentence about the tape, so the rest has a frame. */
  marketLine: string;
  signals: Signal[];
  chains: TransmissionChain[];
  thesisChanges: StoredChange[];
  companies: WatchCompany[];
  sectors: WatchSector[];
  risks: Signal[];
  catalysts: StoredCatalyst[];
  /** What the briefing could not see, named. */
  coverage: string[];
  /** True when nothing cleared the materiality floor. */
  quiet: boolean;
};

const pct = (value: number, digits = 2) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}%`;

/** A move worth explaining. Below this the honest answer is "the market
 *  was open", and `why-moving` says exactly that. */
const NOTABLE_MOVE = 4;

/* ------------------------------------------------------------------ */
/* Price moves                                                         */
/* ------------------------------------------------------------------ */

function priceSignals({
  sectors,
  indexChange,
  articlesByTicker,
}: {
  sectors: SectorView[];
  indexChange: number | null;
  articlesByTicker: Map<string, EnrichedArticle[]>;
}): Signal[] {
  const signals: Signal[] = [];

  for (const sector of sectors) {
    for (const member of sector.members) {
      if (member.changePercent === null) continue;
      if (Math.abs(member.changePercent) < NOTABLE_MOVE) continue;

      const reading = whyMoving({
        ticker: member.ticker,
        changePercent: member.changePercent,
        indexChange,
        sectorChange: sector.averageMove,
        sectorLabel: sector.label,
        peersAdvancing: sector.advancing,
        peersQuoted: sector.quoted,
        articles: articlesByTicker.get(member.ticker) ?? [],
      });

      if (!reading) continue;

      /* The grade of the *explanation*, not of the move. The move is a
         print and always confirmed; what this signal claims is a reason,
         and when nothing explains it the claim is weak by construction —
         which is the honest way to publish a 7% day nobody can account
         for. */
      const claim = reading.best ?? {
        grade: "speculative" as const,
        basis: `${member.ticker} ${pct(member.changePercent)}`,
        limits:
          "התנועה נמדדה; ההסבר לה לא. המדד, הסקטור והפיד לא מספקים מועמד.",
      };

      signals.push({
        id: `move:${member.ticker}`,
        kind: "price-move",
        headline: `${member.name} ${pct(member.changePercent)}`,
        soWhat:
          reading.unexplained ??
          reading.drivers.find((driver) => driver.key !== "ordinary")?.body ??
          "",
        claim,
        evidence: reading.drivers.map((driver) => ({
          label: driver.title,
          value: driver.figure,
          source: { origin: "Yahoo" as const, asOf: null },
          note: driver.limits,
        })),
        /* Graded `confirmed` deliberately, and it is the one place in this
           file where the materiality grade and the claim grade differ.

           The claim above is about the *cause*, and on most days it is
           weak. The move itself is a print. Scoring materiality off the
           explanation would have buried a 7% day precisely because nobody
           could account for it — and a large move nobody can account for
           is more worth a reader's attention, not less. The grade the
           reader sees on the card is still the explanation's. */
        materiality: materialityOf({
          kind: "price-move",
          grade: "confirmed",
          magnitude: Math.min(Math.abs(member.changePercent) / 10, 1),
        }),
        ticker: member.ticker,
        sector: sector.key,
        href: `/company/${member.ticker}`,
        at: new Date().toISOString(),
      });
    }
  }

  return signals;
}

/* ------------------------------------------------------------------ */
/* News                                                                */
/* ------------------------------------------------------------------ */

function newsSignals(articles: EnrichedArticle[]): Signal[] {
  /* Only stories a reading judged to change the business, and only ones
     that name a company. A catalyst nobody can attach to a ticker is a
     headline, and a briefing full of headlines is a feed. */
  return articles
    .filter(
      (article) =>
        article.analysis?.catalystKind === "catalyst" &&
        (article.analysis.tickers.length > 0 || article.tickers.length > 0),
    )
    .slice(0, 8)
    .map((article, index) => {
      const tickers = [
        ...new Set([...(article.analysis?.tickers ?? []), ...article.tickers]),
      ];

      return {
        id: `news:${index}:${article.url.slice(-24)}`,
        kind: "company-news" as const,
        headline: article.title,
        soWhat: article.analysis?.impact ?? "",
        claim: {
          grade: "possible" as const,
          basis: `סווגה כזרז בקריאה מלאה · ${article.domain}`,
          limits:
            "הסיווג אומר שהאירוע נוגע לתזרים, לתחרות או לרגולציה. הוא אינו מוכיח שהמחיר הגיב, ואינו מודד את הגודל.",
        },
        evidence: [
          {
            label: "מקור",
            value: article.domain,
            source: { origin: "חישוב" as const, asOf: article.seenAt ?? null },
          },
          {
            label: "חברות שזוהו",
            value: tickers.join(" · "),
            source: { origin: "חישוב" as const, asOf: null },
            note: "זוהו מטקסט הכתבה ומטבלת השמות של האתר",
          },
          ...(article.analysis?.chain
            ? [
                {
                  label: "שרשרת הערך",
                  value: article.analysis.chain,
                  source: { origin: "חישוב" as const, asOf: null },
                },
              ]
            : []),
        ],
        materiality: materialityOf({
          kind: "company-news",
          grade: "possible",
          magnitude: article.analysis?.significance === "high" ? 1 : 0.4,
        }),
        ticker: tickers[0],
        href: `/company/${tickers[0]}`,
        at: article.seenAt ?? new Date().toISOString(),
      };
    });
}

/* ------------------------------------------------------------------ */
/* Risk                                                                */
/* ------------------------------------------------------------------ */

/**
 * What is worth being uneasy about today.
 *
 * Measured conditions only. This section is not a place for a general
 * warning about markets being risky — every reader knows that, and a
 * standing caveat that never changes is one the eye stops seeing.
 */
function riskSignals({
  vix,
  sectors,
}: {
  vix: { value: number | null; changePercent: number | null } | null;
  sectors: SectorView[];
}): Signal[] {
  const signals: Signal[] = [];
  const now = new Date().toISOString();

  if (vix?.value !== null && vix?.value !== undefined && vix.value >= 25) {
    signals.push({
      id: "risk:vix",
      kind: "risk",
      headline: `VIX על ${vix.value.toFixed(1)}`,
      soWhat:
        "מעל 25 נחשב שוק מתוח. ברמות האלה התנועות היומיות גדולות יותר, וסטופ שנקבע לפי תנודתיות של שוק רגוע נפגע מרעש ולא מתזה שנשברה.",
      claim: {
        grade: "confirmed",
        basis: `VIX ${vix.value.toFixed(1)}${vix.changePercent !== null ? ` · ${pct(vix.changePercent)}` : ""}`,
        limits:
          "התנודתיות הגלומה היא תמחור של אופציות לחודש הקרוב, לא תחזית כיוון. VIX גבוה אומר תנועות גדולות — לא תנועות למטה.",
      },
      evidence: [
        {
          label: "VIX",
          value: vix.value.toFixed(1),
          source: { origin: "Yahoo", asOf: null },
        },
      ],
      materiality: materialityOf({
        kind: "risk",
        grade: "confirmed",
        magnitude: Math.min((vix.value - 25) / 20, 1),
      }),
      href: "/macro",
      at: now,
    });
  }

  /* Breadth: a sector where almost nothing is up is a group event, and a
     group event is the case where a company-level explanation is most
     likely to be wrong. */
  for (const sector of sectors) {
    if (sector.quoted < 4 || sector.averageMove === null) continue;
    const share = sector.advancing / sector.quoted;
    if (share > 0.15 || sector.averageMove > -1.5) continue;

    signals.push({
      id: `risk:breadth:${sector.key}`,
      kind: "risk",
      headline: `${sector.label} — ${sector.advancing} מתוך ${sector.quoted} בירוק`,
      soWhat:
        "כשכמעט כל הסקטור יורד יחד, ההסבר נמצא ברמת הקבוצה. חיפוש סיבה ספציפית לחברה אחת בתוך יום כזה הוא הדרך המהירה למצוא קשר שלא קיים.",
      claim: {
        grade: "confirmed",
        basis: `ממוצע שווה ${pct(sector.averageMove)} על ${sector.quoted} חברות`,
        limits:
          "רוחב שלילי הוא מדידה של היום. הוא לא אומר דבר על מחר ולא על אף חברה בפרט.",
      },
      evidence: [
        {
          label: "ממוצע הסקטור",
          value: pct(sector.averageMove),
          source: { origin: "חישוב", asOf: null, note: "ממוצע שווה" },
        },
        {
          label: "רוחב",
          value: `${sector.advancing}/${sector.quoted}`,
          source: { origin: "חישוב", asOf: null },
        },
      ],
      materiality: materialityOf({
        kind: "risk",
        grade: "confirmed",
        magnitude: Math.min(Math.abs(sector.averageMove) / 5, 1),
      }),
      sector: sector.key,
      href: `/sectors/${sector.key}`,
      at: now,
    });
  }

  return signals;
}

/* ------------------------------------------------------------------ */
/* The briefing                                                        */
/* ------------------------------------------------------------------ */

async function build(): Promise<IntelBriefing> {
  const [macro, sectors, feed, changes, catalysts, noHistory] = await Promise.all([
    getMacroBoard().catch(() => ({ instruments: [], builtAt: "" })),
    getSectorViews().catch(() => [] as SectorView[]),
    getLiveFeed().catch(() => null),
    recentChanges().catch(() => [] as StoredChange[]),
    upcomingCatalysts().catch(() => [] as StoredCatalyst[]),
    historyIsEmpty().catch(() => true),
  ]);

  const index =
    macro.instruments.find((instrument) => instrument.symbol === "^GSPC") ?? null;
  const vix =
    macro.instruments.find((instrument) => instrument.symbol === "^VIX") ?? null;

  const articles = feed
    ? [
        ...new Map(
          feed.sectors.flatMap((sector) => sector.articles).map((a) => [a.url, a]),
        ).values(),
      ]
    : [];

  /* Indexed once rather than filtered per company — forty-eight linear
     scans over a two-hundred-story feed is the kind of thing that only
     shows up as a slow page once the feed grows. */
  const articlesByTicker = new Map<string, EnrichedArticle[]>();
  for (const article of articles) {
    for (const ticker of new Set([
      ...(article.analysis?.tickers ?? []),
      ...article.tickers,
    ])) {
      const list = articlesByTicker.get(ticker) ?? [];
      list.push(article);
      articlesByTicker.set(ticker, list);
    }
  }

  const chains = traceMacro({ instruments: macro.instruments, sectors });

  const signals = material([
    ...changes.map((change) => thesisChangeSignal(change as ThesisChange)),
    ...transmissionSignals(chains),
    ...priceSignals({
      sectors,
      indexChange: index?.changePercent ?? null,
      articlesByTicker,
    }),
    ...newsSignals(articles),
  ]);

  const risks = riskSignals({ vix, sectors }).sort(byMateriality);

  /* ---- Companies to watch ----
     Ordered by the signal that named them, not by how much they moved. A
     company whose thesis changed outranks one that had a loud day, which
     is the whole ordering principle of this page. */
  const seen = new Set<string>();
  const companies: WatchCompany[] = [];

  for (const signal of signals) {
    if (!signal.ticker || seen.has(signal.ticker)) continue;

    const sector = sectors.find((view) =>
      view.members.some((member) => member.ticker === signal.ticker),
    );
    const member = sector?.members.find((m) => m.ticker === signal.ticker);

    seen.add(signal.ticker);
    companies.push({
      ticker: signal.ticker,
      name: member?.name ?? signal.ticker,
      sectorLabel: sector?.label ?? "",
      changePercent: member?.changePercent ?? null,
      reason: signal.headline,
    });

    if (companies.length >= 8) break;
  }

  /* ---- Sectors to watch ---- */
  const watchSectors: WatchSector[] = sectors
    .filter((sector) => sector.averageMove !== null && sector.quoted >= 3)
    .sort(
      (a, b) => Math.abs(b.averageMove ?? 0) - Math.abs(a.averageMove ?? 0),
    )
    .slice(0, 4)
    .map((sector) => {
      const chain = chains.find((c) => c.sector.key === sector.key);
      return {
        key: sector.key,
        label: sector.label,
        averageMove: sector.averageMove,
        advancing: sector.advancing,
        quoted: sector.quoted,
        reason: chain
          ? `${chain.moveText} — ${chain.observed?.agrees ? "והסקטור זז לכיוון שהמנגנון צופה" : "והסקטור זז נגד המנגנון"}`
          : `${sector.advancing} מתוך ${sector.quoted} בירוק. אין בלוח המאקרו משתנה שזז מספיק כדי להסביר את הסקטור הזה היום.`,
      };
    });

  /* ---- What the briefing could not see ---- */
  const coverage: string[] = [];
  if (noHistory) {
    coverage.push(
      "היסטוריית התזות עדיין לא נבנתה, ולכן אין כאן זיהוי של שינויי תזה. הסקריפט הלילי בונה אותה בהרצה הראשונה; עד אז ההיעדר הזה אינו אומר שדבר לא השתנה.",
    );
  }
  if (macro.instruments.length === 0) {
    coverage.push(
      "לוח המאקרו לא נטען, ולכן לא נבדקה אף שרשרת העברה מהמאקרו לסקטורים.",
    );
  }
  if (!feed) {
    coverage.push("פיד החדשות לא נטען, ולכן אין כאן אירועים ברמת החברה.");
  }
  if (sectors.length === 0) {
    coverage.push(
      "תצוגות הסקטורים לא נטענו, ולכן אין רוחב, אין ממוצעים ואין תנועות חברה.",
    );
  }
  coverage.push(
    "מחזור מסחר ותמהיל המלצות נמדדים בעמוד של כל חברה, אך לא ברשימת התנועות כאן — היא נבנית מציטוטי הסקטורים בלבד, בלי נרות ובלי דירוגים, כדי שלא תדרוש ארבעים ושמונה משיכות נוספות בכל טעינה.",
  );
  coverage.push(
    "הנחיית הנהלה אינה זמינה בשכבה החינמית של Finnhub ואינה נמדדת בשום מקום באתר. היא לרוב מה שמזיז את המחיר יותר מהתוצאה עצמה, וההיעדר הזה נאמר ולא מוחלף באומדן.",
  );

  const marketLine =
    index?.changePercent !== null && index?.changePercent !== undefined
      ? `S&P 500 ${pct(index.changePercent)}${
          vix?.value !== null && vix?.value !== undefined
            ? ` · VIX ${vix.value.toFixed(1)}`
            : ""
        }`
      : "לא נקרא ציטוט למדד הייחוס";

  return {
    builtAt: new Date().toISOString(),
    marketLine,
    signals,
    chains,
    thesisChanges: changes,
    companies,
    sectors: watchSectors,
    risks,
    catalysts,
    coverage,
    /* Quiet means the page found nothing, not that one section is empty.
       The macro chains are published below their own materiality floor —
       they are context rather than headlines — so a day with six of them
       and no signals is not a quiet day, and saying otherwise would
       contradict the six panels further down the same page. */
    quiet: signals.length === 0 && risks.length === 0 && chains.length === 0,
  };
}

/**
 * Five minutes.
 *
 * Long enough that a reader refreshing the page does not re-run the fan
 * out, short enough that a briefing opened after lunch is not describing
 * the morning. The heavy half of the work is already behind the nightly
 * file; what is cached here is the composition.
 */
export const getIntelBriefing = unstable_cache(build, ["intel-briefing", "v1"], {
  revalidate: 300,
  tags: ["intel", "news", "sectors"],
});
