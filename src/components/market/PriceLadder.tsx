import type { Corroboration } from "@/lib/analysis/chart-corroborate";
import type { PriceLevel } from "@/lib/metrics/levels";

/**
 * The prices, as one ladder around where price actually is.
 *
 * The page already checked the read's levels and already drew a volume
 * profile, and neither of them answers the question a person brings to a
 * chart, which is *which prices matter and how far am I from them*. The
 * levels block is organised around whose claim each level was — the
 * model's, confirmed or not — and a reader does not care whose claim it
 * was. The profile is a picture of where volume traded, which is a
 * different question from where price turned.
 *
 * So this is one list, in price order, with the last close in its place
 * in the list rather than in a sentence above it. That ordering is the
 * entire contribution: a ladder shows at a glance that the nearest thing
 * above is four percent away and the nearest below is one percent away,
 * and no amount of prose does that.
 *
 * WHAT IT IS NOT. It is not entry points and it does not rank the rungs.
 * Every number on it was measured from this instrument's own candles —
 * the band's price, the swings that reversed inside it, how often it held
 * and how often a close went through it — and a band with six touches
 * that broke five times is printed exactly that way rather than being
 * quietly dropped for spoiling the picture. A level the market has
 * stopped respecting is one of the more useful things on the page, and it
 * only survives if nothing here is sorting for conviction.
 *
 * Rule 5 is the reason every rung carries its counts: `231.40` is a
 * price, and `231.40, six touches, held four, 4.2% above` is a level.
 */

const pct = (value: number) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;

function Rung({ level }: { level: PriceLevel }) {
  /* TWO COUNTS, TWO UNITS, AND THE UNIT NAMED ON EACH.
     `touches` counts the swing pivots that defined the band. `held` and
     `broke` count something else entirely — episodes of price reaching
     the band and then either leaving the way it came or closing clear
     through it, over every bar since the band formed. So a level can
     read "2 swings, 28 encounters", and printed as two bare numbers that
     looks like an error in the data rather than two different questions.
     The same confusion once made "14 of 15" beside "3 touches" read as a
     contradiction on another panel; the fix there was to name the unit,
     and it is the fix here. */
  const encounters = level.held + level.broke;

  return (
    <div className="ladder-rung">
      <b className="num" dir="ltr">
        {level.price.toFixed(2)}
      </b>
      <span className="ladder-dist num" dir="ltr">
        {pct(level.distancePercent)}
      </span>
      <span className="ladder-detail">
        <span className="num">{level.touches}</span>{" "}
        {level.touches === 1 ? "סווינג" : "סווינגים"}
        {encounters > 0 && (
          <>
            {" · "}
            <span className="num">{encounters}</span> מפגשים
            {level.broke === 0 ? (
              <>, כולם החזיקו</>
            ) : (
              <>
                , <span className="num">{level.broke}</span> מהם נפרצו
              </>
            )}
          </>
        )}
        {level.volumeRatio !== null && (
          <>
            {" · "}מחזור ×
            <span className="num">{level.volumeRatio.toFixed(1)}</span>
          </>
        )}
      </span>
      <span className="ladder-last num" dir="ltr">
        {level.lastTouch}
      </span>
    </div>
  );
}

export function PriceLadder({ checked }: { checked: Corroboration }) {
  const levels = checked.realLevels;
  if (levels.length === 0) return null;

  /* Sorted by price rather than by distance, which is how `readLevels`
     returns them. A ladder sorted by proximity is two interleaved
     sequences and reads as neither. */
  const byPrice = [...levels].sort((a, b) => b.price - a.price);
  const above = byPrice.filter((l) => l.price > checked.lastClose);
  const below = byPrice.filter((l) => l.price <= checked.lastClose);

  const tape = checked.tape;
  const profile = tape?.profile ?? null;

  return (
    <section className="read-block read-check price-ladder">
      <h3>
        מחירים מעניינים
        <span className="read-check-sym num" dir="ltr">
          {checked.ticker}
        </span>
      </h3>
      <p className="read-check-note">
        לא קווים שמישהו צייר על תמונה — אלה הרמות שהנרות של{" "}
        <span className="num" dir="ltr">
          {checked.ticker}
        </span>{" "}
        באמת הסתובבו בהן, מתוך{" "}
        <span className="num">{checked.candleCount}</span> נרות. ליד כל רמה
        שני מספרים שסופרים דברים שונים:{" "}
        <strong>סווינגים</strong> הם נקודות המחיר שהגדירו את הרמה מראש,
        ו<strong>מפגשים</strong> הם הפעמים שהמחיר הגיע אליה מאז — ויצא
        מאותו צד שבא ממנו, או סגר מעברה. לכן רמה יכולה להיות שני סווינגים
        ועשרים ושמונה מפגשים; אלה שתי שאלות, לא אי-התאמה. רמה שנפרצה יותר
        משהחזיקה נשארת ברשימה — רמה שהשוק הפסיק לכבד היא מידע, לא פגם
        ברשימה.
      </p>

      <div className="ladder">
        {above.map((level) => (
          <Rung key={`a-${level.price}`} level={level} />
        ))}

        <div className="ladder-now">
          <b className="num" dir="ltr">
            {checked.lastClose.toFixed(2)}
          </b>
          <span>הסגירה האחרונה</span>
        </div>

        {below.map((level) => (
          <Rung key={`b-${level.price}`} level={level} />
        ))}
      </div>

      {profile && (
        <div className="read-check-extra">
          <strong>איפה המחזור באמת נסחר</strong>
          <p>
            מרבית המחזור בחלון שנמדד עבר סביב{" "}
            <span className="num" dir="ltr">
              {profile.poc.toFixed(2)}
            </span>
            , ו־
            <span className="num">
              {Math.round(profile.valueAreaShare * 100)}%
            </span>{" "}
            ממנו בין{" "}
            <span className="num" dir="ltr">
              {profile.valueAreaLow.toFixed(2)}
            </span>{" "}
            ל־
            <span className="num" dir="ltr">
              {profile.valueAreaHigh.toFixed(2)}
            </span>
            .
          </p>
          <small>
            זו שאלה אחרת מהרמות שלמעלה: שם נמדד איפה המחיר הסתובב, כאן איפה
            עברו המניות. השתיים לא חייבות להצביע על אותו מקום, וכשהן כן —
            זה שני מדידות שמסכימות, לא מדידה אחת חזקה יותר.
          </small>
        </div>
      )}
    </section>
  );
}
