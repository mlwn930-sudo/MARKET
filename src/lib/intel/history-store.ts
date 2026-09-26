/**
 * Where the thesis history lives.
 *
 * A file in the repository, written by `scripts/build-thesis-history.ts`
 * and committed by the nightly workflow — the same pattern the
 * fundamentals and the institutional data already use.
 *
 * That is a deliberate choice over a database, for two reasons that both
 * come from this project's constraints. Vercel Hobby has an ephemeral,
 * read-only filesystem at request time, so a run cannot write its own
 * history; and `DATABASE_URL` is empty, so there is nothing to write to.
 * A file that a scheduled job rewrites and commits is durable, free,
 * diffable in git — the history of the history — and it needs no
 * connection at request time, which matters on a page that already fans
 * out to SEC and two quote providers.
 *
 * The trade is that history advances at the cadence of the job, not of
 * the reader. For a record of how a thesis moved between quarterly
 * filings, a nightly tick is finer resolution than the underlying data
 * has.
 *
 * When the file does not exist yet — a fresh clone, or before the job has
 * run once — every reader gets an empty history and the interface says so
 * rather than implying nothing has changed. Those are different claims.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { ThesisFingerprint } from "./thesis-memory";

const fingerprintSchema = z.object({
  ticker: z.string(),
  at: z.string(),
  status: z.enum(["positive", "watch", "high-risk", "negative", "insufficient"]),
  headline: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  verdict: z.object({
    passed: z.number(),
    evaluated: z.number(),
    corePassed: z.number(),
    coreEvaluated: z.number(),
  }),
  quadrant: z.object({
    businessQuality: z.string(),
    priceLevel: z.string(),
    verdict: z.string(),
  }),
  conditions: z.array(z.string()),
  breakers: z.array(z.string()),
  metrics: z.record(z.string(), z.number().nullable()),
  filingEnd: z.string().nullable(),
});

const deltaSchema = z.object({
  field: z.string(),
  before: z.string(),
  after: z.string(),
  weight: z.number(),
});

const evidenceSchema = z.object({
  label: z.string(),
  value: z.string(),
  source: z.object({
    origin: z.enum(["SEC", "Finnhub", "Yahoo", "FRED", "חישוב"]),
    asOf: z.string().nullable(),
    note: z.string().optional(),
  }),
  note: z.string().optional(),
});

const changeSchema = z.object({
  ticker: z.string(),
  companyName: z.string(),
  from: z.string(),
  to: z.string(),
  driver: z.enum(["filing", "price", "both", "wording"]),
  oldView: z.string(),
  newView: z.string(),
  why: z.array(z.string()),
  deltas: z.array(deltaSchema),
  evidence: z.array(evidenceSchema),
  claim: z.object({
    grade: z.enum(["confirmed", "likely", "possible", "speculative"]),
    basis: z.string(),
    limits: z.string(),
  }),
  materiality: z.number(),
});

const catalystSchema = z.object({
  ticker: z.string(),
  companyName: z.string(),
  title: z.string(),
  when: z.string(),
  date: z.string().nullable(),
  why: z.string(),
  impact: z.string(),
});

const fileSchema = z.object({
  builtAt: z.string(),
  /** Oldest first, per ticker. Capped by the build script. */
  history: z.record(z.string(), z.array(fingerprintSchema)),
  /**
   * The changes the build detected, newest first.
   *
   * Stored rather than recomputed because detecting one means running the
   * whole agent pipeline for a company, and the briefing covers
   * forty-eight of them. The nightly job does that work once; every reader
   * of the briefing reads the result.
   */
  changes: z.array(changeSchema).default([]),
  /** Dated events across the universe, so the briefing has a calendar
   *  without loading forty-eight agent pipelines to find one. */
  catalysts: z.array(catalystSchema).default([]),
});

export type ThesisHistoryFile = z.infer<typeof fileSchema>;
export type StoredChange = z.infer<typeof changeSchema>;
export type StoredCatalyst = z.infer<typeof catalystSchema>;

export const HISTORY_PATH = "content/intel/thesis-history.json";

/** How many snapshots to keep per company. Eight quarters of nightly
 *  snapshots would be enormous and useless — the build script keeps only
 *  snapshots that actually differ, so twelve is roughly three years of
 *  real changes. */
export const HISTORY_DEPTH = 12;

const EMPTY: ThesisHistoryFile = {
  builtAt: "",
  history: {},
  changes: [],
  catalysts: [],
};

let cached: ThesisHistoryFile | null = null;

export async function getThesisHistory(): Promise<ThesisHistoryFile> {
  if (cached) return cached;
  try {
    const raw = await readFile(join(process.cwd(), HISTORY_PATH), "utf8");
    const parsed = fileSchema.safeParse(JSON.parse(raw));
    cached = parsed.success ? parsed.data : EMPTY;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

/** Every recorded snapshot for one company, oldest first. */
export async function historyFor(ticker: string): Promise<ThesisFingerprint[]> {
  const file = await getThesisHistory();
  return (file.history[ticker.toUpperCase()] ?? []) as ThesisFingerprint[];
}

/** The snapshot to compare today against: the most recent one on record. */
export async function previousFingerprint(
  ticker: string,
): Promise<ThesisFingerprint | null> {
  const entries = await historyFor(ticker);
  return entries.length > 0 ? entries[entries.length - 1] : null;
}

/** True when the job has never run. The interface says "not recorded yet"
 *  rather than "nothing changed" — they are different claims, and only one
 *  of them is true. */
export async function historyIsEmpty(): Promise<boolean> {
  const file = await getThesisHistory();
  return Object.keys(file.history).length === 0;
}

/**
 * Thesis changes the build detected, newest first.
 *
 * `withinDays` exists because a briefing is about now. A change detected
 * three weeks ago is history, and history belongs on the company page that
 * owns it rather than at the top of today's page.
 */
export async function recentChanges(withinDays = 14): Promise<StoredChange[]> {
  const file = await getThesisHistory();
  const floor = Date.now() - withinDays * 86_400_000;

  return file.changes
    .filter((change) => {
      const at = Date.parse(change.to);
      return Number.isFinite(at) && at >= floor;
    })
    .sort((a, b) => b.to.localeCompare(a.to));
}

/** Every recorded change for one company, newest first. */
export async function changesFor(ticker: string): Promise<StoredChange[]> {
  const file = await getThesisHistory();
  const symbol = ticker.toUpperCase();
  return file.changes
    .filter((change) => change.ticker === symbol)
    .sort((a, b) => b.to.localeCompare(a.to));
}

/**
 * Dated events ahead, soonest first.
 *
 * Only ones with a real date. A catalyst without one is part of a thesis,
 * and putting it on something that looks like a calendar tells the reader
 * there is a day to wait for when there is not.
 */
export async function upcomingCatalysts(
  withinDays = 90,
): Promise<StoredCatalyst[]> {
  const file = await getThesisHistory();
  const now = Date.now();
  const ceiling = now + withinDays * 86_400_000;

  return file.catalysts
    .filter((catalyst) => {
      if (!catalyst.date) return false;
      const at = Date.parse(catalyst.date);
      return Number.isFinite(at) && at >= now - 86_400_000 && at <= ceiling;
    })
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
}
