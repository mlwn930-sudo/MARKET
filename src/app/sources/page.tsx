import Link from "next/link";
import { Disclaimer, Page, Section } from "@/components/ui";

export const metadata = {
  title: "מקורות וזכויות",
  description:
    "מאיפה מגיע כל נתון באתר, באילו תנאים, ומה האתר מקפיד לא לעשות.",
};

/**
 * Where everything comes from, said in public.
 *
 * The site credited three providers in a footer line and leaned hardest on
 * two it never named. It also carried another company's artwork with the
 * permission note filed in a developer document no visitor could reach.
 * Both are the same failure: the terms were understood and then not
 * written down anywhere a reader could check them.
 *
 * This page is the correction. It is not a legal disclaimer — there is one
 * of those at the bottom of every page — it is an account of what this
 * site takes, from whom, and under what.
 */

const SOURCES = [
  {
    name: "SEC EDGAR",
    what: "דוחות כספיים, XBRL ודיווחי 13F",
    terms:
      "נתוני ממשל ציבוריים, ללא זכויות יוצרים. התנאי היחיד הוא טכני: מקסימום עשר בקשות לשנייה וזיהוי אמיתי ב-User-Agent. שניהם נאכפים בקוד.",
  },
  {
    name: "Finnhub",
    what: "ציטוטים חיים, פרופילי חברות וחדשות",
    terms:
      "שכבה חינמית, המתירה שימוש אישי לא-מסחרי בלבד. האתר אינו מסחרי, אין בו פרסום, אין בו תשלום ואין בו מנוי. זו גם הסיבה שהוא לא ייפתח לקהל רחב.",
  },
  {
    name: "Yahoo Finance",
    what: "היסטוריית מחירים, מאקרו, מסחר מחוץ לשעות וציטוטי תל אביב",
    terms:
      "נקודות קצה לא מתועדות. האתר פונה אליהן בזהות אמיתית הניתנת ליצירת קשר, בקצב נמוך ועם מטמון משותף — ולא מתחזה לדפדפן. אם הגישה תיחסם, זו התשובה והיא תתקבל.",
  },
  {
    name: "FRED",
    what: "ריבית חסרת סיכון וסדרות מאקרו",
    terms: "הבנק הפדרלי של סנט לואיס. שימוש חופשי עם ייחוס.",
  },
  {
    name: "GDELT",
    what: "אירועים גאופוליטיים",
    terms: "פרויקט פתוח, שימוש חופשי עם ייחוס.",
  },
  {
    name: "Google Gemini",
    what: "סיכומי כתבות, קריאת גרפים וניתוחי חברה",
    terms:
      "שכבה חינמית. כל מקטע שנוצר על ידי מודל מסומן ככזה בממשק, ואינו מוצג כעובדה שנמדדה.",
  },
];

const NOT_DOING = [
  {
    title: "לא מארח יצירות של אחרים",
    body: "האתר אינו מגיש תמונות, איורים או לוגואים של חברות אחרות. סמל החברה שמופיע לצד כל מניה הוא מונוגרמה שנבנתה כאן על צבע מזהה — צבע מזהה חברה, הוא אינו הלוגו שלה.",
  },
  {
    title: "לא משכפל תמונות של מפרסמים",
    body: "חדשות מוצגות ככותרת, מקור, זמן וקישור לכתבה המקורית. התצלום שהגיע עם הכתבה נשאר אצל המפרסם; האתר אינו שולף אותו ואינו מציג אותו כשלו.",
  },
  {
    title: "לא מתחזה",
    body: "כל פנייה החוצה נושאת זהות אמיתית עם כתובת ליצירת קשר. זה כולל את קריאת גוף הכתבה לצורך סיכום, שפעם נשלחה בתחפושת של דפדפן.",
  },
  {
    title: "לא מבצע פעולות",
    body: "המערכת אינה מחוברת לברוקר, אינה שולחת פקודות ואינה מחזיקה כסף. היא קוראת, מחשבת ומציגה.",
  },
  {
    title: "לא נותן דירוג",
    body: "הניתוח מוסר את הטיעון ואת מקום הסתירה בין הראיות. הוא אינו מחשב ציון המלצה, אינו אומר לקנות או למכור, ואינו קובע נקודת כניסה או יעד.",
  },
];

export default function SourcesPage() {
  return (
    <Page width="read">
      <header className="product-heading">
        <span className="micro-label">MARKET / SOURCES</span>
        <h1 className="display mt-4">מאיפה מגיע כל מספר כאן</h1>
        <p className="lede mt-5">
          אתר מחקר שלא אומר מאיפה הנתונים שלו מבקש אמון שהוא לא הרוויח. זו
          הרשימה המלאה — מה נלקח, ממי, ובאילו תנאים.
        </p>
      </header>

      <Section eyebrow="01 / המקורות" title="מי מספק מה">
        <div className="sources-list">
          {SOURCES.map((source) => (
            <article key={source.name}>
              <h3 dir="ltr">{source.name}</h3>
              <p className="sources-what">{source.what}</p>
              <p className="sources-terms">{source.terms}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="02 / הגבולות"
        title="מה האתר מקפיד לא לעשות"
        description="כל סעיף כאן הוא החלטה שנבדקה בקוד, לא הצהרת כוונות."
      >
        <div className="sources-limits">
          {NOT_DOING.map((item) => (
            <article key={item.title}>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section eyebrow="03 / שמות" title="סימנים מסחריים">
        <p className="sources-prose">
          שמות חברות, סימני מסחר וסימני שירות המוזכרים באתר שייכים לבעליהם.
          האזכור שלהם כאן הוא לצורך זיהוי ודיון בלבד, ואינו מרמז על קשר,
          חסות או אישור מצד אותן חברות. MARKET הוא אתר עצמאי.
        </p>
        <p className="sources-prose">
          מצאתם משהו באתר שנראה לכם שימוש שאינו במקומו —{" "}
          <Link href="/learn">כתבו לנו</Link> והוא יוסר.
        </p>
      </Section>

      <Disclaimer />
    </Page>
  );
}
