import { WatchlistBoard } from "@/components/WatchlistBoard";
import { Disclaimer, Hero, Page, Section } from "@/components/ui";

export const metadata = {
  title: "מעקב",
  description:
    "רשימת המעקב שלך, ומה השתנה בה מאז הביקור הקודם — מחיר, דוח חדש, וכתבות שנוספו.",
};

/**
 * The watchlist.
 *
 * Everything here runs in the browser, so the page itself is a frame. That
 * is not a limitation to hide: a list stored on the reader's machine needs
 * no account and no database, which is what lets the feature exist at all
 * on a project that pays nothing a month.
 */
export default function WatchlistPage() {
  return (
    <Page tint="#4ea3c4" width="wide">
      <Hero
        eyebrow="מעקב"
        title="מה השתנה בחברות שאתה עוקב אחריהן"
        lede="רשימת מעקב שנשמרת בדפדפן שלך. בכל כניסה היא משווה את המצב הנוכחי לזה שנשמר בפעם הקודמת, ומראה מה זז — מחיר, דוח חדש שנקלט, או כתבות שהתווספו לפיד."
      />

      <Section
        eyebrow="הרשימה"
        title="החברות במעקב"
        description="הנתונים כאן מגיעים מקובץ המדדים שנבנה בלילה ומציטוט חי. הקריאה המלאה — מבחן הליבה, התזה והטכני — נמצאת בעמוד של כל חברה."
      >
        <WatchlistBoard />
      </Section>

      <Disclaimer extra="הרשימה נשמרת מקומית בדפדפן ואינה עוברת לשרת. ניקוי נתוני האתר בדפדפן ימחק אותה." />
    </Page>
  );
}
