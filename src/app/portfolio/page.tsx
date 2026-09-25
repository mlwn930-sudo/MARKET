import { PortfolioBuilder } from "@/components/PortfolioBuilder";
import { Disclaimer, Hero, Page, Section } from "@/components/ui";

export const metadata = {
  title: "בניית תיק",
  description:
    "הרכב תיק וראה במה הוא מרוכז: פוזיציה גדולה, סקטור כבד, המכפיל המשוקלל, והחלק שלא ניתן למדוד.",
};

/**
 * The portfolio page.
 *
 * It measures exposure and refuses to grade. That is not timidity: the
 * same holdings are reckless for someone who needs the money in a year and
 * ordinary for someone who does not, and the site knows neither. What it
 * can do is show what the reader cannot see by looking at a list of
 * tickers — that five semiconductor companies are one position, that a
 * third of the money rests on one name, that the weighted multiple assumes
 * growth continues.
 */
export default function PortfolioPage() {
  return (
    <Page tint="#0a84ff" width="wide">
      <Hero
        eyebrow="תיק"
        title="במה התיק הזה באמת מרוכז"
        lede="הזן חברות ומשקלים, וקבל מדידה של מה שהתיק חשוף אליו: כמה יושב על נייר אחד, כמה על סקטור אחד, איזה מכפיל הוא משלם, וכמה ממנו האתר לא יכול למדוד. אין כאן ציון, אין דירוג ואין המלצה מה להחזיק."
      />

      <Section
        eyebrow="הרכבה"
        title="התיק שלך"
        description="נשמר בדפדפן הזה בלבד — אין חשבונות ואין שרת שמחזיק את הנתונים."
      >
        <PortfolioBuilder />
      </Section>

      <Section eyebrow="איך לקרוא את זה" title="מה המדידות אומרות ומה לא">
        <div className="surface space-y-3 p-5 text-[13px] leading-relaxed text-ink-muted">
          <p>
            <span className="text-ink">ריכוז אינו סיכון, הוא הגברה. </span>
            תיק מרוכז מגדיל גם את הטעות וגם את הפגיעה. האתר מודד כמה הוא מרוכז
            ולא אומר אם זה מתאים לך — לזה צריך לדעת מה אופק ההשקעה שלך ומה
            תעשה בירידה של 30%, ושני הדברים אינם ידועים כאן.
          </p>
          <p>
            <span className="text-ink">
              &quot;כמה פוזיציות זה באמת&quot; הוא המספר הכי שימושי בעמוד.{" "}
            </span>
            הוא מחושב כ-1 חלקי מדד הרפינדל של המשקלים, ועונה על השאלה: כמה
            פוזיציות שוות היו מרגישות כמו התיק הזה. תיק של 12 ניירות שמתנהג כמו
            3 הוא תיק של 3.
          </p>
          <p>
            <span className="text-ink">מה שלא נמדד נשאר לא נמדד. </span>
            קרן סל, חברה מחוץ ליקום האתר, או נייר שאינו מגיש ל-SEC — לא נכנסים
            לממוצעים ולא מוחלפים בהנחה. העמוד אומר איזה אחוז מהתיק זה.
          </p>
        </div>
      </Section>

      <Disclaimer extra="העמוד מודד חשיפה בלבד. אין בו המלצה להחזיק, לקנות או למכור נייר ערך כלשהו, ואין בו התאמה לצרכים, לאופק ההשקעה או למצב המס של אף אדם." />
    </Page>
  );
}
