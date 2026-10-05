import { getSignalValue } from "@/lib/metrics/signal-value";
import { Disclaimer, Empty, Hero, MoreLink, Page, Section } from "@/components/ui";

export const revalidate = 3600;

export const metadata = {
  title: "מה האותות באמת שווים",
  description:
    "כל אות טכני קלאסי, נמדד על 123 מניות ועשר שנים, מול שיעור הבסיס של כל מניה בנפרד. כמה מהם באמת נשאו מידע.",
};

/**
 * The finding the rest of the site is built on, stated once.
 *
 * Every chart page in the world shows a golden cross and lets the reader
 * supply the meaning. This measures it: a hundred and twenty-three names,
 * ten years, every occurrence counted, and each name scored against ITS
 * OWN baseline so a company that tripled cannot carry the result.
 *
 * The answer is mostly "nothing", and that is the page. A site that sells
 * signals cannot publish this; a site that measures them has to.
 */

const pp = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

export default async function SignalsPage() {
  const report = await getSignalValue();

  if (!report) {
    return (
      <Page tint="#2855f5">
        <Hero
          eyebrow="MARKET / SIGNALS"
          title="מה האותות באמת שווים"
          lede="המדידה טרם נבנתה."
        />
        <Empty
          title="אין עדיין קובץ מדידה"
          reason="הדוח נבנה מ-content/base-rates/latest.json, שנכתב על ידי scripts/build-base-rates.ts. עד שהוא ירוץ אין מה להציג, ומספר משוער היה סותר את כל מה שהעמוד הזה אומר."
        />
        <Disclaimer />
      </Page>
    );
  }

  const quiet = report.measurable - report.strong;

  return (
    <Page tint="#2855f5">
      <Hero
        eyebrow="MARKET / SIGNALS"
        title="רוב האותות שאתם מכירים לא שווים כלום"
        lede="לא דעה. מדידה: כל תנאי טכני קלאסי נספר על 123 מניות לאורך עשר שנים, וכל מניה נבדקה מול שיעור הבסיס של עצמה — כמה פעמים יום אקראי באותו חלון הסתיים גבוה יותר. מה שנשאר אחרי החיסור הוא מה שהאות באמת הוסיף."
        action={<MoreLink href="/learn#technical">איך לקרוא את זה</MoreLink>}
      />

      <Section
        eyebrow="השורה התחתונה"
        title={`${quiet} מתוך ${report.measurable} המדידות לא הוסיפו כלום`}
        description={`מתוך ${report.total} צמדים של מניה ותנאי, ${report.measurable} התרחשו מספיק פעמים כדי להימדד. מהם רק ${report.strong} הזיזו את השיעור בעשר נקודות אחוז או יותר מול קו הבסיס של אותה מניה — לכאן או לכאן. כל השאר תיארו את המגמה שהם רכבו עליה.`}
      >
        <div className="surface overflow-x-auto">
          <table className="signal-table">
            <thead>
              <tr>
                <th>האות</th>
                <th>מניות</th>
                <th>מופעים</th>
                <th>תוספת חציונית</th>
                <th>מחצית המקרים</th>
                <th>עזר מאוד</th>
                <th>הזיק מאוד</th>
              </tr>
            </thead>
            <tbody>
              {report.signals.map((s) => {
                const nothing = Math.abs(s.medianLiftPp) < 2;
                return (
                  <tr key={s.label}>
                    <td className="signal-name">{s.label}</td>
                    <td className="num">{s.names}</td>
                    <td className="num">{s.occurrences.toLocaleString("he-IL")}</td>
                    <td
                      className={`num signal-lift ${
                        nothing
                          ? "is-nil"
                          : s.medianLiftPp > 0
                            ? "is-up"
                            : "is-down"
                      }`}
                    >
                      {pp(s.medianLiftPp)}
                      <small> נק׳</small>
                    </td>
                    <td className="num signal-spread">
                      {pp(s.p25LiftPp)} … {pp(s.p75LiftPp)}
                    </td>
                    <td className="num">{Math.round(s.shareStrongUp * 100)}%</td>
                    <td className="num">{Math.round(s.shareStrongDown * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="data-caption">
          נמדד {report.from} עד {report.to} על{" "}
          <span className="num">{report.universe}</span> מניות. &quot;תוספת&quot;
          היא ההפרש בנקודות אחוז בין השיעור אחרי התנאי לבין שיעור הבסיס של אותה
          מניה, בטווח של חודש. &quot;מחצית המקרים&quot; הוא הטווח שבו נפלו
          מחצית המניות — העמודה שמראה כמה רחב הפיזור שהחציון מסתיר.
        </p>
      </Section>

      <Section
        eyebrow="מה שחשוב לקרוא לפני שמסיקים"
        title="שלוש הסתייגויות שאינן קוסמטיות"
        description="כל אחת מהן יכולה לשנות את המסקנה, ולכן הן כאן ולא בהערת שוליים."
      >
        <div className="surface space-y-4 p-6 text-[14px] leading-relaxed text-ink-muted">
          <p>
            <b className="text-ink">היקום הוא ניצולים.</b> אלה חברות גדולות
            שנמצאות במדד <em>היום</em>, לאורך עשור שברובו עלה. זה בוחר פעמיים
            לטובת הצלחה, וזה כמעט בוודאות מסביר למה צלב המוות נראה טוב: הוא קרה
            בתוך ירידות, וכל ירידה בחלון הזה התאוששה. קראו את הטבלה כ&quot;מה
            האותות האלה היו שווים על המניות האלה בעשור הזה&quot;, לא
            כ&quot;מה הם שווים&quot;.
          </p>
          <p>
            <b className="text-ink">חלונות חופפים אינם בלתי תלויים.</b> אותה
            מניה מספקת את כל התצפיות שלה, ושתי תצפיות במרחק שבוע חולקות כמעט את
            כל הימים. המספרים אמיתיים; רווח הסמך סביבם רחב יותר ממה שגודל המדגם
            מרמז.
          </p>
          <p>
            <b className="text-ink">זו אינה בדיקת אסטרטגיה.</b> אין כאן פוזיציה,
            עמלה, מרווח או יציאה — ולכן שום מספר כאן לא אומר מה מסחר על בסיסו היה
            מניב. השאלה הצרה יותר שנמדדה היא אם האירוע נשא מידע על החודש שאחריו,
            וזו בדיוק הטענה שכל אות טכני טוען.
          </p>
        </div>
      </Section>

      <Disclaimer extra="הטבלה הזו מתארת את העבר. היא אינה תחזית, אינה המלצה, ואינה טוענת שאות שעבד בעשור הזה יעבוד בבא." />
    </Page>
  );
}
