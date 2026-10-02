import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

/**
 * What the watcher found, read back.
 *
 * The file is written by scripts/watch-market.ts on a schedule, the same
 * way the news feed is. The site never runs the scan during a request:
 * it is a hundred and twenty price histories, which is a minute of work
 * and belongs nowhere near someone opening a page.
 */

const findingSchema = z.object({
  kind: z.enum(["move", "range", "event", "story"]),
  ticker: z.string().nullable(),
  headline: z.string(),
  detail: z.string(),
  weight: z.number(),
  href: z.string().nullable(),
  at: z.string(),
});

const fileSchema = z.object({
  builtAt: z.string(),
  universe: z.number(),
  priced: z.number(),
  counts: z.object({
    move: z.number(),
    range: z.number(),
    event: z.number(),
    story: z.number(),
  }),
  findings: z.array(findingSchema),
});

export type Finding = z.infer<typeof findingSchema>;
export type WatchFile = z.infer<typeof fileSchema>;

const EMPTY: WatchFile = {
  builtAt: "",
  universe: 0,
  priced: 0,
  counts: { move: 0, range: 0, event: 0, story: 0 },
  findings: [],
};

export async function getWatch(): Promise<WatchFile> {
  try {
    const raw = await readFile(
      join(process.cwd(), "content/watch/latest.json"),
      "utf8",
    );
    const parsed = fileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY;
  } catch {
    return EMPTY;
  }
}

/**
 * How long ago the scan ran, in minutes. Null when it has never run.
 *
 * The page prints this rather than implying the watcher is awake. It runs
 * on a schedule — every half hour while the market is open, twice a day
 * otherwise — and a reader deciding whether to act on a finding is
 * entitled to know it might be twenty-nine minutes old.
 */
export function watchAgeMinutes(builtAt: string): number | null {
  if (!builtAt) return null;
  const age = (Date.now() - new Date(builtAt).getTime()) / 60_000;
  return Number.isFinite(age) ? Math.max(0, Math.round(age)) : null;
}
