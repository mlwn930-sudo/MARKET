/**
 * US market session state.
 *
 * Used to decide how hard to poll. Quotes do not move when the exchange is
 * closed, so refreshing every few seconds overnight spends the rate-limit
 * budget to receive the same number over and over — and the budget is the
 * binding constraint on how fast we can refresh when it *is* open.
 *
 * Deliberately approximate: it uses New York wall-clock time and skips
 * holidays. Getting a holiday wrong costs one slow polling day, which is
 * not worth shipping a holiday calendar that needs maintenance every year.
 */

export type MarketState = "open" | "pre" | "after" | "closed";

export type MarketStatus = {
  state: MarketState;
  label: string;
  /** How often the client should refresh, in milliseconds. */
  pollMs: number;
};

const LABELS: Record<MarketState, string> = {
  open: "הבורסה פתוחה",
  pre: "מסחר מוקדם",
  after: "מסחר מאוחר",
  closed: "הבורסה סגורה",
};

/**
 * Poll intervals, set by the rate limit rather than by taste.
 *
 * Finnhub's free tier allows 60 calls a minute and each symbol is one call.
 * The dashboard watches eleven, so eight seconds is 82 calls a minute across
 * two batched groups sharing one server cache — comfortably under, with room
 * for a company page open in another tab.
 */
const POLL: Record<MarketState, number> = {
  open: 8_000,
  pre: 20_000,
  after: 20_000,
  closed: 120_000,
};

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
    return { state: "closed", label: LABELS.closed, pollMs: POLL.closed };
  }

  const open = 9 * 60 + 30;
  const close = 16 * 60;
  const preStart = 4 * 60;
  const afterEnd = 20 * 60;

  let state: MarketState = "closed";
  if (minutes >= open && minutes < close) state = "open";
  else if (minutes >= preStart && minutes < open) state = "pre";
  else if (minutes >= close && minutes < afterEnd) state = "after";

  return { state, label: LABELS[state], pollMs: POLL[state] };
}
