/**
 * The evidence block.
 *
 * Everything the model is allowed to know, assembled by code before the
 * model is asked anything. This file is the reason a Hebrew answer about
 * NVIDIA's margin is trustworthy: the margin in the answer was computed in
 * `metrics/`, from a filing, this hour — the model only read it out and
 * explained it.
 *
 * Two consequences are deliberate.
 *
 * The model has no tools and cannot fetch. If a company is not in the
 * block, the answer says so instead of inventing it. That costs the
 * occasional follow-up and buys the one property the whole feature depends
 * on: nothing in an answer came from the model's memory of 2024.
 *
 * Every figure carries its source and its date inside the text, because the
 * model is asked to repeat them. "ROIC 24.1% (SEC, דוח לרבעון שהסתיים
 * 2026-06-30)" survives being quoted; "24.1%" does not.
 */

import { getCompanyIntelligence } from "@/lib/agents";
import { getCompanyAnalysis, getTechnicalRead } from "@/lib/company-analysis";
import { getFundamentalsFile, getSectorContext } from "@/lib/fundamentals-store";
import { getInstitutional } from "@/lib/institutional-store";
import { getArticlesForTicker } from "@/lib/news-store";
import { getLiveFeed } from "@/lib/live-news";
import {
  getEarningsSurprises,
  getQuote,
  getQuotes,
} from "@/lib/sources/finnhub";
import { buildOutlook } from "@/lib/analysis/outlook";
import { buildExpectationGap } from "@/lib/analysis/expectation-gap";
import { marketStatus, describeStatus } from "@/lib/market-hours";
import { fmtCompact, fmtMetric, fmtPercent, fmtPrice } from "@/lib/format";
import { STANCE_LABELS, CONFIDENCE_LABELS } from "@/lib/agents/types";
import { STANCE_LABEL } from "@/lib/analysis/verdict";
import { THESIS_LABELS } from "@/lib/agents/synthesis";

/** A block of ground truth, plus what it was built from. The sources are
 *  shown to the reader next to the answer — an answer whose provenance is
 *  invisible is indistinguishable from one that was made up. */
export type Evidence = {
  text: string;
  sources: string[];
  tickers: string[];
};

const line = (label: string, value: string) => `- ${label}: ${value}`;

/* ------------------------------------------------------------------ */
/* One company                                                         */
/* ------------------------------------------------------------------ */

/**
 * Institutions that hold the company, by name match.
 *
 * 13F holdings carry an issuer name, not a ticker, so this matches on the
 * name the SEC listing gives. It is a text match and it is stated as one —
 * "APPLE INC" against "Apple Inc." works, a holding company whose name
 * differs from its brand does not. A miss shows as no holders rather than
 * as a wrong holder.
 */
async function holdersOf(companyName: string): Promise<string[]> {
  const key = companyName
    .toUpperCase()
    .replace(/[^A-Z ]/g, "")
    .split(" ")
    .filter((word) => word.length > 2 && !["INC", "CORP", "CO", "THE", "LTD", "PLC", "HOLDINGS"].includes(word))
    .slice(0, 2)
    .join(" ");

  if (!key) return [];

  const { institutions } = await getInstitutional();
  const rows: string[] = [];

  for (const institution of institutions) {
    const holding = institution.topHoldings.find((h) =>
      h.issuer.toUpperCase().includes(key),
    );
    if (!holding) continue;

    const change = institution.changes.find((c) =>
      c.issuer.toUpperCase().includes(key),
    );

    rows.push(
      `${institution.name} — $${fmtCompact(holding.value)}` +
        (holding.weight !== null ? `, ${holding.weight.toFixed(1)}% מהתיק` : "") +
        (change
          ? `, שינוי אחרון: ${change.kind} (${fmtPercent(change.sharesChangePercent)})`
          : "") +
        ` [13F לרבעון ${institution.reportDate}]`,
    );
  }

  return rows.slice(0, 6);
}

export async function companyEvidence(ticker: string): Promise<Evidence | null> {
  const symbol = ticker.toUpperCase();

  const [analysis, intelligence, sector, quote, articles, technical] = await Promise.all([
    getCompanyAnalysis(symbol),
    getCompanyIntelligence(symbol).catch(() => null),
    getSectorContext(symbol),
    getQuote(symbol).catch(() => null),
    getArticlesForTicker(symbol, 5).catch(() => []),
    getTechnicalRead(symbol).catch(() => null),
  ]);

  if (!analysis) return null;

  const name = analysis.profile?.name ?? analysis.title;
  const asOf = analysis.fundamentals.asOf;
  const filingNote = asOf
    ? `SEC, דוח לתקופה שהסתיימה ${asOf.end}, הוגש ${asOf.filed}`
    : "SEC, ללא תאריך דוח";

  const parts: string[] = [];
  const sources: string[] = [];

  parts.push(`## ${name} (${symbol})`);
  if (analysis.profile?.industry) {
    parts.push(line("ענף לפי Finnhub", analysis.profile.industry));
  }
  parts.push(line("שווי שוק", analysis.marketCap ? `$${fmtCompact(analysis.marketCap)}` : "לא זמין"));
  if (analysis.fundamentals.stale) {
    parts.push(
      line("שים לב", "הדוח האחרון בן יותר מ-120 יום. המדדים מתארים תקופה שהסתיימה מזמן"),
    );
  }

  if (quote) {
    parts.push(
      line(
        "מחיר",
        `${fmtPrice(quote.price)} (${fmtPercent(quote.changePercent)} היום) [Finnhub, ${quote.at.toISOString().slice(0, 16).replace("T", " ")} UTC]`,
      ),
    );
    sources.push("Finnhub — ציטוט חי");
  }

  /* ---- The metrics, with the sector median beside each one ---- */
  parts.push(`\n### מדדים [${filingNote}]`);
  sources.push(`SEC EDGAR — ${asOf ? asOf.end : "דוח אחרון"}`);

  for (const group of analysis.fundamentals.groups) {
    const rows = group.metrics
      .filter((metric) => metric.value !== null)
      .map((metric) => {
        const median = sector?.medians?.[metric.key] ?? null;
        const context =
          median !== null && median !== undefined
            ? ` (חציון ${sector!.label}: ${fmtMetric(median, metric.unit)}, ${sector!.peerCount} חברות)`
            : "";
        return line(metric.label, `${fmtMetric(metric.value, metric.unit)}${context}`);
      });
    if (rows.length > 0) parts.push(`**${group.title}**`, ...rows);
  }
  if (sector) sources.push(`חציוני סקטור — ${sector.label}, ${sector.peerCount} חברות`);

  /* ---- Capital quality: the figures that need their assumptions said ---- */
  const { costOfCapital, cashCycle, stockComp, allocation } = analysis.capital;
  parts.push("\n### הון ותזרים");
  if (costOfCapital.wacc !== null) {
    parts.push(
      line(
        "WACC מול ROIC",
        `WACC ${costOfCapital.wacc.toFixed(1)}% מול ROIC ${fmtMetric(costOfCapital.roic, "%")}, מרווח ${costOfCapital.spread === null ? "—" : `${costOfCapital.spread.toFixed(1)} נק׳`}`,
      ),
    );
    if (costOfCapital.assumptions.length > 0) {
      parts.push(line("הנחות ב-WACC", costOfCapital.assumptions.join(" · ")));
    }
  }
  if (cashCycle.cycle !== null) {
    parts.push(line("מחזור המרת מזומן (CCC)", `${cashCycle.cycle.toFixed(0)} ימים — ${cashCycle.note}`));
  }
  if (stockComp.shareOfFcf !== null) {
    parts.push(
      line("SBC מול FCF", `${stockComp.shareOfFcf.toFixed(1)}% — ${stockComp.note}`),
    );
  }
  if (allocation.note) parts.push(line("הקצאת הון", allocation.note));

  /* ---- What the site already concluded, and how sure it is ---- */
  if (intelligence) {
    const { verdict, thesis, catalysts, reports, gaps } = intelligence;

    parts.push("\n### מבחן הליבה (חישוב האתר)");
    parts.push(
      line(
        "תוצאה",
        `${STANCE_LABEL[verdict.stance]} — ${verdict.corePassed}/${verdict.coreEvaluated} בדיקות ליבה, ${verdict.passed}/${verdict.evaluated} סך הכול`,
      ),
    );
    parts.push(line("הכותרת", verdict.headline));
    if (verdict.blockers.length > 0) {
      parts.push(line("חסמים", verdict.blockers.join(" · ")));
    }
    if (verdict.falsification) {
      parts.push(line("מה היה מפריך את המסקנה", verdict.falsification));
    }

    parts.push("\n### התזה (חישוב האתר)");
    parts.push(line("מצב", THESIS_LABELS[thesis.status].label));
    parts.push(line("שורה תחתונה", thesis.headline));

    const findings = reports
      .flatMap((report) => report.findings.map((f) => ({ report, f })))
      .slice(0, 14);

    if (findings.length > 0) {
      parts.push("\n### ממצאי הסוכנים");
      for (const { report, f } of findings) {
        parts.push(
          `- [${report.label}] ${f.title} — ${f.body} (${STANCE_LABELS[f.stance]}, ${CONFIDENCE_LABELS[f.confidence]}: ${f.confidenceReason})`,
        );
      }
    }

    if (catalysts.length > 0) {
      parts.push("\n### אירועים קרובים");
      for (const catalyst of catalysts.slice(0, 5)) {
        parts.push(`- ${catalyst.title}${catalyst.when ? ` — ${catalyst.when}` : ""}`);
      }
    }

    if (gaps.length > 0) {
      parts.push("\n### מה האתר לא יכול לחשב על החברה הזאת");
      for (const gap of gaps.slice(0, 8)) parts.push(`- ${gap}`);
    }
  }

  /* ---- The forward half ----

     Without this block the model receives only what already happened, and
     an answer built on it can never get past "the margin is negative". The
     thesis, the scenarios, the premium the price carries and the events
     that are not in any filing yet are what turn a metric recital into a
     view — and every one of them is computed here, not invented there. */
  if (intelligence) {
    const outlook = buildOutlook({
      ticker: symbol,
      companyName: name,
      price: quote?.price ?? null,
      intelligence,
      fundamentals: analysis.fundamentals,
      sector,
      technical,
    });

    if (outlook.worksIf.length > 0) {
      parts.push("\n### התזה עובדת אם");
      for (const item of outlook.worksIf) parts.push(`- ${item}`);
    }
    if (outlook.breaksIf.length > 0) {
      parts.push("\n### התזה נשברת אם");
      for (const item of outlook.breaksIf) parts.push(`- ${item}`);
    }

    if (outlook.knownEvents.length > 0) {
      parts.push("\n### אירועים ידועים שטרם נכנסו לדוחות (הוזנו ידנית, עם מקור)");
      for (const event of outlook.knownEvents) {
        parts.push(
          `- ${event.title}${event.window ? ` (${event.window})` : " (החברה טרם מסרה מועד)"}: ${event.why}\n  מה לבדוק: ${event.watch}\n  מקור: ${event.source}`,
        );
      }
    }

    if (outlook.scenarios.length > 0) {
      parts.push("\n### תרחישים מכניים לשנה קדימה (חישוב, לא תחזית)");
      for (const scenario of outlook.scenarios) {
        parts.push(
          `- ${scenario.label}: מחיר משתמע ${scenario.impliedPrice?.toFixed(2) ?? "—"} (${fmtPercent(scenario.impliedReturn)}). הנחות: ${scenario.assumptions.join(" · ")}`,
        );
      }
    }
  }

  /* ---- What the price is already saying ---- */
  const surprises = await getEarningsSurprises(symbol).catch(() => []);
  const gap = buildExpectationGap({
    companyName: name,
    fundamentals: analysis.fundamentals,
    sector,
    surprises,
  });

  if (gap) {
    parts.push("\n### פער הציפיות");
    parts.push(line("שורה תחתונה", gap.headline));
    for (const side of gap.market) {
      parts.push(line(`המחיר מגלם — ${side.label}`, `${side.figure}. ${side.body}`));
    }
    for (const side of gap.delivered) {
      parts.push(line(`הדוחות מראים — ${side.label}`, `${side.figure}. ${side.body}`));
    }
    if (gap.record) {
      parts.push(
        line(
          "מול תחזיות אנליסטים",
          `${gap.record.beats} הכאות ו-${gap.record.misses} פספוסים ב-${gap.record.quarters} רבעונים. ${gap.record.note}`,
        ),
      );
    }
    if (gap.wouldClose.length > 0) {
      parts.push(line("מה היה סוגר את הפער", gap.wouldClose.join(" · ")));
    }
  }

  /* ---- Who else owns it ---- */
  const holders = await holdersOf(name).catch(() => []);
  if (holders.length > 0) {
    parts.push("\n### מחזיקים מוסדיים (התאמה לפי שם המנפיק ב-13F)");
    for (const holder of holders) parts.push(`- ${holder}`);
    sources.push("SEC 13F — הגשות מוסדיות");
  }

  /* ---- What is being written about it ---- */
  if (articles.length > 0) {
    parts.push("\n### חדשות אחרונות על החברה");
    for (const article of articles) {
      parts.push(
        `- ${article.title} [${article.domain}${article.seenAt ? `, ${article.seenAt.slice(0, 10)}` : ""}]` +
          (article.analysis ? `\n  ניתוח האתר: ${article.analysis.summary} השפעה: ${article.analysis.impact}` : ""),
      );
    }
    sources.push("פיד החדשות של האתר");
  }

  return { text: parts.join("\n"), sources, tickers: [symbol] };
}

/* ------------------------------------------------------------------ */
/* The market                                                          */
/* ------------------------------------------------------------------ */

const INDEX_PROXIES = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "QQQ", label: "Nasdaq 100" },
  { symbol: "IWM", label: "Russell 2000" },
  { symbol: "DIA", label: "Dow Jones" },
];

/**
 * The day, as figures.
 *
 * The movers are computed from the universe rather than taken from a
 * "top gainers" endpoint, because the universe is the set the site has
 * fundamentals for — a mover the site cannot explain is a headline, not
 * intelligence.
 */
export async function marketEvidence(moverCount = 8): Promise<Evidence> {
  const status = marketStatus();
  const { companies } = await getFundamentalsFile();

  // The twenty largest — same sample the daily brief uses, and for the same
  // reason: sixty quote requests a minute is the whole site's budget.
  const universe = companies
    .slice()
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
    .slice(0, 20)
    .map((company) => company.ticker);

  const [indexQuotes, universeQuotes, feed] = await Promise.all([
    getQuotes(INDEX_PROXIES.map((p) => p.symbol)).catch(() => []),
    getQuotes(universe).catch(() => []),
    getLiveFeed().catch(() => null),
  ]);

  const parts: string[] = [];
  const sources: string[] = ["Finnhub — ציטוטים"];

  parts.push("## מצב המסחר");
  parts.push(line("כרגע", describeStatus(status)));
  parts.push(line("שעה (ישראל)", new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })));

  parts.push("\n## מדדים (דרך תעודות סל, לא המדד עצמו)");
  INDEX_PROXIES.forEach((proxy, i) => {
    const quote = indexQuotes[i];
    if (!quote) return;
    parts.push(
      line(
        `${proxy.label} (${proxy.symbol})`,
        `${fmtPrice(quote.price)} ${fmtPercent(quote.changePercent)}`,
      ),
    );
  });

  const moves = universe
    .map((ticker, i) => ({ ticker, quote: universeQuotes[i] }))
    .filter((row) => row.quote && Number.isFinite(row.quote.changePercent ?? NaN))
    .sort(
      (a, b) =>
        Math.abs(b.quote!.changePercent ?? 0) -
        Math.abs(a.quote!.changePercent ?? 0),
    )
    .slice(0, moverCount);

  if (moves.length > 0) {
    parts.push("\n## תנועות בולטות ביקום שהאתר עוקב אחריו");
    for (const move of moves) {
      const company = companies.find((c) => c.ticker === move.ticker);
      parts.push(
        line(
          move.ticker,
          `${fmtPercent(move.quote!.changePercent)} · ${fmtPrice(move.quote!.price)}` +
            (company?.metrics.pe != null
              ? ` · P/E ${fmtMetric(company.metrics.pe, "x")}`
              : ""),
        ),
      );
    }
  }

  if (feed) {
    const analysed = feed.sectors
      .flatMap((sector) =>
        sector.articles.map((article) => ({ sector: sector.label, article })),
      )
      .filter((row) => row.article.analysis)
      .sort((a, b) => {
        const rank = { high: 0, medium: 1, low: 2 } as const;
        return (
          rank[a.article.analysis!.significance] -
          rank[b.article.analysis!.significance]
        );
      })
      .slice(0, 10);

    if (analysed.length > 0) {
      parts.push("\n## כותרות מנותחות מהפיד");
      for (const { sector, article } of analysed) {
        const a = article.analysis!;
        parts.push(
          `- [${sector}] ${article.title}\n  ${a.summary}\n  השפעה: ${a.impact}` +
            (a.catalystKind ? `\n  סיווג: ${a.catalystKind}` : "") +
            (a.tickers.length > 0 ? `\n  נוגע ל: ${a.tickers.join(", ")}` : ""),
        );
      }
      sources.push("פיד החדשות של האתר, מנותח בשלוש עדשות");
    }
  }

  return { text: parts.join("\n"), sources, tickers: [] };
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

/**
 * The block for a free-text question.
 *
 * The market block is always included and company blocks are added for
 * whichever companies the question names. A question with no company in it
 * — "מה קרה היום בשוק" — is answerable from the market block alone, and a
 * question about four companies gets four blocks, which is where the cap
 * comes from: past that the prompt is large enough to slow the first token
 * down noticeably.
 */
export async function evidenceFor(
  tickers: string[],
  { includeMarket = true }: { includeMarket?: boolean } = {},
): Promise<Evidence> {
  const packs = await Promise.all(
    tickers.slice(0, 3).map((ticker) => companyEvidence(ticker).catch(() => null)),
  );

  const market = includeMarket ? await marketEvidence().catch(() => null) : null;

  const found = packs.filter((pack): pack is Evidence => pack !== null);
  const missing = tickers
    .slice(0, 3)
    .filter((_, i) => packs[i] === null);

  const blocks = [
    ...(market ? [market.text] : []),
    ...found.map((pack) => pack.text),
  ];

  if (missing.length > 0) {
    blocks.push(
      `\n## חברות שנשאלו ולא נמצאו\n${missing
        .map((ticker) => `- ${ticker}: אין נתונים באתר. ייתכן שהסימבול שגוי או שהחברה אינה מגישה ל-SEC.`)
        .join("\n")}`,
    );
  }

  return {
    text: blocks.join("\n\n"),
    sources: [
      ...new Set([...(market?.sources ?? []), ...found.flatMap((p) => p.sources)]),
    ],
    tickers: found.flatMap((pack) => pack.tickers),
  };
}
