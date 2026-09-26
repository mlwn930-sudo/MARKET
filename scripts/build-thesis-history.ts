/**
 * Builds the thesis history.
 *
 * For every company in the universe: run the full agent pipeline, reduce
 * the result to a fingerprint, and compare it against the last fingerprint
 * on record. When they differ, append the new one and record the change
 * with its evidence.
 *
 * This is the only part of the product with a memory, and it runs offline
 * for three reasons that each make it impossible inside a request. The
 * pipeline pulls SEC filings and five Finnhub endpoints per company, which
 * is minutes of wall time for forty-eight of them and several hundred
 * calls against a sixty-a-minute limit. `unstable_cache` needs a Next
 * request context, which a script has none of — hence the uncached
 * builders it calls instead. And a history is by definition something that
 * has to be written down somewhere durable, which on Vercel Hobby is the
 * repository rather than the filesystem.
 *
 * Only snapshots that differ are appended. A nightly run that stored
 * forty-eight fingerprints whether or not anything moved would grow a
 * megabyte a month and bury the six entries that mean something.
 *
 * Run with:  npm run build:thesis
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { buildCompanyAnalysis } from "../src/lib/company-analysis";
import { buildCompanyIntelligence } from "../src/lib/agents";
import { fingerprint, diffThesis } from "../src/lib/intel/thesis-memory";
import type { ThesisFingerprint, ThesisChange } from "../src/lib/intel/thesis-memory";
import { HISTORY_DEPTH } from "../src/lib/intel/history-store";
import { UNIVERSE } from "../src/lib/universe";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Safe after the imports: the source modules read process.env lazily,
// inside the call that needs it, not at module scope.
config({ path: resolve(ROOT, ".env.local"), quiet: true });

const OUT = resolve(ROOT, "content/intel/thesis-history.json");

/** How many recorded changes to keep. Enough to fill a briefing several
 *  times over; beyond that they belong to the company page, which reads
 *  the per-ticker history rather than this list. */
const CHANGE_DEPTH = 120;

type Catalyst = {
  ticker: string;
  companyName: string;
  title: string;
  when: string;
  date: string | null;
  why: string;
  impact: string;
};

type HistoryFile = {
  builtAt: string;
  history: Record<string, ThesisFingerprint[]>;
  changes: ThesisChange[];
  catalysts: Catalyst[];
};

const EMPTY: HistoryFile = {
  builtAt: "",
  history: {},
  changes: [],
  catalysts: [],
};

async function readExisting(): Promise<HistoryFile> {
  try {
    const raw = await readFile(OUT, "utf8");
    const parsed = JSON.parse(raw) as Partial<HistoryFile>;
    return {
      builtAt: parsed.builtAt ?? "",
      history: parsed.history ?? {},
      changes: parsed.changes ?? [],
      catalysts: parsed.catalysts ?? [],
    };
  } catch {
    /* First run, or a file this version cannot read. Starting from empty
       is correct: a history that cannot be parsed is not a history, and
       overwriting it is better than diffing against garbage. */
    return EMPTY;
  }
}

/** Finnhub answers sixty calls a minute and the pipeline spends five or six
 *  per company. Sequential with a pause is slower than it needs to be and
 *  is the only pacing that survives a run of forty-eight. */
const PAUSE_MS = 1_500;

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function main() {
  const existing = await readExisting();

  const history: Record<string, ThesisFingerprint[]> = { ...existing.history };
  const detected: ThesisChange[] = [];
  const catalysts: Catalyst[] = [];
  const failed: string[] = [];

  let built = 0;
  let unchanged = 0;

  for (const [index, entry] of UNIVERSE.entries()) {
    const symbol = entry.ticker;
    process.stdout.write(
      `[${String(index + 1).padStart(2)}/${UNIVERSE.length}] ${symbol.padEnd(6)} `,
    );

    try {
      const analysis = await buildCompanyAnalysis(symbol);
      if (!analysis) {
        failed.push(symbol);
        console.log("no analysis");
        continue;
      }

      const intelligence = await buildCompanyIntelligence(symbol, analysis);
      if (!intelligence) {
        failed.push(symbol);
        console.log("no intelligence");
        continue;
      }

      const name = analysis.profile?.name ?? analysis.title;
      const current = fingerprint(symbol, intelligence, analysis.fundamentals);

      const previous = history[symbol]?.[history[symbol].length - 1] ?? null;

      if (!previous) {
        /* The first measurement is not a change — there is nothing to
           compare it against. Recording it as one would open the briefing
           on forty-eight "thesis changed" entries the first night. */
        history[symbol] = [current];
        built++;
        console.log("first snapshot");
      } else {
        const change = diffThesis(previous, current, name);
        if (change) {
          history[symbol] = [...(history[symbol] ?? []), current].slice(
            -HISTORY_DEPTH,
          );
          detected.push(change);
          built++;
          console.log(
            `CHANGED · ${change.driver} · ${change.deltas.length} deltas`,
          );
        } else {
          unchanged++;
          console.log("no change");
        }
      }

      for (const catalyst of intelligence.catalysts) {
        if (!catalyst.date) continue;
        catalysts.push({
          ticker: symbol,
          companyName: name,
          title: catalyst.title,
          when: catalyst.when,
          date: catalyst.date,
          why: catalyst.why,
          impact: catalyst.impact,
        });
      }
    } catch (error) {
      failed.push(symbol);
      console.log(`failed — ${(error as Error).message.slice(0, 60)}`);
    }

    await sleep(PAUSE_MS);
  }

  /* The same guard the fundamentals build uses. A run that reached a
     handful of companies — a rate limit, an SEC outage — would otherwise
     rewrite the file with a fraction of the universe and lose the rest of
     the history permanently. */
  const reached = built + unchanged;
  if (reached < UNIVERSE.length * 0.6) {
    console.error(
      `\nonly ${reached}/${UNIVERSE.length} companies were read — leaving the existing file untouched`,
    );
    process.exit(1);
  }

  const file: HistoryFile = {
    builtAt: new Date().toISOString(),
    history,
    changes: [...detected, ...existing.changes]
      .sort((a, b) => b.to.localeCompare(a.to))
      .slice(0, CHANGE_DEPTH),
    catalysts: catalysts.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(file, null, 2), "utf8");

  console.log(`\nwrote ${OUT}`);
  console.log(`${reached}/${UNIVERSE.length} companies read`);
  console.log(`${detected.length} thesis changes detected`);
  console.log(`${catalysts.length} dated catalysts`);
  console.log(`${unchanged} unchanged`);
  if (failed.length) console.log(`failed: ${failed.join(", ")}`);

  for (const change of detected.slice(0, 10)) {
    console.log(
      `  ${change.ticker.padEnd(6)} ${change.driver.padEnd(7)} ${change.deltas[0].field}: ${change.deltas[0].before} -> ${change.deltas[0].after}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
