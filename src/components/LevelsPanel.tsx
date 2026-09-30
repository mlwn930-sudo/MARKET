import type { PriceLevel, FlowRead } from "@/lib/metrics/levels";
import { Section } from "./ui";

/**
 * The prices this stock has turned at, and what the volume was doing.
 *
 * Written to be read as evidence rather than as a call. Every row says how
 * many times the level was reached, how many of those it held, and how
 * heavy the trading was when it did — so a reader can see the difference
 * between a level that has turned price four times out of four and one
 * that has been broken twice and is simply where the stock used to be.
 * The table states that; it does not tell anyone what to do about it.
 *
 * The same discipline governs the flow figures. They are labelled by what
 * they count — volume on rising days, days that cleared a stated multiple
 * of their own average — and never by who is presumed to have been buying.
 * The tape does not carry that, 13F carries it a quarter late, and a
 * number that implies otherwise is inventing its own evidence.
 */

const pct = (value: number) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

const money = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 2 });

function compactVolume(value: number) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return String(Math.round(value));
}

export function LevelsPanel({
  levels,
  flow,
  currency = "$",
}: {
  levels: PriceLevel[];
  flow: FlowRead;
  currency?: string;
}) {
  if (levels.length === 0 && flow.upVolumeShare === null) return null;

  const share = flow.upVolumeShare;
  const net = flow.heavyUpDays - flow.heavyDownDays;

  return (
    <Section
      eyebrow="LEVELS / FLOW"
      title="איפה המחיר נעצר, ומה הווליום עשה שם"
      description="רמות שנגזרו מהנרות עצמם: מחיר שהמניה התהפכה בו יותר מפעם אחת. לצד כל רמה — כמה פעמים היא החזיקה, כמה פעמים נשברה, ומה היה הווליום ביחס לממוצע באותם ימים."
    >
      {levels.length > 0 && (
        <div className="levels-table" role="table" aria-label="רמות מחיר">
          {/* Two counts that mean different things used to sit next to each
              other — the swings that defined the band, and the times price
              later came back to it — and "2" beside "6 / 0" reads like an
              error. The swing count moved under the price, where it says
              what it is. */}
          <div className="levels-row levels-head" role="row">
            <span role="columnheader">רמה</span>
            <span role="columnheader">מרחק</span>
            <span role="columnheader">גישות</span>
            <span role="columnheader">החזיקה / נשברה</span>
            <span role="columnheader">ווליום מול ממוצע</span>
          </div>
          {levels.map((level) => (
            <div className="levels-row" role="row" key={`${level.kind}-${level.price}`}>
              <span role="cell">
                <b className="num" dir="ltr">
                  {currency}
                  {money(level.price)}
                </b>
                <small>
                  {level.kind === "support" ? "תמיכה" : "התנגדות"} · נבנתה מ־
                  {level.touches} נקודות היפוך
                </small>
              </span>
              <span role="cell" className="num" dir="ltr">
                {pct(level.distancePercent)}
              </span>
              <span role="cell" className="num">
                {level.held + level.broke}
              </span>
              <span role="cell" className="num" dir="ltr">
                {level.held} / {level.broke}
              </span>
              <span role="cell" className="num" dir="ltr">
                {level.volumeRatio != null ? `${level.volumeRatio.toFixed(2)}x` : "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flow-grid">
        <div className="flow-cell">
          <span>ווליום בימי עלייה</span>
          <strong className="num" dir="ltr">
            {share != null ? `${(share * 100).toFixed(0)}%` : "—"}
          </strong>
          <small>
            {share != null
              ? `מתוך כלל המחזור ב־${flow.window} ימי המסחר האחרונים. 50% הוא איזון.`
              : `אין מספיק היסטוריה לחישוב.`}
          </small>
        </div>

        <div className="flow-cell">
          <span>ימים כבדים בסגירה גבוהה</span>
          <strong className="num" dir="ltr">
            {flow.heavyUpDays}
          </strong>
          <small>
            ווליום מעל {flow.heavyThreshold}× הממוצע ל־50 יום, וסגירה בשליש
            העליון של טווח היום.
          </small>
        </div>

        <div className="flow-cell">
          <span>ימים כבדים בסגירה נמוכה</span>
          <strong className="num" dir="ltr">
            {flow.heavyDownDays}
          </strong>
          <small>
            אותו סף ווליום, סגירה בשליש התחתון. ההפרש בין השניים: {net >= 0 ? "+" : ""}
            {net}.
          </small>
        </div>

        <div className="flow-cell">
          <span>המחזור האחרון</span>
          <strong className="num" dir="ltr">
            {flow.latestRatio != null ? `${flow.latestRatio.toFixed(2)}x` : "—"}
          </strong>
          <small>
            מול ממוצע 50 יום
            {flow.averageVolume != null
              ? ` (${compactVolume(flow.averageVolume)} מניות ביום בממוצע)`
              : ""}
            .
          </small>
        </div>
      </div>

      {flow.heaviest && (
        <p className="data-caption">
          היום הכבד ביותר בחלון: {flow.heaviest.date} — פי{" "}
          <span className="num" dir="ltr">
            {flow.heaviest.ratio.toFixed(1)}
          </span>{" "}
          מהממוצע, והמחיר נע בו{" "}
          <span className="num" dir="ltr">
            {pct(flow.heaviest.changePercent)}
          </span>
          .
        </p>
      )}

      <p className="data-caption">
        <strong>מה המספרים האלה אינם.</strong> ווליום כבד עם סגירה חזקה הוא
        הסימן המקובל לכך שהגיעה הזמנה גדולה, אבל הוא סימן ולא ידיעה: הטייפ לא
        מדווח מי קנה. הדיווח היחיד שכן — 13F — מתפרסם רבעונית ובאיחור של 45
        יום, והוא מוצג בעמוד המשקיעים המוסדיים בנפרד. רמה שנשברה בעבר אינה
        מפסיקה להיות רמה, והמספר כאן הוא כמה פעמים זה קרה — לא הסתברות שזה
        יקרה שוב.
      </p>
    </Section>
  );
}
