import file from "../../content/companies/logos.json";

/**
 * Where a company's logo lives — on the data provider's server, not on this
 * one.
 *
 * The site used to ship eight logo SVGs from its own host while 115 of 123
 * companies had none: incomplete, and a redistribution of registered
 * trademarks. Finnhub's company profile carries a logo URL for every symbol
 * as part of the profile data this project already licenses, so the map
 * below holds URLs and nothing else. The browser fetches the image from
 * Finnhub; this project never stores, optimises or re-serves a mark it does
 * not own, which is the difference that mattered.
 *
 * Built by scripts/build-logos.ts. A ticker with no entry simply has no
 * logo published, and the drawn monogram carries it — which is why the
 * monogram was never removed.
 */

const LOGOS = (file as { logos: Record<string, string> }).logos;

export function logoFor(ticker: string): string | null {
  return LOGOS[ticker.replace(/\.TA$/i, "").toUpperCase()] ?? null;
}

/** When the map was built, for the page that accounts for every source. */
export const LOGOS_BUILT_AT = (file as { builtAt: string }).builtAt;
