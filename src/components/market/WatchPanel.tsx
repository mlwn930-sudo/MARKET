import Link from "next/link";
import { CompanyMark } from "@/components/CompanyMark";
import { Section } from "@/components/ui";
import type { Finding, WatchFile } from "@/lib/watch-store";
import { watchAgeMinutes } from "@/lib/watch-store";

/**
 * What the watcher found since it last looked.
 *
 * The site's other surfaces answer questions a reader brought with them.
 * This one answers the question nobody can ask, because it is about what
 * they have not seen: which of a hundred and twenty-three companies did
 * something out of character while the page was closed.
 *
 * Every row carries the figure that produced it. "SNPS moved a lot" is a
 * claim; "12.78% in a day, 4.8 times its own daily deviation this quarter"
 * is the finding, and the second one is the only kind this site makes.
 * Nothing is scored and nothing is called an opportunity — the ordering is
 * by how far outside normal the observation is, which is a statement about
 * the measurement and not about whether to buy.
 */

const KIND_LABEL: Record<Finding["kind"], string> = {
  move: "תנועה חריגה",
  range: "קצה טווח",
  event: "מועד מתקרב",
  story: "כתבה מהותית",
};

function ageText(minutes: number | null): string {
  if (minutes === null) return "הסורק טרם רץ";
  if (minutes < 2) return "נסרק הרגע";
  if (minutes < 90) return `נסרק לפני ${minutes} דקות`;
  const hours = Math.round(minutes / 60);
  return `נסרק לפני ${hours} שעות`;
}

export function WatchPanel({ data, limit = 8 }: { data: WatchFile; limit?: number }) {
  const age = watchAgeMinutes(data.builtAt);
  const rows = data.findings.slice(0, limit);

  if (rows.length === 0) {
    return (
      <Section
        eyebrow="הסורק"
        title="מה השתנה בזמן שלא היית כאן"
        description="הסורק עובר על כל החברות באתר, מחפש תנועה חריגה, קצה טווח, מועד מתקרב וכתבה שהניתוח סימן כמהותית."
      >
        <p className="watch-empty">
          {age === null
            ? "הסריקה טרם רצה. היא רצה בלוח זמנים, לא ברקע — ראו את ההערה למטה."
            : `${ageText(age)} ולא נמצא דבר חריג. זו תשובה, לא כשל: יום שבו שום חברה לא יצאה מהטווח שלה הוא יום שקט.`}
        </p>
      </Section>
    );
  }

  return (
    <Section
      eyebrow="הסורק"
      title="מה השתנה בזמן שלא היית כאן"
      description="כל שורה כאן היא תצפית עם המספר שהפיק אותה. אין כאן ציון, דירוג או המלצה — הסדר הוא לפי כמה התצפית חורגת מהרגיל של אותה חברה."
    >
      <div className="watch-list">
        {rows.map((finding, i) => {
          const body = (
            <>
              {finding.ticker ? (
                <CompanyMark ticker={finding.ticker} size="sm" />
              ) : (
                <span className="watch-dot" aria-hidden="true" />
              )}
              <span className="watch-text">
                <span className="watch-kind">{KIND_LABEL[finding.kind]}</span>
                <strong>{finding.headline}</strong>
                <small>{finding.detail}</small>
              </span>
            </>
          );

          /* A story links out to the publisher; everything else links to the
             company page, where the figure can be checked against the chart
             that produced it. */
          const external = finding.kind === "story";
          return finding.href ? (
            external ? (
              <a
                key={`${i}-${finding.headline}`}
                className="watch-row"
                href={finding.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {body}
              </a>
            ) : (
              <Link
                key={`${i}-${finding.headline}`}
                className="watch-row"
                href={finding.href}
              >
                {body}
              </Link>
            )
          ) : (
            <div key={`${i}-${finding.headline}`} className="watch-row">
              {body}
            </div>
          );
        })}
      </div>

      {/* What the scan covered and when. A watcher that does not say how
          stale it is invites a reader to treat a half-hour-old finding as
          a live one. */}
      <p className="data-caption">
        {ageText(age)} · <span className="num">{data.priced}</span> מתוך{" "}
        <span className="num">{data.universe}</span> חברות קיבלו מחיר ·{" "}
        <span className="num">{data.findings.length}</span> ממצאים, מוצגים{" "}
        <span className="num">{rows.length}</span>. הסריקה רצה בלוח זמנים — כל
        חצי שעה בשעות המסחר, פעמיים ביום מחוצה להן — ולא ברקע ברציפות.
      </p>
    </Section>
  );
}
