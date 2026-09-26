import Link from "next/link";
import { getSectorViews } from "@/lib/sectors";
import { describeStatus, marketStatus } from "@/lib/market-hours";
import { Disclaimer, Hero, Page, Section } from "@/components/ui";
import { directionClass, fmtCompact, fmtMetric, fmtPercent } from "@/lib/format";

export const revalidate = 120;

export const metadata = {
  title: "סקטורים",
  description:
    "תשעה סקטורים, כל אחד עם התנועה שלו, החציונים שלו, מי מוביל ומי גורר.",
};

/**
 * Sector intelligence.
 *
 * Ordered by today's move, so the page opens on what is actually happening
 * rather than on whatever sector happens to be first alphabetically. Each
 * row carries the equal-weight average — see lib/sectors.ts for why that
 * and not a cap-weighted number — the count of members that rose, and the
 * sector's own median multiple, which is the figure every company page
 * compares against.
 */
export default async function SectorsPage() {
  const sectors = await getSectorViews();

  const quoted = sectors.reduce((total, sector) => total + sector.quoted, 0);
  const members = sectors.reduce(
    (total, sector) => total + sector.members.length,
    0,
  );

  return (
    <Page tint="#0a84ff" width="wide">
      <Hero
        eyebrow="סקטורים"
        title="איפה הכסף זז היום, ולמה"
        lede="תשעה סקטורים, ממוינים לפי התנועה של היום. התנועה מחושבת כממוצע שווה בין החברות ולא לפי שווי שוק — ביום שבו ענקית אחת עולה ותשע חברות יורדות, הממוצע המשוקלל היה אומר שהסקטור עלה, וזה נכון וחסר תועלת."
      />

      {/* When, and out of how many. The page showed nine sector moves with
          nothing saying whether the market was even open — a reader
          arriving on a Sunday had no way to tell that Friday's close was
          what they were looking at. */}
      <p className="mt-6 text-[11px] text-ink-ghost">
        {describeStatus(marketStatus())} ·{" "}
        <span className="num">
          {quoted}/{members}
        </span>{" "}
        חברות החזירו ציטוט · מתעדכן כל שתי דקות
      </p>

      <Section eyebrow="היום" title="הסקטורים לפי תנועה" className="mt-10">
        <div className="surface overflow-hidden">
          {sectors.map((sector) => (
            <Link
              key={sector.key}
              href={`/sectors/${sector.key}`}
              className="row grid-cols-[1fr_auto_auto] gap-4 sm:grid-cols-[1.4fr_auto_auto_auto_auto]"
            >
              <span className="min-w-0">
                <span className="block text-[14px] font-medium text-ink">
                  {sector.label}
                </span>
                <span className="block truncate text-[11px] text-ink-faint">
                  {sector.members.length} חברות · שווי מצרפי $
                  {fmtCompact(sector.totalMarketCap)}
                </span>
              </span>

              <span className="self-center text-end">
                <span
                  className={`num block text-[15px] ${directionClass(sector.averageMove)}`}
                >
                  {fmtPercent(sector.averageMove)}
                </span>
                <span className="num block text-[10px] text-ink-ghost">
                  {sector.advancing}/{sector.quoted} בירוק
                </span>
              </span>

              {/* A bar that reads as a share rather than as a gauge: how
                  many of the sector's members are up. */}
              <span className="hidden w-24 self-center sm:block">
                <span className="flex h-[5px] w-full overflow-hidden rounded-full bg-overlay">
                  <span
                    className="h-full bg-up"
                    style={{
                      width: `${sector.quoted ? (sector.advancing / sector.quoted) * 100 : 0}%`,
                    }}
                  />
                  <span
                    className="h-full bg-down"
                    style={{
                      width: `${sector.quoted ? ((sector.quoted - sector.advancing) / sector.quoted) * 100 : 0}%`,
                    }}
                  />
                </span>
              </span>

              <span className="hidden self-center text-end sm:block">
                <span className="block text-[10px] text-ink-ghost">
                  חציון P/E
                </span>
                <span className="num block text-[13px] text-ink-muted">
                  {fmtMetric(sector.medians.pe ?? null, "x")}
                </span>
              </span>

              <span className="hidden self-center text-end sm:block">
                <span className="block text-[10px] text-ink-ghost">
                  חציון ROIC
                </span>
                <span className="num block text-[13px] text-ink-muted">
                  {fmtMetric(sector.medians.roic ?? null, "%")}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="הסבר"
        title="מה סקטור אומר ומה לא"
        description="החלוקה לסקטורים באתר נעשתה ביד ולא נלקחה מספק נתונים."
      >
        <div className="surface space-y-3 p-5 text-[13px] leading-relaxed text-ink-muted">
          <p>
            סיווג אוטומטי לפי ענף מייצר קבוצות צרות מדי —
            &quot;מוליכים למחצה&quot; ו&quot;ציוד למוליכים למחצה&quot; היו
            מקבלות שתי חברות כל אחת, ולחציון של שתי חברות אין משמעות.
          </p>
          <p>
            החציון הוא הסיבה שהחלוקה חשובה: מכפיל 15 אומר דבר אחד בבנק ודבר
            אחר בחברת שבבים, וכל מדד בעמוד חברה מוצג מול החציון של הקבוצה
            שלה בדיוק מהסיבה הזאת.
          </p>
        </div>
      </Section>

      <Disclaimer extra="תנועה יומית של סקטור אינה אומרת דבר על איכות החברות שבו. סקטור יכול לעלות חודש שלם בזמן שהעסקים שבתוכו מתדרדרים." />
    </Page>
  );
}
