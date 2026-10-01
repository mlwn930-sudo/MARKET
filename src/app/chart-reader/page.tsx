import { ChartReader } from "@/components/ChartReader";
import { Disclaimer, Hero, Page, Section } from "@/components/ui";

export const metadata = {
  title: "קריאת גרף",
  description:
    "העלאת צילום מסך של גרף וקבלת קריאה טכנית מלאה — מבנה, רמות, סתירות ומה יפריך אותה.",
};

/** Nothing here is cached: every read is of an image that has just arrived
 *  and will never be seen again. */
export const dynamic = "force-dynamic";

export default function ChartReaderPage() {
  return (
    <Page>
      <Hero
        eyebrow="MARKET / CHART READER"
        title={
          <>
            צילום של גרף. <em className="not-italic">קריאה של אנליסט.</em>
          </>
        }
        lede="מעלים צילום מסך של גרף — מכל פלטפורמה — ומקבלים את מה שאנליסט בכיר היה אומר עליו בישיבת בוקר: מה המבנה, אילו רמות נקראות, איפה הראיות סותרות זו את זו, ומה היה מפריך את הקריאה."
      />

      <Section
        eyebrow="01 / THE IMAGE"
        title="הגרף"
        description="התמונה נשלחת לקריאה ולא נשמרת בשום מקום — לא בשרת ולא בדפדפן."
      >
        <ChartReader />
      </Section>

      <Section
        eyebrow="02 / WHAT THIS IS NOT"
        title="מה הקריאה הזאת לא עושה"
        description="כדי שהתשובה תהיה שימושית, חשוב שיהיה ברור מה היא לא."
      >
        <div className="reader-limits">
          <div>
            <strong>לא ממליצה ולא מתזמנת.</strong>
            <p>
              אין כאן &quot;לקנות&quot;, &quot;למכור&quot;, &quot;להמתין&quot; או
              יעד מחיר. הקריאה מוסרת את הטיעון; ההחלטה היא שלכם. זה אותו קו
              שעובר בכל האתר.
            </p>
          </div>
          <div>
            <strong>לא רואה מעבר לתמונה.</strong>
            <p>
              אין לה דוחות, אין לה חדשות ואין לה מה שקרה אחרי הצילום. אם הגרף
              לא מראה ווליום, היא תכתוב שאין ווליום — ולא תשלים אותו.
            </p>
          </div>
          <div>
            <strong>לא מתיימרת לוודאות.</strong>
            <p>
              כל קריאה מגיעה עם רמת ביטחון ועם הסיבה לה, ועם רשימה של מה
              שהתמונה לא יכולה להכריע. צילום מטושטש מקבל קריאה זהירה.
            </p>
          </div>
        </div>
      </Section>

      <Disclaimer />
    </Page>
  );
}
