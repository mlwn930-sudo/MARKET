import { unstable_cache } from "next/cache";
import {
  getAnalystViews,
  getBasicFinancials,
  getEarningsCalendar,
  getEarningsSurprises,
  getPeers,
} from "@/lib/sources/finnhub";
import { getCompanyAnalysis, getTechnicalRead } from "@/lib/company-analysis";
import { getSectorContext } from "@/lib/fundamentals-store";
import { buildVerdict, type Verdict } from "@/lib/analysis/verdict";
import { financialAnalyst } from "./financial";
import { valuationAnalyst, type BusinessVsPrice } from "./valuation";
import { growthAnalyst } from "./growth";
import { catalystAgent, competitiveAgent, technicalAgent, type Catalyst } from "./catalyst";
import { contrarianAgent, riskAnalyst } from "./contrarian";
import {
  synthesise,
  type DecisionFactor,
  type InvestmentThesis,
} from "./synthesis";
import type { AgentReport } from "./types";

/**
 * The orchestrator.
 *
 * Not every agent runs on every request. A company page needs the full
 * picture; a news card needs one agent and a synthesis. Running eleven
 * agents to render a headline would cost the reader a second of latency and
 * the project its rate limit, so the pipeline is selected by what is being
 * asked.
 *
 * Everything here is cached as the finished report rather than as the raw
 * inputs. The SEC facts document alone is megabytes; the report is a few
 * kilobytes, and caching the output means the heavy fetch happens once an
 * hour per company instead of once per view. That lesson is written into
 * `company-analysis.ts` too, and it is the single most important
 * performance decision in this project.
 */

export type CompanyIntelligence = {
  /** The Core Test: quantitative, trailing, pass or fail. */
  verdict: Verdict;
  /** The Investment Thesis: forward-looking, evidence-bound. */
  thesis: InvestmentThesis;
  matrix: DecisionFactor[];
  quadrant: BusinessVsPrice;
  catalysts: Catalyst[];
  reports: AgentReport[];
  peers: string[];
  /** Every gap, collected — shown rather than hidden. */
  gaps: string[];
  ranAt: string;
};

/** Bumped whenever the shape changes. The cache holds a serialised object
 *  and does not know the code reading it has grown a field — without this,
 *  adding one ships a page that crashes until the hour expires. */
const SHAPE_VERSION = "v1";

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

async function build(symbol: string): Promise<CompanyIntelligence | null> {
  const analysis = await getCompanyAnalysis(symbol);
  if (!analysis) return null;

  // Everything that can be fetched in parallel is. Each one degrades to a
  // null or an empty list rather than throwing: a missing peer list should
  // cost the peer section, not the page.
  const [technical, sector, financials, surprises, peers, analysts, calendar] =
    await Promise.all([
      getTechnicalRead(symbol).catch(() => null),
      getSectorContext(symbol),
      getBasicFinancials(symbol).catch(() => null),
      getEarningsSurprises(symbol).catch(() => []),
      getPeers(symbol).catch(() => []),
      getAnalystViews(symbol).catch(() => []),
      getEarningsCalendar(
        isoDaysFromNow(-7),
        isoDaysFromNow(120),
      ).catch(() => new Map()),
    ]);

  const { fundamentals, capital, profile, title } = analysis;
  const name = profile?.name ?? title;

  /* ---- The Core Test, unchanged ---- */
  const verdict = buildVerdict(fundamentals, capital, technical, sector, name);

  /* ---- The agents ---- */
  const financial = financialAnalyst(fundamentals, capital);
  const valuation = valuationAnalyst(
    fundamentals,
    financials,
    sector,
    capital.costOfCapital.spread,
  );
  const growth = growthAnalyst(fundamentals, surprises);
  const technicalReport = technicalAgent(technical);
  const risk = riskAnalyst(fundamentals, capital, technical);
  const { report: catalystReport, catalysts } = catalystAgent(
    symbol,
    calendar.get(symbol.toUpperCase()) ?? null,
    analysts,
    technical,
  );
  const competitive = competitiveAgent(symbol, peers);

  // The contrarian runs last and is told which way the others are leaning,
  // so it argues against the emerging conclusion rather than picking a side
  // in advance.
  const soFar = [
    financial,
    valuation.report,
    growth,
    technicalReport,
    risk,
    catalystReport,
  ];
  const supports = soFar.flatMap((r) =>
    r.findings.filter((f) => f.stance === "supports"),
  ).length;
  const opposes = soFar.flatMap((r) =>
    r.findings.filter((f) => f.stance === "opposes"),
  ).length;

  const leaning =
    supports > opposes + 1
      ? "favourable"
      : opposes > supports + 1
        ? "unfavourable"
        : "mixed";

  const contrarian = contrarianAgent(
    fundamentals,
    capital,
    technical,
    valuation.quadrant,
    leaning,
  );

  const reports = [...soFar, competitive, contrarian];

  const { thesis, matrix } = synthesise({
    companyName: name,
    verdict,
    reports,
    quadrant: valuation.quadrant,
    catalysts,
  });

  return {
    verdict,
    thesis,
    matrix,
    quadrant: valuation.quadrant,
    catalysts,
    reports,
    peers,
    gaps: [...new Set(reports.flatMap((report) => report.gaps))],
    ranAt: new Date().toISOString(),
  };
}

/**
 * The full pipeline for one company. Cached for an hour, which is longer
 * than a price should be cached and about right for everything else here:
 * filings do not change intraday, and neither does a peer list.
 */
export function getCompanyIntelligence(
  ticker: string,
): Promise<CompanyIntelligence | null> {
  const symbol = ticker.toUpperCase();
  return unstable_cache(
    () => build(symbol),
    ["company-intelligence", SHAPE_VERSION, symbol],
    { revalidate: 3600, tags: ["company", `company:${symbol}`] },
  )();
}

export type { AgentReport } from "./types";
export type { Catalyst } from "./catalyst";
export type { BusinessVsPrice } from "./valuation";
export type {
  DecisionFactor,
  InvestmentThesis,
  ThesisStatus,
} from "./synthesis";
export { THESIS_LABELS, MATRIX_LABELS } from "./synthesis";
export {
  CONFIDENCE_LABELS,
  STANCE_LABELS,
  type Confidence,
  type Evidence,
  type Finding,
  type SourceRef,
  type Stance,
} from "./types";
