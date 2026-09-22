/**
 * Reads the institutional holdings file that scripts/build-institutional.ts
 * wrote from SEC 13F filings.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const holdingSchema = z.object({
  issuer: z.string(),
  value: z.number(),
  shares: z.number(),
  weight: z.number().nullable(),
});

const changeSchema = z.object({
  issuer: z.string(),
  kind: z.enum(["new", "exited", "increased", "decreased"]),
  value: z.number(),
  shares: z.number(),
  previousShares: z.number(),
  sharesChangePercent: z.number().nullable(),
});

const institutionSchema = z.object({
  cik: z.number(),
  name: z.string(),
  note: z.string(),
  reportDate: z.string(),
  filedAt: z.string(),
  previousReportDate: z.string().nullable(),
  totalValue: z.number(),
  positionCount: z.number(),
  topHoldings: z.array(holdingSchema),
  changes: z.array(changeSchema),
  hasComparison: z.boolean(),
});

const fileSchema = z.object({
  builtAt: z.string(),
  institutions: z.array(institutionSchema),
});

export type Institution = z.infer<typeof institutionSchema>;
export type PositionChange = z.infer<typeof changeSchema>;

const EMPTY = { builtAt: "", institutions: [] as Institution[] };

export async function getInstitutional() {
  try {
    const raw = await readFile(
      join(process.cwd(), "content/institutional/latest.json"),
      "utf8",
    );
    const parsed = fileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY;
  } catch {
    return EMPTY;
  }
}

export const CHANGE_LABELS: Record<PositionChange["kind"], string> = {
  new: "פוזיציה חדשה",
  increased: "הגדלה",
  decreased: "הקטנה",
  exited: "יציאה מלאה",
};
