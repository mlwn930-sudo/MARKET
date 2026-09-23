/**
 * US market session state, and the refresh cadence that follows from it.
 *
 * Both halves live here because they are one decision. Quotes do not move
 * when the exchange is closed, so refreshing every few seconds overnight
 * spends the rate-limit budget to receive the same number over and over —
 * and that budget is the binding constraint on how fast we can refresh when
 * it *is* open.
 *
 * The session detection is deliberately approximate: it uses New York wall
 * clock time and skips holidays. Getting a holiday wrong costs one slow
 * polling day, which is not worth shipping a calendar that needs
 * maintenance every year.
 */

export type MarketState = "open" | "pre" | "after" | "closed";

export type MarketStatus = {
  state: MarketState;
  label: string;
};

const LABELS: Record<MarketState, string> = {
  open: "הבורסה פתוחה",
  pre: "מסחר מוקדם",
  after: "מסחר מאוחר",
  closed: "הבורסה סגורה",
};

/* ------------------------------------------------------------------ */
/* Cadence                                                             */
/* ------------------------------------------------------------------ */

/**
 * Finnhub's free tier allows 60 calls a minute and every symbol is one call.
 * The budget is set at 35 so that a dashboard and a company page can be open
 * at the same time without either of them being the request that trips the
 * limit — and a rate-limit error does not announce itself, it just returns
 * stale prices for an hour.
 */
const CALLS_PER_MINUTE_BUDGET = 35;

/** A single symbol refreshes four times faster than a watchlist of eleven,
 *  because it costs a fraction as much. This is the floor: below it, the
 *  quote endpoint itself stops being the limiting factor and the requests
 *  are simply wasted. */
const FASTEST_MS = 4_000;
const SLOWEST_OPEN_MS = 20_000;
const CLOSED_MS = 120_000;
/** Extended hours trade thinly, so prices change far less often. */
const EXTENDED_MULTIPLIER = 2.5;

/**
 * How often a set of symbols should be refreshed, in milliseconds.
 *
 * Derived from the number of symbols rather than fixed, which is what lets a
 * company page feel live: watching one stock costs one call, so it refreshes
 * every four seconds, while the eleven-symbol dashboard settles around
 * nineteen. Both spend the same share of the same allowance.
 *
 * Used by the client to schedule its polling AND by the server to set its
 * cache lifetime. They have to agree — a client polling faster than the
 * server cache refreshes just receives the same payload repeatedly, and a
 * server cache shorter than the client interval spends requests nobody
 * asked for.
 */
export function pollIntervalFor(
  state: MarketState,
  symbolCount: number,
): number {
  if (state === "closed") return CLOSED_MS;

  const perMinute = (Math.max(1, symbolCount) * 60_000) / CALLS_PER_MINUTE_BUDGET;
  const open = Math.min(Math.max(perMinute, FASTEST_MS), SLOWEST_OPEN_MS);

  return state === "open" ? Math.round(open) : Math.round(open * EXTENDED_MULTIPLIER);
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

function nowInNewYork(): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const day = days.indexOf(get("weekday"));
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  return { day, minutes: hour * 60 + minute };
}

export function marketStatus(): MarketStatus {
  const { day, minutes } = nowInNewYork();

  // Weekend.
  if (day === 0 || day === 6) {
    return { state: "closed", label: LABELS.closed };
  }

  const open = 9 * 60 + 30;
  const close = 16 * 60;
  const preStart = 4 * 60;
  const afterEnd = 20 * 60;

  let state: MarketState = "closed";
  if (minutes >= open && minutes < close) state = "open";
  else if (minutes >= preStart && minutes < open) state = "pre";
  else if (minutes >= close && minutes < afterEnd) state = "after";

  return { state, label: LABELS[state] };
}
