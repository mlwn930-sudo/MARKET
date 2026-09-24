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
  /** Minutes until the regular session opens, when it is not open. */
  opensInMinutes: number | null;
};

const LABELS: Record<MarketState, string> = {
  open: "הבורסה פתוחה",
  pre: "מסחר מוקדם",
  after: "מסחר מאוחר",
  closed: "הבורסה סגורה",
};

/**
 * "Closed" and "opens in 3 hours" are the same fact and a completely
 * different message.
 *
 * A still price with no explanation reads as a broken page — which is
 * exactly what it was taken for. Saying when trading resumes turns the
 * same stillness into information, and it costs one line.
 */
export function describeStatus(status: MarketStatus): string {
  if (status.state === "open") return status.label;
  if (status.opensInMinutes === null) return status.label;

  const minutes = status.opensInMinutes;
  if (minutes < 60) return `${status.label} · נפתחת בעוד ${minutes} דקות`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${status.label} · נפתחת בעוד ${hours} שעות`;

  const days = Math.round(hours / 24);
  return `${status.label} · נפתחת בעוד ${days} ימים`;
}

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

const OPEN_MINUTE = 9 * 60 + 30;
const CLOSE_MINUTE = 16 * 60;
const PRE_START = 4 * 60;
const AFTER_END = 20 * 60;

/** Minutes from now until the next regular open, counting past weekends. */
function minutesUntilOpen(day: number, minutes: number): number {
  // Still before today's open on a weekday.
  if (day >= 1 && day <= 5 && minutes < OPEN_MINUTE) {
    return OPEN_MINUTE - minutes;
  }

  // Otherwise the next weekday's open. Friday after the bell and the
  // weekend all land on Monday.
  let daysAhead = 1;
  let next = (day + 1) % 7;
  while (next === 0 || next === 6) {
    next = (next + 1) % 7;
    daysAhead++;
  }

  return daysAhead * 24 * 60 - minutes + OPEN_MINUTE;
}

export function marketStatus(): MarketStatus {
  const { day, minutes } = nowInNewYork();

  const weekend = day === 0 || day === 6;

  let state: MarketState = "closed";
  if (!weekend) {
    if (minutes >= OPEN_MINUTE && minutes < CLOSE_MINUTE) state = "open";
    else if (minutes >= PRE_START && minutes < OPEN_MINUTE) state = "pre";
    else if (minutes >= CLOSE_MINUTE && minutes < AFTER_END) state = "after";
  }

  return {
    state,
    label: LABELS[state],
    opensInMinutes: state === "open" ? null : minutesUntilOpen(day, minutes),
  };
}
