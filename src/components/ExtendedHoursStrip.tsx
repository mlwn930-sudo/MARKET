import type { ExtendedHours } from "@/lib/sources/extended-hours";

/**
 * Pre-market and after-hours, beside the regular quote.
 *
 * Both are shown whenever they exist, not only the one that is live. At
 * ten in the morning the pre-market move is still the reason the stock
 * opened where it did, and hiding it the moment the bell rings throws away
 * the explanation just as people arrive to ask for it.
 *
 * Each figure says what it is measured against, because the two references
 * are different and a reader cannot be expected to know that: pre-market
 * runs from yesterday's close, after-hours from today's. A percentage
 * without its reference is the kind of number this site does not print.
 */

const money = (value: number) =>
  "$" +
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const signed = (value: number) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}%`;

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/New_York",
  });

const PHASE_LABEL: Record<ExtendedHours["phase"], string> = {
  pre: "לפני הפתיחה",
  regular: "מסחר רגיל",
  post: "אחרי הסגירה",
  closed: "השוק סגור",
};

export function ExtendedHoursStrip({ data }: { data: ExtendedHours | null }) {
  if (!data || (!data.pre && !data.post)) return null;

  const sessions = [
    { key: "pre" as const, label: "Pre-Market", session: data.pre },
    { key: "post" as const, label: "After-Hours", session: data.post },
  ].filter((entry) => entry.session);

  return (
    <div className="extended-hours" aria-label="מסחר מחוץ לשעות">
      {sessions.map(({ key, label, session }) => {
        if (!session) return null;
        const up = session.changePercent >= 0;
        return (
          <div
            className="extended-cell"
            key={key}
            data-live={data.phase === key ? "true" : undefined}
          >
            <span className="extended-label" dir="ltr">
              {label}
              {data.phase === key && <i aria-label="מתעדכן כעת" />}
            </span>

            <strong className="num" dir="ltr">
              {money(session.price)}
            </strong>

            <span className={`num ${up ? "text-up" : "text-down"}`} dir="ltr">
              {signed(session.changePercent)}
              <small>
                {" "}
                {up ? "+" : "−"}
                {Math.abs(session.change).toFixed(2)}
              </small>
            </span>

            <small className="extended-note">
              {session.against === "previousClose"
                ? "מול הסגירה הקודמת"
                : "מול סגירת המסחר"}{" "}
              · {clock(session.at)} ET
            </small>
          </div>
        );
      })}

      <span className="extended-phase">{PHASE_LABEL[data.phase]}</span>
    </div>
  );
}
