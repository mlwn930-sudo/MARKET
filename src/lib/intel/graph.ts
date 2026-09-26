import type { CompanyIntelligence } from "@/lib/agents";
import type { EnrichedArticle } from "@/lib/news-shape";
import type { SectorView } from "@/lib/sectors";
import type { Fundamentals } from "@/lib/metrics/fundamentals";
import { SECTOR_LABELS, type SectorKey } from "@/lib/universe";
import { macroDriversFor } from "./transmission";
import type { Grade } from "./confidence";
import type { ThesisFingerprint } from "./thesis-memory";

/**
 * Everything one company is attached to.
 *
 * The site had eighteen pages and no answer to "what else should I be
 * looking at". A company page ended at its own figures; the sector page
 * did not know which of its members the reader had just read about; the
 * macro board moved in its own universe. This module is the connective
 * tissue, and it is deliberately not a force-directed picture of nodes and
 * springs — a graph drawn as a cloud of circles is decoration on a
 * research tool, because nothing in it can be clicked with intent.
 *
 * It is an index instead: grouped, ordered, every edge carrying the reason
 * it exists and how well that reason is evidenced. `relation` says what the
 * connection is; `why` says why the reader should care; `grade` says how
 * much the site is claiming. An edge without all three would be an arrow
 * drawn between two boxes, which is the thing this replaces.
 *
 * It fetches nothing. Every connection is composed from data the company
 * page already loaded, which is why it costs a render and not a request.
 */

export type ConnectionKind =
  | "sector"
  | "competitor"
  | "macro"
  | "catalyst"
  | "risk"
  | "news"
  | "earnings"
  | "thesis"
  | "research";

export const CONNECTION_LABELS: Record<ConnectionKind, string> = {
  sector: "הסקטור",
  competitor: "מתחרות",
  macro: "מאקרו",
  catalyst: "זרזים",
  risk: "סיכונים",
  news: "חדשות",
  earnings: "דוחות",
  thesis: "היסטוריית התזה",
  research: "מחקר",
};

export type Connection = {
  id: string;
  label: string;
  /** What this is, in two or three words. */
  relation: string;
  /** Why it is connected to this company. The sentence is the product. */
  why: string;
  grade: Grade;
  href?: string;
  /** A figure, when the connection has one. */
  figure?: string;
};

export type ConnectionGroup = {
  kind: ConnectionKind;
  label: string;
  /** What the whole group means for this company. */
  summary: string;
  connections: Connection[];
};

export type CompanyGraph = {
  ticker: string;
  companyName: string;
  groups: ConnectionGroup[];
  /** How many connections in total — the number the section header uses. */
  count: number;
};

const pct = (value: number, digits = 2) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}%`;

export function buildCompanyGraph({
  ticker,
  companyName,
  sectorKey,
  intelligence,
  sector,
  articles,
  fundamentals,
  history,
}: {
  ticker: string;
  companyName: string;
  sectorKey: SectorKey | null;
  intelligence: CompanyIntelligence | null;
  sector: SectorView | null;
  articles: EnrichedArticle[];
  fundamentals: Fundamentals;
  /** Recorded thesis snapshots, oldest first. */
  history: ThesisFingerprint[];
}): CompanyGraph {
  const groups: ConnectionGroup[] = [];
  const symbol = ticker.toUpperCase();

  /* ---- The sector ---------------------------------------------------- */
  if (sectorKey && sector) {
    const own = sector.members.find((member) => member.ticker === symbol);
    groups.push({
      kind: "sector",
      label: CONNECTION_LABELS.sector,
      summary: `כל מדד של ${companyName} באתר נמדד מול החציון של ${sector.label} — ${sector.peerCount} חברות. זו הסיבה שמכפיל של 28 אומר כאן דבר אחר מאשר בבנק.`,
      connections: [
        {
          id: `sector:${sectorKey}`,
          label: sector.label,
          relation: "הסקטור שהחברה נמדדת מולו",
          why: `${sector.quoted} מתוך ${sector.members.length} החברות בסקטור נסחרו היום, ${sector.advancing} מהן בירוק. תנועה משותפת של הקבוצה אינה חדשה על ${symbol}.`,
          grade: "confirmed",
          href: `/sectors/${sectorKey}`,
          figure:
            sector.averageMove !== null ? pct(sector.averageMove) : undefined,
        },
        ...(own && own.changePercent !== null && sector.averageMove !== null
          ? [
              {
                id: "sector:relative",
                label: "מול הסקטור היום",
                relation: "פער מהקבוצה",
                why:
                  Math.abs(own.changePercent - sector.averageMove) > 1
                    ? "הפער מול העמיתים הוא הסימן החזק ביותר שמשהו ספציפי לחברה קרה היום."
                    : "החברה נעה בקצב הקבוצה. במצב כזה ההסבר נמצא בסקטור ולא בחברה.",
                grade: "confirmed" as Grade,
                figure: pct(own.changePercent - sector.averageMove),
              },
            ]
          : []),
      ],
    });
  }

  /* ---- Competitors --------------------------------------------------- */
  const peerTickers = (intelligence?.peers ?? []).filter(
    (peer) => peer.toUpperCase() !== symbol,
  );

  if (peerTickers.length > 0 || (sector && sector.members.length > 1)) {
    /* Finnhub's peer list first — it is the company's own competitive set —
       and the sector's other members after it, because a peer list that
       stops at four is missing the ones this site can actually compare. */
    const inUniverse = new Set(
      (sector?.members ?? []).map((member) => member.ticker),
    );

    const peers = [...new Set([...peerTickers.slice(0, 6)])].map((peer) => {
      const member = sector?.members.find((m) => m.ticker === peer);
      return {
        id: `peer:${peer}`,
        label: peer,
        relation: member ? "מתחרה, נמדדת באתר" : "מתחרה לפי Finnhub",
        why: member
          ? `נמצאת ביקום ההשוואה, כך שאפשר להעמיד את שני סטי המדדים זה מול זה.`
          : `מופיעה ברשימת המתחרות של Finnhub אבל אינה ביקום המדדים של האתר, כך שאין לה כאן חציונים מחושבים.`,
        grade: "confirmed" as Grade,
        href: inUniverse.has(peer)
          ? `/compare?tickers=${symbol},${peer}`
          : `/company/${peer}`,
        figure:
          member?.changePercent !== null && member?.changePercent !== undefined
            ? pct(member.changePercent)
            : undefined,
      };
    });

    if (peers.length > 0) {
      groups.push({
        kind: "competitor",
        label: CONNECTION_LABELS.competitor,
        summary:
          "מתחרה שזזה לכיוון ההפוך באותו יום היא הראיה החזקה ביותר שמה שקרה ספציפי לחברה אחת ולא לענף.",
        connections: peers,
      });
    }
  }

  /* ---- Macro --------------------------------------------------------- */
  if (sectorKey) {
    const drivers = macroDriversFor(sectorKey);
    if (drivers.length > 0) {
      groups.push({
        kind: "macro",
        label: CONNECTION_LABELS.macro,
        summary: `המשתנים שמזיזים את ${SECTOR_LABELS[sectorKey]} מבחוץ. אלה מנגנונים, לא מדידות של היום — מה שנמדד היום נמצא בלוח המאקרו.`,
        connections: drivers.map((driver) => ({
          id: `macro:${driver.symbol}`,
          label: driver.name,
          relation: driver.direction > 0 ? "עלייה מיטיבה" : "עלייה מכבידה",
          why: driver.mechanism,
          /* A mechanism is a mechanism. It earns a better grade only on a
             day the transmission chain actually measured it. */
          grade: "speculative" as Grade,
          href: "/macro",
        })),
      });
    }
  }

  /* ---- Catalysts ----------------------------------------------------- */
  if (intelligence && intelligence.catalysts.length > 0) {
    groups.push({
      kind: "catalyst",
      label: CONNECTION_LABELS.catalyst,
      summary:
        "רק דברים עם תאריך או רמה מדודה. ציפייה בלי תאריך היא חלק מהתזה, לא לוח שנה.",
      connections: intelligence.catalysts.slice(0, 5).map((catalyst, i) => ({
        id: `catalyst:${i}`,
        label: catalyst.title,
        relation: catalyst.when,
        why: catalyst.why,
        grade: (catalyst.date ? "confirmed" : "possible") as Grade,
        figure: catalyst.date ?? undefined,
      })),
    });
  }

  /* ---- Risks --------------------------------------------------------- */
  const riskFindings = [
    ...(intelligence?.reports.find((report) => report.agent === "risk")
      ?.findings ?? []),
    ...(intelligence?.reports.find((report) => report.agent === "contrarian")
      ?.findings ?? []),
  ].slice(0, 5);

  if (riskFindings.length > 0) {
    groups.push({
      kind: "risk",
      label: CONNECTION_LABELS.risk,
      summary:
        "מה שסוכן הסיכון וסוכן ההתנגדות מצאו בנתונים. כל אחד מהם נושא את הראיה שהפיקה אותו.",
      connections: riskFindings.map((finding) => ({
        id: `risk:${finding.id}`,
        label: finding.title,
        relation: finding.stance === "opposes" ? "מתנגד לתזה" : "הסתייגות",
        why: finding.body,
        grade: (finding.confidence === "high"
          ? "likely"
          : finding.confidence === "medium"
            ? "possible"
            : "speculative") as Grade,
        figure: finding.evidence[0]?.value,
      })),
    });
  }

  /* ---- News ---------------------------------------------------------- */
  if (articles.length > 0) {
    const catalystArticles = articles.filter(
      (article) =>
        article.analysis?.catalystKind === "catalyst" ||
        article.triage?.kind === "catalyst",
    );

    groups.push({
      kind: "news",
      label: CONNECTION_LABELS.news,
      summary: `${articles.length} כתבות בפיד מזכירות את ${symbol}, ${catalystArticles.length} מהן סווגו כאירוע שנוגע לתזרים, לתחרות או לרגולציה.`,
      connections: articles.slice(0, 5).map((article, i) => ({
        id: `news:${i}`,
        label: article.title,
        relation:
          article.analysis?.catalystKind === "catalyst"
            ? "סווגה כזרז"
            : article.triage?.kind === "catalyst"
              ? "סיווג ראשוני: זרז"
              : "סיקור",
        why:
          article.analysis?.impact ??
          article.triage?.reason ??
          "נקלטה בפיד ומזכירה את החברה. סיקור אינו סיבה.",
        grade: (article.analysis?.catalystKind === "catalyst"
          ? "possible"
          : "speculative") as Grade,
        href: article.url,
      })),
    });
  }

  /* ---- Earnings ------------------------------------------------------ */
  if (fundamentals.asOf) {
    const ageDays =
      (Date.now() - new Date(fundamentals.asOf.end).getTime()) / 86_400_000;

    groups.push({
      kind: "earnings",
      label: CONNECTION_LABELS.earnings,
      summary:
        "כל מדד פונדמנטלי בעמוד הזה נגזר מהדוח שלהלן. כשהוא מתיישן, כל מה שנשען עליו מתיישן איתו.",
      connections: [
        {
          id: "earnings:latest",
          label: `הדוח לתקופה שמסתיימת ב-${fundamentals.asOf.end}`,
          relation: "מקור המדדים",
          why: `הוגש ב-${fundamentals.asOf.filed}, לפני ${Math.round(ageDays)} ימים. ${
            fundamentals.stale
              ? "מעל 120 יום — ייתכן שהמצב העסקי השתנה מאז, והאתר מסמן את זה בראש העמוד."
              : "בתוך חלון הדיווח הרגיל."
          }`,
          grade: "confirmed",
          href: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&ticker=${symbol}&type=10-Q&dateb=&owner=include&count=10`,
        },
      ],
    });
  }

  /* ---- Thesis history ------------------------------------------------ */
  if (history.length > 0) {
    const first = history[0];
    const last = history[history.length - 1];
    groups.push({
      kind: "thesis",
      label: CONNECTION_LABELS.thesis,
      summary: `${history.length} מדידות שמורות. זה מה שמאפשר לשאול "מה השתנה" ולא רק "מה המצב".`,
      connections: [
        {
          id: "thesis:span",
          label: "טווח המעקב",
          relation: "היסטוריה מוקלטת",
          why: `המדידה הראשונה נשמרה ב-${first.at.slice(0, 10)} והאחרונה ב-${last.at.slice(0, 10)}. רק מדידה ששינתה משהו נשמרת, ולכן מספר הרשומות הוא מספר השינויים ולא מספר הימים.`,
          grade: "confirmed",
          figure: `${history.length}`,
        },
      ],
    });
  }

  /* ---- Research ------------------------------------------------------ */
  groups.push({
    kind: "research",
    label: CONNECTION_LABELS.research,
    summary:
      "שתי דרכים להמשיך מכאן: שאלה אחת שמפורקת לשאלות משנה ונענית מול הראיות, או השוואה ישירה מול חברה אחרת.",
    connections: [
      {
        id: "research:deep",
        label: `מחקר עומק על ${symbol}`,
        relation: "פירוק שאלה",
        why: "השאלה מפורקת לשאלות משנה, כל אחת נענית בקריאה נפרדת מול בלוק הנתונים, והסתירות מאותרות בסוף.",
        grade: "confirmed",
        href: `/research?ticker=${symbol}`,
      },
      {
        id: "research:compare",
        label: "השוואה מול חברה אחרת",
        relation: "זו מול זו",
        why: "כל חברה מול חציון הסקטור שלה, בלי הכרזת מנצח, עם תשואה יחסית מנורמלת ל-100.",
        grade: "confirmed",
        href: `/compare?tickers=${symbol}`,
      },
    ],
  });

  return {
    ticker: symbol,
    companyName,
    groups,
    count: groups.reduce((total, group) => total + group.connections.length, 0),
  };
}
