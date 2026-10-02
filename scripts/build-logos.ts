/**
 * Writes the company logo map.
 *
 * Every company on the site had a drawn monogram and no logo. The reason
 * was sound — eight corporate logo SVGs had been bundled and served from
 * this project's own host while 115 of 123 companies had none, which was
 * both incomplete and a redistribution of registered trademarks.
 *
 * Finnhub's company profile carries a logo URL on its own CDN, for every
 * symbol, as part of the profile data this site already licenses. Pointing
 * at it fixes both halves at once: the coverage is complete, and nothing is
 * copied here. The page renders the provider's URL in a plain <img>, so the
 * browser fetches the image from Finnhub and this project never stores or
 * re-serves a mark it does not own. The monogram stays as the fallback for
 * a symbol with no logo and for a request that fails.
 *
 * Run with:  npm run build:logos
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { UNIVERSE } from "../src/lib/universe";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(ROOT, ".env.local"), quiet: true });

const OUT = resolve(ROOT, "content/companies/logos.json");

/* Finnhub answers sixty requests a minute for the whole account. The
   fundamentals build learned this the hard way: at 48 companies an
   unpaced loop was fine, at 123 it came back with exactly sixty answers
   and five sectors silently lost their median. One request every 1.1s
   leaves headroom for whatever else is running. */
const GAP = 1100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function logoFor(ticker: string, token: string): Promise<string | null> {
  const res = await fetch(
    `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${token}`,
    { headers: { "User-Agent": process.env.SEC_USER_AGENT ?? "market-intel" } },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { logo?: unknown };
  const logo = typeof body.logo === "string" ? body.logo.trim() : "";
  return logo.length > 0 ? logo : null;
}

async function main() {
  const token = process.env.FINNHUB_API_KEY ?? process.env.FINNHUB_KEY;
  if (!token) {
    console.error("FINNHUB_API_KEY missing from .env.local");
    process.exit(1);
  }

  const logos: Record<string, string> = {};
  const missing: string[] = [];
  const failed: string[] = [];

  for (const [i, entry] of UNIVERSE.entries()) {
    if (i > 0) await sleep(GAP);
    try {
      const logo = await logoFor(entry.ticker, token);
      if (logo) {
        logos[entry.ticker] = logo;
      } else {
        missing.push(entry.ticker);
      }
      process.stdout.write(
        `  ${entry.ticker.padEnd(6)} ${logo ? "ok" : "no logo"}\n`,
      );
    } catch (err) {
      failed.push(entry.ticker);
      process.stdout.write(
        `  ${entry.ticker.padEnd(6)} FAILED (${(err as Error).message})\n`,
      );
    }
  }

  /* A run that lost most of the universe would replace a good map with a
     thin one, and every company page would quietly fall back to its
     monogram. The existing file is better than that. */
  if (Object.keys(logos).length < UNIVERSE.length / 2) {
    console.error(
      `\nonly ${Object.keys(logos).length}/${UNIVERSE.length} logos resolved — leaving the existing file untouched`,
    );
    process.exit(1);
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      { builtAt: new Date().toISOString(), logos },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`\nwrote ${OUT}`);
  console.log(`${Object.keys(logos).length}/${UNIVERSE.length} with a logo`);
  if (missing.length) console.log(`no logo published: ${missing.join(", ")}`);
  if (failed.length) console.log(`request failed: ${failed.join(", ")}`);
}

main();
