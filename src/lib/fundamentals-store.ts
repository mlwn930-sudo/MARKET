/**
 * Reads the precomputed fundamentals file that scripts/build-fundamentals.ts
 * wrote: per-company metrics for the universe, plus a median per sector.
 *
 * The sector median is what turns a figure into a judgement. "P/E 28.4x" is
 * a data point; "28.4x against a sector median of 31.4x" is the thing a
 * person can actually act on. CLAUDE.md rule 5 exists for this.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const numberOrNull = z.number().nullable();

const companySchema = z.object({
  ticker: z.string(),
  name: z.string(),
  sector: z.string(),
  marketCap: numberOrNull,
  asOf: z.string().nullable(),
  stale: z.boolean(),
  metrics: z.record(z.string(), numberOrNull),
});

const fileSchema = z.object({
  builtAt: z.string(),
  companies: z.array(companySchema),
  sectors: z.record(
    z.string(),
    z.object({
      label: z.string(),
      count: z.number(),
      medians: z.record(z.string(), numberOrNull),
    }),
  ),
});

export type UniverseCompany = z.infer<typeof companySchema>;
export type FundamentalsFile = z.infer<typeof fileSchema>;

const EMPTY: FundamentalsFile = { builtAt: "", companies: [], sectors: {} };

let cached: FundamentalsFile | null = null;

export async function getFundamentalsFile(): Promise<FundamentalsFile> {
  if (cached) return cached;
  try {
    const raw = await readFile(
      join(process.cwd(), "content/fundamentals/universe.json"),
      "utf8",
    );
    const parsed = fileSchema.safeParse(JSON.parse(raw));
    cached = parsed.success ? parsed.data : EMPTY;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

export type SectorContext = {
  key: string;
  label: string;
  peerCount: number;
  medians: Record<string, number | null>;
};

/** Sector benchmark for a ticker, or null when the company is outside the
 *  universe or its sector has too few peers to have a median. */
export async function getSectorContext(
  ticker: string,
): Promise<SectorContext | null> {
  const file = await getFundamentalsFile();
  const company = file.companies.find(
    (c) => c.ticker === ticker.toUpperCase(),
  );
  if (!company) return null;

  const sector = file.sectors[company.sector];
  if (!sector) return null;

  return {
    key: company.sector,
    label: sector.label,
    peerCount: sector.count,
    medians: sector.medians,
  };
}

/**
 * Where a value sits against its sector median.
 *
 * Deliberately returns direction, not a verdict. Whether a P/E above the
 * sector is good or bad depends on what the company is doing with the
 * premium, and that is the reader's call to make. Colouring it green or red
 * would be the site deciding for them — and would also break the rule that
 * green and red mean price direction and nothing else.
 */
export function compareToSector(
  value: number | null,
  median: number | null,
): { differencePercent: number; higher: boolean } | null {
  if (
    value === null ||
    median === null ||
    !Number.isFinite(value) ||
    !Number.isFinite(median) ||
    median === 0
  ) {
    return null;
  }
  const differencePercent = ((value - median) / Math.abs(median)) * 100;
  return { differencePercent, higher: differencePercent > 0 };
}
