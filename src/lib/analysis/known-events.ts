/**
 * Events the filings do not contain.
 *
 * Everything else on this site is computed from a feed or a filing. This
 * file is the one exception, and it is a table typed by hand — because the
 * single most important fact about Take-Two right now is a product release,
 * and no financial API carries a release window.
 *
 * The rules that keep it honest:
 *
 *   Every entry carries a source, and the source is shown on the page. A
 *   reader can see that this came from the company's own statements and not
 *   from a calculation.
 *
 *   No invented dates. `window` is written exactly as the company stated
 *   it. If the company has not given a date, the field says so — a precise
 *   date invented here would look identical to one taken from an earnings
 *   calendar, which is exactly the confusion the rest of the site is built
 *   to avoid.
 *
 *   No numbers. An entry says what the event is and which line of the
 *   income statement it would move. It never says by how much: a revenue
 *   figure attached to an unreleased product is a guess with a decimal
 *   point.
 *
 * Add to this only what materially changes a business, and delete an entry
 * once it has happened and the filings have absorbed it.
 */

export type KnownEvent = {
  ticker: string;
  title: string;
  /** As the company stated it. Null when the company has not given one. */
  window: string | null;
  /** The mechanism: which part of the business this moves, and how. */
  why: string;
  /** What to watch for that would confirm or break it. */
  watch: string;
  /** Where this came from. Printed next to the entry. */
  source: string;
};

const EVENTS: KnownEvent[] = [
  {
    ticker: "TTWO",
    title: "השקת GTA VI",
    window: null,
    why:
      "ההשקה מזיזה את ההכנסות של Take-Two בסדר גודל שהדוחות הקודמים אינם " +
      "מתארים. שני מנגנונים פועלים בכיוונים הפוכים: הוצאות השיווק וההפחתה " +
      "נרשמות לפני ובזמן ההשקה, בעוד שחלק מההכנסה נפרס על פני זמן ולא " +
      "מוכר במלואו ברבעון ההשקה. לכן רבעון ההשקה נוטה להיראות גרוע יותר " +
      "מהמציאות הכלכלית שלו.",
    watch:
      "הנחיית ההנהלה ל-Bookings (ולא להכנסות המוכרות), קצב ההוצאה השיווקית " +
      "ברבעונים שלפני, ותאריך שהחברה מאשרת ולא מקדמת.",
    source: "עמוד ההשקה של האתר · הודעות Take-Two",
  },
];

export function knownEventsFor(ticker: string): KnownEvent[] {
  const symbol = ticker.toUpperCase();
  return EVENTS.filter((event) => event.ticker === symbol);
}
