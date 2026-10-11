import type { CoverageRow } from "@/app/api/watchlist-coverage/route";

/**
 * When the next report lands, and whether a horizon contains it.
 *
 * The one thing a holder can know in advance and the one thing a chart
 * cannot show. It already reached the alert mail as a catalyst and was
 * missing from the page the reader actually opens.
 *
 * IT DOES NOT INVALIDATE ANYTHING, and the copy has to be careful about
 * that. The base rates were counted over ten years that contained every
 * earnings date those instruments ever had, so a report inside the
 * window is already inside the number — the rate is not wrong and does
 * not need a discount. What changes is what the reader is agreeing to:
 * a scheduled binary event, known about in advance, sitting inside a
 * window a technical condition is speaking for.
 *
 * Saying "the stance is less reliable" would be inventing a correction
 * nothing here measured. Saying "the report falls inside the horizon"
 * is a fact, and the reader can do what they like with it.
 */
export function EarningsNote({
  earnings,
}: {
  earnings: CoverageRow["earnings"];
}) {
  if (!earnings) return null;

  const { date, daysAway, insideSwing, insidePosition } = earnings;

  const when =
    daysAway < 0
      ? "דווח כבר"
      : daysAway === 0
        ? "מדווחת היום"
        : daysAway === 1
          ? "מדווחת מחר"
          : `מדווחת בעוד ${daysAway} ימים`;

  const inside = insideSwing
    ? "בתוך אופק הסווינג ואופק הרבעון"
    : insidePosition
      ? "בתוך אופק הרבעון, מחוץ לסווינג"
      : null;

  return (
    <p className="cover-earnings">
      <span className="cover-earnings-when">{when}</span>
      <span className="num" dir="ltr">
        {date}
      </span>
      {inside && (
        <span className="cover-earnings-inside">
          הדוח נופל {inside}. זה אינו מוריד מהשיעור — עשר השנים שנספרו
          כוללות כל דוח שהנייר הזה פרסם — אבל זה אירוע מתוזמן שידוע מראש
          בתוך החלון.
        </span>
      )}
    </p>
  );
}
