/**
 * Types for the sector configuration.
 *
 * The configuration itself stays plain JavaScript because the refresh and
 * filter scripts run under bare `node`, with no build step between them and
 * the file. Declaring its shape here lets the app import the same module —
 * so the live news route classifies an article exactly the way the scheduled
 * refresh does, rather than carrying a second copy of the rules that drifts.
 */

export type NewsSector = {
  sector: string;
  label: string;
  blurb: string;
  /** Hex colour that identifies the sector across the site. */
  accent: string;
  keywords: string[];
  tickers: string[];
};

export declare const SECTORS: NewsSector[];

/** An article-shaped value from Finnhub or from the stored feed. */
export type ClassifiableArticle = {
  headline?: string;
  title?: string;
  summary?: string;
  related?: string;
};

export declare function isRelevant(article: ClassifiableArticle): boolean;
export declare function classify(article: ClassifiableArticle): string[];
export declare function tickersIn(article: ClassifiableArticle): string[];
